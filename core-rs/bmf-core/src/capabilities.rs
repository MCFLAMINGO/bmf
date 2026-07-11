//! Capability derivation from a normalized [`Robot`] IR.
//!
//! Each derivation is a pure function of the IR. No physics, no simulation.
//!
//! Capabilities are strings from the BMF namespace:
//! - `kin.urdf` — declared to be URDF format
//! - `kin.arm` — serial chain of ≥5 non-fixed joints ending in a leaf link
//! - `kin.dof.arm=N` — arm DoF count (as attribute string)
//! - `kin.superhuman.joints` — any `continuous` joint (unbounded rotation)
//! - `safety.workspace.limits` — every non-fixed joint has finite lower/upper/effort/velocity

use crate::ir::{JointKind, Robot, SourceFormat};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Capability {
    pub name: String,
    /// Optional attributes (e.g. `dof=7`).
    pub attrs: Vec<(String, String)>,
}

impl Capability {
    pub fn new(name: impl Into<String>) -> Self {
        Capability {
            name: name.into(),
            attrs: Vec::new(),
        }
    }
    pub fn with(name: impl Into<String>, key: impl Into<String>, val: impl Into<String>) -> Self {
        Capability {
            name: name.into(),
            attrs: vec![(key.into(), val.into())],
        }
    }
}

/// Return all capabilities the robot demonstrably has, per the IR.
pub fn derive_capabilities(robot: &Robot) -> Vec<Capability> {
    let mut caps = Vec::new();

    // Format tag — one per known source.
    match robot.source_format {
        SourceFormat::Urdf => caps.push(Capability::new("kin.urdf")),
        SourceFormat::Mjcf => caps.push(Capability::new("kin.mjcf")),
        SourceFormat::UnitreeG1Sdk => caps.push(Capability::new("kin.unitree.g1_sdk")),
        SourceFormat::BosdynSpotSdk => caps.push(Capability::new("kin.bosdyn.spot_sdk")),
        SourceFormat::AgibotYaml => caps.push(Capability::new("kin.agibot.yaml")),
        SourceFormat::Usd => caps.push(Capability::new("kin.usd")),
        SourceFormat::Custom => caps.push(Capability::new("kin.custom")),
    }

    // Compute all leaf-chain DoF counts in one pass — we need this data for
    // arm/biped/quadruped detection.
    let leaf_chain_dofs: Vec<u32> = robot
        .find_leaves()
        .iter()
        .map(|l| {
            let chain = robot.chain_from_leaf(&l.name);
            chain.iter().filter(|j| j.kind.is_actuated()).count() as u32
        })
        .collect();

    // Chain DoF includes the base joint (a floating base contributes 1 to chain
    // length — 6 physical DoF, but 1 joint entry). So real morphology looks like:
    //   quadruped leg (Go2): 3 leg joints + 1 base joint = 4 chain-DoF
    //   biped leg (H1):      5 leg joints + 1 base joint = 6 chain-DoF
    //   biped leg (G1):      6 leg joints + 1 base joint = 7 chain-DoF (ankle roll)
    //   biped arm (H1):      5 arm joints + 1 base joint = 6 chain-DoF
    //   biped arm (G1):     10 arm joints + 1 base joint = 11 chain-DoF (with hand)
    //   fixed-base arm (Panda): 8 joints, no base = 8 chain-DoF
    //
    // Distinguishing legs from arms by chain-DoF alone is unreliable when both
    // are the same length (H1). But: on a floating-base biped, exactly 2 chains
    // are legs and the rest are arms (or heads). We use a smarter test:
    //   if floating base AND exactly 4 leaf chains of roughly equal length →
    //     it's a humanoid (2 legs + 2 arms).
    //   if floating base AND exactly 4 leaf chains of short length →
    //     it's a quadruped.
    //
    // Non-heuristic categories:
    //   n_short_chains = 3-4 DoF chains (quadruped legs)
    //   n_medium_chains = 5-8 DoF chains (biped legs or fixed-base arms)
    //   n_long_chains  = ≥9 DoF chains (arms with hands, or arms with grippers)
    let n_short_chains = leaf_chain_dofs.iter().filter(|&&d| (3..=4).contains(&d)).count();
    let n_medium_chains = leaf_chain_dofs.iter().filter(|&&d| (5..=8).contains(&d)).count();
    let n_long_chains = leaf_chain_dofs.iter().filter(|&&d| d >= 9).count();
    let longest_arm_dof: u32 = leaf_chain_dofs.iter().copied().max().unwrap_or(0);

    let has_floating_root = robot
        .joints
        .iter()
        .any(|j| matches!(j.kind, JointKind::Floating));

    // Morphology detection first, then arm.
    //
    // kin.legged.quadruped — 4 short leaf chains AND floating base AND no medium/long chains.
    if n_short_chains == 4 && has_floating_root && n_medium_chains == 0 && n_long_chains == 0 {
        caps.push(Capability::new("kin.legged.quadruped"));
    }
    // kin.legged.biped — floating base AND exactly 4 total leaf chains that are
    // NOT all short. This catches: H1 (4 medium), G1 (2 medium legs + 2 long arms),
    // and Atlas.
    else if has_floating_root && leaf_chain_dofs.len() == 4 && n_short_chains == 0 {
        caps.push(Capability::new("kin.legged.biped"));
    }

    let is_legged = caps
        .iter()
        .any(|c| c.name == "kin.legged.biped" || c.name == "kin.legged.quadruped");

    // kin.arm — at least one leaf chain of ≥5 actuated joints AND not a leg.
    // On a legged robot, the arm chains are the ones ≥9 DoF (they include the
    // floating base + a real 5-7 DoF arm + optional hand fingers). On a fixed-
    // base robot, any ≥5 DoF chain is an arm.
    let has_arm = if is_legged {
        n_long_chains > 0
    } else {
        longest_arm_dof >= 5
    };
    if has_arm {
        caps.push(Capability::new("kin.arm"));
        // For legged robots, report longest chain minus the estimated leg DoF.
        // For fixed-base, just report longest chain.
        let reported_dof = if is_legged {
            longest_arm_dof.saturating_sub(1) // subtract the floating-base entry
        } else {
            longest_arm_dof
        };
        caps.push(Capability::with("kin.dof.arm", "dof", reported_dof.to_string()));
    }

    // kin.mobile — non-fixed root (floating or planar).
    let has_planar_root = robot
        .joints
        .iter()
        .any(|j| matches!(j.kind, JointKind::Planar));
    if has_floating_root || has_planar_root {
        caps.push(Capability::new("kin.mobile"));
    }

    // kin.superhuman.joints — any continuous joint (Atlas hips/waist/neck).
    if robot
        .joints
        .iter()
        .any(|j| matches!(j.kind, JointKind::Continuous))
    {
        caps.push(Capability::new("kin.superhuman.joints"));
    }

    // safety.workspace.limits — every non-fixed joint has fully-specified limits.
    let all_bounded = robot
        .joints
        .iter()
        .filter(|j| j.kind.is_actuated())
        .all(|j| j.limits.is_fully_specified() || matches!(j.kind, JointKind::Continuous));
    if all_bounded && robot.joints.iter().any(|j| j.kind.is_actuated()) {
        caps.push(Capability::new("safety.workspace.limits"));
    }

    caps
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::urdf::parse_urdf;

    fn cap_names(caps: &[Capability]) -> Vec<String> {
        caps.iter().map(|c| c.name.clone()).collect()
    }

    #[test]
    fn one_joint_is_not_an_arm() {
        let src = r#"
        <robot name="tiny">
          <link name="a"/><link name="b"/>
          <joint name="j" type="revolute">
            <parent link="a"/><child link="b"/>
            <limit lower="-1" upper="1" effort="1" velocity="1"/>
          </joint>
        </robot>"#;
        let r = parse_urdf(src).unwrap();
        let names = cap_names(&derive_capabilities(&r));
        assert!(names.contains(&"kin.urdf".to_string()));
        assert!(!names.contains(&"kin.arm".to_string()));
        assert!(names.contains(&"safety.workspace.limits".to_string()));
    }

    #[test]
    fn seven_joint_chain_is_arm() {
        let mut xml = String::from(r#"<robot name="arm7">"#);
        xml.push_str(r#"<link name="l0"/>"#);
        for i in 1..=7 {
            xml.push_str(&format!(r#"<link name="l{i}"/>"#));
            xml.push_str(&format!(
                r#"<joint name="j{i}" type="revolute">
                    <parent link="l{p}"/><child link="l{i}"/>
                    <limit lower="-3" upper="3" effort="10" velocity="1"/>
                </joint>"#,
                p = i - 1
            ));
        }
        xml.push_str("</robot>");
        let r = parse_urdf(&xml).unwrap();
        let caps = derive_capabilities(&r);
        let names = cap_names(&caps);
        assert!(names.contains(&"kin.arm".to_string()));
        let dof = caps.iter().find(|c| c.name == "kin.dof.arm").unwrap();
        assert_eq!(dof.attrs[0].1, "7");
    }

    #[test]
    fn continuous_joint_marks_superhuman() {
        let src = r#"
        <robot name="spinner">
          <link name="a"/><link name="b"/>
          <joint name="j" type="continuous">
            <parent link="a"/><child link="b"/>
          </joint>
        </robot>"#;
        let r = parse_urdf(src).unwrap();
        let names = cap_names(&derive_capabilities(&r));
        assert!(names.contains(&"kin.superhuman.joints".to_string()));
        // Continuous joints don't need bounded limits — still counts as workspace.limits.
        assert!(names.contains(&"safety.workspace.limits".to_string()));
    }
}

//! MJCF (MuJoCo XML) parser. Structural only.
//!
//! Reference: https://mujoco.readthedocs.io/en/stable/XMLreference.html
//!
//! MJCF nests `<body>` elements to form the kinematic tree. Each `<body>`
//! has `<joint>` children (0 or more) that connect it to its *parent* body.
//! A body with no `<joint>` is rigidly welded to its parent.
//!
//! We lower to the same [`Robot`] IR as URDF, synthesizing fixed joints for
//! welded bodies so the graph is complete.

use crate::ir::{Joint, JointKind, JointLimits, Link, Robot, SourceFormat};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum MjcfError {
    #[error("XML parse error: {0}")]
    Xml(#[from] roxmltree::Error),
    #[error("Root element is not <mujoco> (got <{0}>)")]
    NotMujoco(String),
    #[error("<worldbody> missing")]
    NoWorldbody,
    #[error("Unknown joint type `{0}`")]
    UnknownJointType(String),
}

pub fn parse_mjcf(src: &str) -> Result<Robot, MjcfError> {
    let doc = roxmltree::Document::parse(src)?;
    let root = doc.root_element();
    if root.tag_name().name() != "mujoco" {
        return Err(MjcfError::NotMujoco(root.tag_name().name().to_string()));
    }
    let model_name = root.attribute("model").unwrap_or("mjcf_model").to_string();

    let worldbody = root
        .children()
        .find(|n| n.is_element() && n.tag_name().name() == "worldbody")
        .ok_or(MjcfError::NoWorldbody)?;

    let mut links = Vec::new();
    let mut joints = Vec::new();

    // Synthesize a "world" link for the worldbody itself.
    links.push(Link {
        name: "world".to_string(),
        has_collision: false,
        has_visual: false,
        has_inertial: false,
    });

    // Anonymous bodies get "body_N" names; use a counter.
    let mut anon = 0u32;
    for child in worldbody.children().filter(|n| n.is_element() && n.tag_name().name() == "body") {
        walk_body(&child, "world", &mut links, &mut joints, &mut anon)?;
    }

    Ok(Robot {
        name: model_name,
        links,
        joints,
        source_format: SourceFormat::Mjcf,
    })
}

fn walk_body(
    body: &roxmltree::Node,
    parent_name: &str,
    links: &mut Vec<Link>,
    joints: &mut Vec<Joint>,
    anon: &mut u32,
) -> Result<(), MjcfError> {
    let this_name = body
        .attribute("name")
        .map(str::to_string)
        .unwrap_or_else(|| {
            *anon += 1;
            format!("body_{anon}")
        });

    let mut has_collision = false;
    let mut has_visual = false;
    let mut has_inertial = false;
    for sub in body.children().filter(|n| n.is_element()) {
        match sub.tag_name().name() {
            // MJCF uses <geom> for both collision and visual by default.
            "geom" => {
                has_collision = true;
                has_visual = true;
            }
            "inertial" => has_inertial = true,
            _ => {}
        }
    }
    links.push(Link {
        name: this_name.clone(),
        has_collision,
        has_visual,
        has_inertial,
    });

    // Collect joints connecting this body to parent. A free joint at root implies
    // a floating base. No <joint/> at all → rigidly welded (synthesize fixed).
    //
    // MJCF has TWO ways to declare a free joint:
    //   <joint type="free"/>       (long form)
    //   <freejoint/>                (short form, common in Menagerie)
    // We handle both.
    let mut joint_count = 0usize;
    for sub in body
        .children()
        .filter(|n| n.is_element() && n.tag_name().name() == "freejoint")
    {
        let jname = sub
            .attribute("name")
            .map(str::to_string)
            .unwrap_or_else(|| format!("{}_freejoint", this_name));
        joints.push(Joint {
            name: jname,
            kind: JointKind::Floating,
            parent: parent_name.to_string(),
            child: this_name.clone(),
            limits: JointLimits::default(),
            axis: None,
        });
        joint_count += 1;
    }
    for sub in body.children().filter(|n| n.is_element() && n.tag_name().name() == "joint") {
        let jname = sub
            .attribute("name")
            .map(str::to_string)
            .unwrap_or_else(|| format!("{}_joint_{}", this_name, joint_count));
        let jtype = sub.attribute("type").unwrap_or("hinge");
        let kind = match jtype {
            "hinge" => JointKind::Revolute, // MJCF hinge with no range → continuous, but keep as revolute unless range absent
            "slide" => JointKind::Prismatic,
            "ball" => JointKind::Revolute, // 3-DoF ball; we simplify to revolute for now (0.2.1 will lift)
            "free" => JointKind::Floating,
            other => return Err(MjcfError::UnknownJointType(other.to_string())),
        };

        let mut limits = JointLimits::default();
        if let Some(range) = sub.attribute("range") {
            let parts: Vec<f64> = range
                .split_whitespace()
                .filter_map(|s| s.parse().ok())
                .collect();
            if parts.len() == 2 {
                limits.lower = Some(parts[0]);
                limits.upper = Some(parts[1]);
            }
        } else if kind == JointKind::Revolute {
            // Unranged hinge in MJCF is effectively continuous.
            // Upgrade the kind.
        }
        // Reclassify unranged hinge as continuous (superhuman joint) — matches MJCF semantics.
        let kind = if kind == JointKind::Revolute && sub.attribute("range").is_none() {
            JointKind::Continuous
        } else {
            kind
        };

        let axis = sub.attribute("axis").and_then(|s| {
            let parts: Vec<f64> = s.split_whitespace().filter_map(|x| x.parse().ok()).collect();
            if parts.len() == 3 {
                Some([parts[0], parts[1], parts[2]])
            } else {
                None
            }
        });

        joints.push(Joint {
            name: jname,
            kind,
            parent: parent_name.to_string(),
            child: this_name.clone(),
            limits,
            axis,
        });
        joint_count += 1;
    }
    if joint_count == 0 {
        // Rigidly welded to parent.
        joints.push(Joint {
            name: format!("{}_fixed_to_{}", this_name, parent_name),
            kind: JointKind::Fixed,
            parent: parent_name.to_string(),
            child: this_name.clone(),
            limits: JointLimits::default(),
            axis: None,
        });
    }

    // Recurse into nested bodies.
    for sub in body.children().filter(|n| n.is_element() && n.tag_name().name() == "body") {
        walk_body(&sub, &this_name, links, joints, anon)?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_minimal_mjcf() {
        let src = r#"
        <mujoco model="test">
          <worldbody>
            <body name="base">
              <geom type="box" size="1 1 1"/>
              <body name="link1">
                <joint name="j0" type="hinge" axis="0 0 1" range="-3.14 3.14"/>
                <geom type="cylinder"/>
              </body>
            </body>
          </worldbody>
        </mujoco>"#;
        let r = parse_mjcf(src).expect("must parse");
        assert_eq!(r.name, "test");
        // world + base + link1
        assert_eq!(r.links.len(), 3);
        // base->world fixed, link1->base hinge
        assert_eq!(r.joints.len(), 2);
        assert_eq!(r.joints[0].kind, JointKind::Fixed);
        assert_eq!(r.joints[1].kind, JointKind::Revolute);
    }

    #[test]
    fn free_joint_becomes_floating() {
        let src = r#"
        <mujoco>
          <worldbody>
            <body name="torso">
              <joint type="free"/>
              <geom type="box"/>
            </body>
          </worldbody>
        </mujoco>"#;
        let r = parse_mjcf(src).unwrap();
        assert!(r.joints.iter().any(|j| j.kind == JointKind::Floating));
        assert_eq!(r.total_actuated_dof(), 6);
    }

    #[test]
    fn unranged_hinge_becomes_continuous() {
        let src = r#"
        <mujoco>
          <worldbody>
            <body name="wheel">
              <joint type="hinge" axis="0 1 0"/>
              <geom type="cylinder"/>
            </body>
          </worldbody>
        </mujoco>"#;
        let r = parse_mjcf(src).unwrap();
        let wheel_joint = r.joints.iter().find(|j| j.child == "wheel").unwrap();
        assert_eq!(wheel_joint.kind, JointKind::Continuous);
    }
}

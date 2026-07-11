//! Integration tests against real URDF fixtures shipped in spec/examples/.

use bmf_core::{derive_capabilities, parse_mjcf, parse_urdf};
use std::fs;

fn fixture(name: &str) -> String {
    // Tests run with CWD = bmf-core/, so climb to workspace root.
    let path = format!("../../spec/examples/{name}");
    fs::read_to_string(&path).unwrap_or_else(|_| panic!("cannot read {path}"))
}

fn cap_names(r: &bmf_core::Robot) -> Vec<String> {
    derive_capabilities(r).into_iter().map(|c| c.name).collect()
}

#[test]
fn panda_is_a_7dof_arm() {
    let src = fixture("panda.urdf");
    let r = parse_urdf(&src).expect("panda parses");
    assert_eq!(r.name, "panda");
    let caps = derive_capabilities(&r);
    let names: Vec<&str> = caps.iter().map(|c| c.name.as_str()).collect();
    assert!(names.contains(&"kin.urdf"));
    assert!(names.contains(&"kin.arm"), "panda should be recognized as an arm");
    // Panda is 7-DoF arm + 2-finger gripper (revolute prismatics). The longest
    // chain from a leaf to root should have 7+ actuated joints.
    let dof = caps.iter().find(|c| c.name == "kin.dof.arm").unwrap();
    let n: u32 = dof.attrs[0].1.parse().unwrap();
    assert!(n >= 7, "panda DoF should be ≥7, got {n}");
}

#[test]
fn so100_is_a_5dof_arm() {
    let src = fixture("so100.urdf");
    let r = parse_urdf(&src).expect("so100 parses");
    let caps = derive_capabilities(&r);
    let names: Vec<&str> = caps.iter().map(|c| c.name.as_str()).collect();
    assert!(names.contains(&"kin.urdf"));
    assert!(
        names.contains(&"kin.arm"),
        "so100 should be recognized as an arm — got {names:?}"
    );
    let dof = caps.iter().find(|c| c.name == "kin.dof.arm").unwrap();
    let n: u32 = dof.attrs[0].1.parse().unwrap();
    assert!(n >= 5, "so100 DoF should be ≥5, got {n}");
}

#[test]
fn both_urdf_fixtures_have_finite_link_and_joint_counts() {
    for name in ["panda.urdf", "so100.urdf"] {
        let r = parse_urdf(&fixture(name)).unwrap();
        assert!(!r.links.is_empty(), "{name}: no links");
        assert!(!r.joints.is_empty(), "{name}: no joints");
        let names = cap_names(&r);
        for cap in &names {
            assert!(
                cap.starts_with("kin.")
                    || cap.starts_with("safety.")
                    || cap.starts_with("policy.")
                    || cap.starts_with("chor."),
                "{name}: unexpected capability namespace: {cap}"
            );
        }
    }
}

#[test]
fn unitree_h1_is_a_biped() {
    let src = fixture("unitree_h1.mjcf");
    let r = parse_mjcf(&src).expect("h1 parses");
    assert_eq!(r.name, "h1");
    let names = cap_names(&r);
    assert!(names.contains(&"kin.mjcf".to_string()));
    assert!(
        names.contains(&"kin.legged.biped".to_string()),
        "H1 should be biped — got {names:?}"
    );
    assert!(names.contains(&"kin.mobile".to_string()));
    // H1 fixture has arms ending at elbow (6 chain-DoF each, no hand) — too short
    // to distinguish from legs. That's a fair report; we don't claim kin.arm without
    // signal. G1 (with hands) DOES claim kin.arm.
}

#[test]
fn unitree_g1_is_a_biped_with_arms() {
    let src = fixture("unitree_g1.mjcf");
    let r = parse_mjcf(&src).expect("g1 parses");
    let names = cap_names(&r);
    assert!(
        names.contains(&"kin.legged.biped".to_string()),
        "G1 should be biped — got {names:?}"
    );
    assert!(
        names.contains(&"kin.arm".to_string()),
        "G1 has hands — should also claim kin.arm — got {names:?}"
    );
}

#[test]
fn unitree_go2_is_a_quadruped() {
    let src = fixture("unitree_go2.mjcf");
    let r = parse_mjcf(&src).expect("go2 parses");
    let names = cap_names(&r);
    assert!(
        names.contains(&"kin.legged.quadruped".to_string()),
        "Go2 should be quadruped — got {names:?}"
    );
    assert!(names.contains(&"kin.mobile".to_string()));
}

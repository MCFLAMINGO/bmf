//! URDF parser. Structural only — no mesh loading, no physics.
//!
//! Reference: http://wiki.ros.org/urdf/XML

use crate::ir::{Joint, JointKind, JointLimits, Link, Robot, SourceFormat};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum UrdfError {
    #[error("XML parse error: {0}")]
    Xml(#[from] roxmltree::Error),
    #[error("Root element is not <robot> (got <{0}>)")]
    NotRobot(String),
    #[error("Missing required attribute `{0}` on <{1}>")]
    MissingAttr(&'static str, &'static str),
    #[error("Unknown joint type `{0}`")]
    UnknownJointType(String),
    #[error("Joint `{0}` has no <parent> or no <child>")]
    JointMissingLink(String),
}

pub fn parse_urdf(src: &str) -> Result<Robot, UrdfError> {
    let doc = roxmltree::Document::parse(src)?;
    let root = doc.root_element();
    if root.tag_name().name() != "robot" {
        return Err(UrdfError::NotRobot(root.tag_name().name().to_string()));
    }
    let name = root
        .attribute("name")
        .ok_or(UrdfError::MissingAttr("name", "robot"))?
        .to_string();

    let mut links = Vec::new();
    let mut joints = Vec::new();

    for child in root.children().filter(|n| n.is_element()) {
        match child.tag_name().name() {
            "link" => {
                let ln = child
                    .attribute("name")
                    .ok_or(UrdfError::MissingAttr("name", "link"))?
                    .to_string();
                let mut has_collision = false;
                let mut has_visual = false;
                let mut has_inertial = false;
                for sub in child.children().filter(|n| n.is_element()) {
                    match sub.tag_name().name() {
                        "collision" => has_collision = true,
                        "visual" => has_visual = true,
                        "inertial" => has_inertial = true,
                        _ => {}
                    }
                }
                links.push(Link {
                    name: ln,
                    has_collision,
                    has_visual,
                    has_inertial,
                });
            }
            "joint" => {
                let jn = child
                    .attribute("name")
                    .ok_or(UrdfError::MissingAttr("name", "joint"))?
                    .to_string();
                let jt_str = child
                    .attribute("type")
                    .ok_or(UrdfError::MissingAttr("type", "joint"))?;
                let kind = match jt_str {
                    "fixed" => JointKind::Fixed,
                    "revolute" => JointKind::Revolute,
                    "continuous" => JointKind::Continuous,
                    "prismatic" => JointKind::Prismatic,
                    "planar" => JointKind::Planar,
                    "floating" => JointKind::Floating,
                    other => return Err(UrdfError::UnknownJointType(other.to_string())),
                };

                let mut parent = None;
                let mut child_link = None;
                let mut limits = JointLimits::default();
                let mut axis = None;

                for sub in child.children().filter(|n| n.is_element()) {
                    match sub.tag_name().name() {
                        "parent" => parent = sub.attribute("link").map(str::to_string),
                        "child" => child_link = sub.attribute("link").map(str::to_string),
                        "limit" => {
                            limits.lower = sub.attribute("lower").and_then(|s| s.parse().ok());
                            limits.upper = sub.attribute("upper").and_then(|s| s.parse().ok());
                            limits.effort = sub.attribute("effort").and_then(|s| s.parse().ok());
                            limits.velocity =
                                sub.attribute("velocity").and_then(|s| s.parse().ok());
                        }
                        "axis" => {
                            if let Some(xyz) = sub.attribute("xyz") {
                                let parts: Vec<f64> = xyz
                                    .split_whitespace()
                                    .filter_map(|s| s.parse().ok())
                                    .collect();
                                if parts.len() == 3 {
                                    axis = Some([parts[0], parts[1], parts[2]]);
                                }
                            }
                        }
                        _ => {}
                    }
                }

                let parent = parent.ok_or_else(|| UrdfError::JointMissingLink(jn.clone()))?;
                let child_link =
                    child_link.ok_or_else(|| UrdfError::JointMissingLink(jn.clone()))?;

                joints.push(Joint {
                    name: jn,
                    kind,
                    parent,
                    child: child_link,
                    limits,
                    axis,
                });
            }
            _ => {}
        }
    }

    Ok(Robot {
        name,
        links,
        joints,
        source_format: SourceFormat::Urdf,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const TWO_LINK: &str = r#"
    <robot name="two_link">
      <link name="base_link"><visual/></link>
      <link name="tool_link"><collision/><inertial/></link>
      <joint name="j0" type="revolute">
        <parent link="base_link"/>
        <child link="tool_link"/>
        <axis xyz="0 0 1"/>
        <limit lower="-3.14" upper="3.14" effort="10" velocity="1"/>
      </joint>
    </robot>"#;

    #[test]
    fn parses_minimal_urdf() {
        let r = parse_urdf(TWO_LINK).expect("must parse");
        assert_eq!(r.name, "two_link");
        assert_eq!(r.links.len(), 2);
        assert_eq!(r.joints.len(), 1);
        assert_eq!(r.joints[0].kind, JointKind::Revolute);
        assert!(r.joints[0].limits.is_fully_specified());
        assert_eq!(r.joints[0].axis, Some([0.0, 0.0, 1.0]));
    }

    #[test]
    fn rejects_non_robot_root() {
        let src = r#"<not_robot name="x"/>"#;
        assert!(matches!(parse_urdf(src), Err(UrdfError::NotRobot(_))));
    }

    #[test]
    fn rejects_unknown_joint_type() {
        let src = r#"
        <robot name="x">
          <link name="a"/><link name="b"/>
          <joint name="j" type="wobbly">
            <parent link="a"/><child link="b"/>
          </joint>
        </robot>"#;
        assert!(matches!(parse_urdf(src), Err(UrdfError::UnknownJointType(_))));
    }

    #[test]
    fn dof_count_correct() {
        let r = parse_urdf(TWO_LINK).unwrap();
        assert_eq!(r.total_actuated_dof(), 1);
    }

    #[test]
    fn finds_root_and_leaf() {
        let r = parse_urdf(TWO_LINK).unwrap();
        let roots = r.find_roots();
        assert_eq!(roots.len(), 1);
        assert_eq!(roots[0].name, "base_link");
        let leaves = r.find_leaves();
        assert_eq!(leaves.len(), 1);
        assert_eq!(leaves[0].name, "tool_link");
    }
}

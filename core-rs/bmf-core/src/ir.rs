//! Normalized robot IR. Format-agnostic — URDF, MJCF, G1_SDK, Spot SDK all lower to this.

use serde::{Deserialize, Serialize};

/// Joint kind covering URDF, MJCF, and vendor formats.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum JointKind {
    /// Rigidly welded — no motion.
    Fixed,
    /// Rotates about an axis, bounded.
    Revolute,
    /// Rotates about an axis, unbounded (wheels, spinners, Atlas superhuman joints).
    Continuous,
    /// Slides along an axis.
    Prismatic,
    /// Planar (2 translational DoF).
    Planar,
    /// Floating (6 DoF, mobile base or free root).
    Floating,
}

impl JointKind {
    /// True if this joint contributes to actuated DoF count.
    pub fn is_actuated(self) -> bool {
        !matches!(self, JointKind::Fixed)
    }
}

/// Signed hard limits for revolute / prismatic joints. Missing → declared-only.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct JointLimits {
    pub lower: Option<f64>,
    pub upper: Option<f64>,
    pub effort: Option<f64>,
    pub velocity: Option<f64>,
}

impl JointLimits {
    /// True if lower/upper/effort/velocity are all finite (capability
    /// `safety.workspace.limits` needs this per joint).
    pub fn is_fully_specified(&self) -> bool {
        self.lower.map_or(false, f64::is_finite)
            && self.upper.map_or(false, f64::is_finite)
            && self.effort.map_or(false, f64::is_finite)
            && self.velocity.map_or(false, f64::is_finite)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Joint {
    pub name: String,
    pub kind: JointKind,
    pub parent: String,
    pub child: String,
    #[serde(default)]
    pub limits: JointLimits,
    /// Axis of rotation/translation in parent frame, if declared.
    #[serde(default)]
    pub axis: Option<[f64; 3]>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Link {
    pub name: String,
    /// True if the link declares a collision mesh/geometry.
    #[serde(default)]
    pub has_collision: bool,
    /// True if the link declares a visual mesh/geometry.
    #[serde(default)]
    pub has_visual: bool,
    /// True if the link declares inertial mass/inertia.
    #[serde(default)]
    pub has_inertial: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Robot {
    pub name: String,
    pub links: Vec<Link>,
    pub joints: Vec<Joint>,
    /// Which format this IR came from — for provenance.
    pub source_format: SourceFormat,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SourceFormat {
    Urdf,
    Mjcf,
    UnitreeG1Sdk,
    BosdynSpotSdk,
    AgibotYaml,
    Usd,
    Custom,
}

impl Robot {
    /// Return links with zero incoming child edges — i.e. the root link.
    /// A well-formed URDF has exactly one root.
    pub fn find_roots(&self) -> Vec<&Link> {
        let has_parent: std::collections::HashSet<&str> =
            self.joints.iter().map(|j| j.child.as_str()).collect();
        self.links
            .iter()
            .filter(|l| !has_parent.contains(l.name.as_str()))
            .collect()
    }

    /// Return links with zero outgoing child edges — i.e. leaf links (tools, wheels, feet).
    pub fn find_leaves(&self) -> Vec<&Link> {
        let has_child: std::collections::HashSet<&str> =
            self.joints.iter().map(|j| j.parent.as_str()).collect();
        self.links
            .iter()
            .filter(|l| !has_child.contains(l.name.as_str()))
            .collect()
    }

    /// Count actuated DoF (revolute + continuous + prismatic + planar*2 + floating*6).
    pub fn total_actuated_dof(&self) -> u32 {
        self.joints
            .iter()
            .map(|j| match j.kind {
                JointKind::Fixed => 0,
                JointKind::Revolute | JointKind::Continuous | JointKind::Prismatic => 1,
                JointKind::Planar => 2,
                JointKind::Floating => 6,
            })
            .sum()
    }

    /// Return joints where the child is the given link name.
    pub fn joints_to(&self, link: &str) -> Vec<&Joint> {
        self.joints.iter().filter(|j| j.child == link).collect()
    }

    /// Return joints where the parent is the given link name.
    pub fn joints_from(&self, link: &str) -> Vec<&Joint> {
        self.joints.iter().filter(|j| j.parent == link).collect()
    }

    /// Walk the kinematic chain from `link` up to root, returning the ordered joints
    /// (leaf-first, root-last). Handles malformed graphs by breaking on cycles.
    pub fn chain_from_leaf(&self, leaf: &str) -> Vec<&Joint> {
        let mut out = Vec::new();
        let mut cursor = leaf.to_string();
        let mut visited = std::collections::HashSet::new();
        while visited.insert(cursor.clone()) {
            let parents = self.joints_to(&cursor);
            if parents.is_empty() {
                break;
            }
            // A well-formed tree has one parent per link.
            let j = parents[0];
            out.push(j);
            cursor = j.parent.clone();
        }
        out
    }
}

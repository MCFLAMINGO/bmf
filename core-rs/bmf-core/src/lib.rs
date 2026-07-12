//! BMF core — kinematics/policy/trajectory/choreography parsers and capability derivations.
//!
//! Verification is purely structural. No physics, no simulation, no inference.
//! Robotics kinds (URDF/MJCF/policy) are verified here in Rust — not reimplemented in TS.

pub mod capabilities;
pub mod ir;
pub mod mjcf;
pub mod policy;
pub mod urdf;

pub use capabilities::{derive_capabilities, Capability};
pub use ir::{Joint, JointKind, Link, Robot};
pub use mjcf::{parse_mjcf, MjcfError};
pub use policy::{
    assert_hardware_allowed, derive_policy_capabilities, parse_policy_bundle, Policy, PolicyError,
};
pub use urdf::{parse_urdf, UrdfError};

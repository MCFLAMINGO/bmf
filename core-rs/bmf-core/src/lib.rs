//! BMF core — kinematics/policy/trajectory/choreography parsers and capability derivations.
//!
//! Parsers produce a normalized [`Robot`] IR. Capability derivers examine the IR and
//! return a set of capability strings (`kin.arm`, `kin.legged.biped`, `kin.dof.arm=7`, etc.).
//!
//! Verification is purely structural. No physics, no simulation, no inference.

pub mod capabilities;
pub mod ir;
pub mod mjcf;
pub mod urdf;

pub use capabilities::{derive_capabilities, Capability};
pub use ir::{Joint, JointKind, Link, Robot};
pub use mjcf::{parse_mjcf, MjcfError};
pub use urdf::{parse_urdf, UrdfError};

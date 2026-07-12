//! Node.js bindings for bmf-core.
//!
//! Same FFI shape as bmf-py: JSON string / bytes in, JSON string out. TypeScript
//! wrapper (sdk/typescript/src/native.ts) does `JSON.parse` once per call.

use napi::bindgen_prelude::*;
use napi_derive::napi;
use serde_json::json;

fn caps_to_json(caps: Vec<::bmf_core::Capability>) -> Vec<serde_json::Value> {
    caps.into_iter()
        .map(|c| {
            let attrs: serde_json::Map<String, serde_json::Value> = c
                .attrs
                .into_iter()
                .map(|(k, v)| (k, serde_json::Value::String(v)))
                .collect();
            json!({ "name": c.name, "attrs": attrs })
        })
        .collect()
}

fn robot_and_caps_json(robot: ::bmf_core::Robot) -> Result<String> {
    let caps = ::bmf_core::derive_capabilities(&robot);
    let out = json!({ "robot": robot, "capabilities": caps_to_json(caps) });
    serde_json::to_string(&out).map_err(|e| Error::new(Status::GenericFailure, e.to_string()))
}

/// Parse a URDF string. Returns JSON `{"robot": ..., "capabilities": [...]}`.
#[napi]
pub fn parse_urdf(src: String) -> Result<String> {
    let robot = ::bmf_core::parse_urdf(&src)
        .map_err(|e| Error::new(Status::InvalidArg, e.to_string()))?;
    robot_and_caps_json(robot)
}

/// Parse an MJCF string. Returns JSON `{"robot": ..., "capabilities": [...]}`.
#[napi]
pub fn parse_mjcf(src: String) -> Result<String> {
    let robot = ::bmf_core::parse_mjcf(&src)
        .map_err(|e| Error::new(Status::InvalidArg, e.to_string()))?;
    robot_and_caps_json(robot)
}

/// Parse a policy bundle (`.tar` / `.tar.zst` bytes).
/// Returns JSON `{"policy": {...}, "capabilities": [...]}`.
#[napi]
pub fn parse_policy(bytes: Buffer) -> Result<String> {
    let policy = ::bmf_core::parse_policy_bundle(&bytes)
        .map_err(|e| Error::new(Status::InvalidArg, e.to_string()))?;
    let caps = ::bmf_core::derive_policy_capabilities(&policy);
    let out = json!({
        "policy": {
            "framework": policy.framework,
            "has_weights": policy.has_weights,
            "has_train_config": policy.has_train_config,
            "safety": {
                "sim_only": policy.safety.sim_only,
                "dead_man": policy.safety.dead_man,
            },
            "embodiment_targets": policy.embodiment_targets,
        },
        "capabilities": caps_to_json(caps),
    });
    serde_json::to_string(&out).map_err(|e| Error::new(Status::GenericFailure, e.to_string()))
}

/// Hardware gate: returns JSON `{ "allowed": bool, "reason": string|null }`.
#[napi]
pub fn check_hardware_allowed(capabilities: Vec<String>) -> Result<String> {
    let caps: Vec<::bmf_core::Capability> = capabilities
        .into_iter()
        .map(::bmf_core::Capability::new)
        .collect();
    match ::bmf_core::assert_hardware_allowed(&caps) {
        Ok(()) => Ok(json!({ "allowed": true, "reason": null }).to_string()),
        Err(reason) => Ok(json!({ "allowed": false, "reason": reason }).to_string()),
    }
}

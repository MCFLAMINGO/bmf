//! Node.js bindings for bmf-core.
//!
//! Same FFI shape as bmf-py: JSON string in, JSON string out. TypeScript
//! wrapper (sdk/typescript/src/native.ts) does `JSON.parse` once per call.

use napi::bindgen_prelude::*;
use napi_derive::napi;
use serde_json::json;

fn robot_and_caps_json(robot: ::bmf_core::Robot) -> Result<String> {
    let caps = ::bmf_core::derive_capabilities(&robot);
    let caps_json: Vec<_> = caps
        .into_iter()
        .map(|c| {
            let attrs: serde_json::Map<String, serde_json::Value> = c
                .attrs
                .into_iter()
                .map(|(k, v)| (k, serde_json::Value::String(v)))
                .collect();
            json!({ "name": c.name, "attrs": attrs })
        })
        .collect();
    let out = json!({ "robot": robot, "capabilities": caps_json });
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

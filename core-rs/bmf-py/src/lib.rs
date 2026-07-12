//! Python bindings for bmf-core.
//!
//! Design choice: return JSON strings, decode on the Python side. Keeps the
//! FFI surface tiny — no PyDict marshalling per-call.

use ::bmf_core as core;
use pyo3::exceptions::PyValueError;
use pyo3::prelude::*;
use serde_json::json;

fn caps_to_json(caps: Vec<core::Capability>) -> Vec<serde_json::Value> {
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

fn robot_and_caps_json(robot: core::Robot) -> Result<String, serde_json::Error> {
    let caps = core::derive_capabilities(&robot);
    let out = json!({ "robot": robot, "capabilities": caps_to_json(caps) });
    serde_json::to_string(&out)
}

#[pyfunction]
fn parse_urdf(src: &str) -> PyResult<String> {
    let robot = core::parse_urdf(src).map_err(|e| PyValueError::new_err(e.to_string()))?;
    robot_and_caps_json(robot).map_err(|e| PyValueError::new_err(e.to_string()))
}

#[pyfunction]
fn parse_mjcf(src: &str) -> PyResult<String> {
    let robot = core::parse_mjcf(src).map_err(|e| PyValueError::new_err(e.to_string()))?;
    robot_and_caps_json(robot).map_err(|e| PyValueError::new_err(e.to_string()))
}

#[pyfunction]
fn parse_policy(bytes: &[u8]) -> PyResult<String> {
    let policy =
        core::parse_policy_bundle(bytes).map_err(|e| PyValueError::new_err(e.to_string()))?;
    let caps = core::derive_policy_capabilities(&policy);
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
    serde_json::to_string(&out).map_err(|e| PyValueError::new_err(e.to_string()))
}

#[pyfunction]
fn check_hardware_allowed(capabilities: Vec<String>) -> PyResult<String> {
    let caps: Vec<core::Capability> = capabilities.into_iter().map(core::Capability::new).collect();
    match core::assert_hardware_allowed(&caps) {
        Ok(()) => Ok(json!({ "allowed": true, "reason": null }).to_string()),
        Err(reason) => Ok(json!({ "allowed": false, "reason": reason }).to_string()),
    }
}

#[pymodule]
fn bmf_core(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(parse_urdf, m)?)?;
    m.add_function(wrap_pyfunction!(parse_mjcf, m)?)?;
    m.add_function(wrap_pyfunction!(parse_policy, m)?)?;
    m.add_function(wrap_pyfunction!(check_hardware_allowed, m)?)?;
    Ok(())
}

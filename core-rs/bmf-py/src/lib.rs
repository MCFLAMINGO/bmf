//! Python bindings for bmf-core.
//!
//! Design choice: return JSON strings, decode on the Python side. Keeps the
//! FFI surface tiny (str in, str out) — no PyDict marshalling per-call.
//! Python wrapper (bmf/__init__.py) does `json.loads` once.

use ::bmf_core as core;
use pyo3::exceptions::PyValueError;
use pyo3::prelude::*;
use serde_json::json;

/// Parse a URDF string and return `{"robot": ..., "capabilities": [...]}` as JSON.
///
/// Raises `ValueError` on parse errors — Rust `UrdfError` is not preserved as
/// a Python exception subclass; the error message stringifies faithfully.
fn robot_and_caps_json(robot: core::Robot) -> Result<String, serde_json::Error> {
    let caps = core::derive_capabilities(&robot);
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

#[pymodule]
fn bmf_core(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(parse_urdf, m)?)?;
    m.add_function(wrap_pyfunction!(parse_mjcf, m)?)?;
    Ok(())
}

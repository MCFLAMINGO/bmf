//! Policy bundle parser — LeRobot / BMF policy `.tar` / `.tar.zst`.
//!
//! Structural only: no weight loading, no inference.
//!
//! Bundle layout (scope §policy):
//!   manifest.json   — required for full obs/act/safety derivation
//!   config.json     — framework fingerprint (LeRobot: type=lerobot | act | …)
//!   model.safetensors / weights/ — opaque presence check
//!   train_config.json — optional LeRobot checkpoint fingerprint

use crate::capabilities::Capability;
use serde::Deserialize;
use serde_json::Value;
use std::collections::HashMap;
use std::io::{Cursor, Read};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum PolicyError {
    #[error("not a tar or zstd-compressed tar archive")]
    NotArchive,
    #[error("tar read error: {0}")]
    Tar(#[from] std::io::Error),
    #[error("missing required file `{0}` in policy bundle")]
    MissingFile(&'static str),
    #[error("invalid JSON in `{0}`: {1}")]
    Json(&'static str, String),
    #[error("bundle is not a recognized policy (no lerobot / framework fingerprint)")]
    Unrecognized,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Policy {
    pub framework: String,
    pub has_weights: bool,
    pub has_train_config: bool,
    pub observation: ObservationSpace,
    pub action: ActionSpace,
    pub safety: SafetyFlags,
    pub embodiment_targets: Vec<String>,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct ObservationSpace {
    pub rgb: bool,
    pub rgbd: bool,
    pub proprio: bool,
    pub tactile: bool,
    pub language: bool,
    pub wrist_camera: bool,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct ActionSpace {
    pub joint: bool,
    pub ee_pose: bool,
    pub gripper: bool,
    pub chunk_size: Option<u32>,
    pub control_hz: Option<u32>,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct SafetyFlags {
    pub sim_only: bool,
    pub dead_man: bool,
}

#[derive(Debug, Deserialize)]
struct ManifestFile {
    #[serde(default)]
    framework: Option<String>,
    #[serde(default)]
    observation_space: Option<Value>,
    #[serde(default)]
    action_space: Option<Value>,
    #[serde(default)]
    safety: Option<ManifestSafety>,
    #[serde(default)]
    embodiment: Option<ManifestEmbodiment>,
}

#[derive(Debug, Deserialize)]
struct ManifestSafety {
    #[serde(default)]
    sim_only: bool,
    #[serde(default)]
    dead_man: bool,
}

#[derive(Debug, Deserialize)]
struct ManifestEmbodiment {
    #[serde(default)]
    targets: Vec<String>,
}

const ZSTD_MAGIC: [u8; 4] = [0x28, 0xB5, 0x2F, 0xFD];

fn maybe_decompress(bytes: &[u8]) -> Result<Vec<u8>, PolicyError> {
    if bytes.len() >= 4 && bytes[0..4] == ZSTD_MAGIC {
        zstd::decode_all(Cursor::new(bytes)).map_err(|e| PolicyError::Tar(e))
    } else {
        Ok(bytes.to_vec())
    }
}

fn read_tar_files(bytes: &[u8]) -> Result<HashMap<String, Vec<u8>>, PolicyError> {
    let decompressed = maybe_decompress(bytes)?;
    // ustar magic at offset 257
    if decompressed.len() < 262 || &decompressed[257..262] != b"ustar" {
        // still try — some tars use different variants; fall through to Archive
    }
    let mut archive = tar::Archive::new(Cursor::new(decompressed));
    let mut files = HashMap::new();
    let entries = archive.entries().map_err(PolicyError::Tar)?;
    for entry in entries {
        let mut entry = entry.map_err(PolicyError::Tar)?;
        let path = entry.path().map_err(PolicyError::Tar)?.to_string_lossy().into_owned();
        // Normalize: strip leading ./ and take basename for nested packs
        let name = path.rsplit('/').next().unwrap_or(&path).to_string();
        if name.is_empty() || entry.header().entry_type().is_dir() {
            continue;
        }
        let mut buf = Vec::new();
        entry.read_to_end(&mut buf).map_err(PolicyError::Tar)?;
        files.insert(name, buf);
    }
    if files.is_empty() {
        return Err(PolicyError::NotArchive);
    }
    Ok(files)
}

fn parse_json_file(files: &HashMap<String, Vec<u8>>, name: &'static str) -> Result<Value, PolicyError> {
    let bytes = files
        .get(name)
        .ok_or(PolicyError::MissingFile(name))?;
    serde_json::from_slice(bytes).map_err(|e| PolicyError::Json(name, e.to_string()))
}

fn is_lerobot_config(config: &Value) -> bool {
    let ty = config.get("type").and_then(|v| v.as_str()).unwrap_or("");
    if ty.eq_ignore_ascii_case("lerobot") {
        return true;
    }
    // Real LeRobot policy configs use type = act | diffusion | vqbet | pi0 | …
    const LEROBOT_POLICY_TYPES: &[&str] = &[
        "act", "diffusion", "vqbet", "pi0", "pi0fast", "smolvla", "tdmpc", "sac", "vqbet",
    ];
    LEROBOT_POLICY_TYPES.iter().any(|t| ty.eq_ignore_ascii_case(t))
}

fn obs_from_manifest(v: Option<&Value>) -> ObservationSpace {
    let mut o = ObservationSpace::default();
    let Some(obs) = v else { return o };
    o.rgb = obs.get("rgb").is_some();
    o.rgbd = obs.get("rgbd").is_some();
    o.proprio = obs.get("proprio").is_some();
    o.tactile = obs.get("tactile").is_some();
    o.language = obs.get("language").is_some();
    if let Some(cams) = obs.pointer("/rgb/cameras").and_then(|c| c.as_array()) {
        o.wrist_camera = cams.iter().any(|c| {
            c.as_str()
                .map(|s| s.to_ascii_lowercase().contains("wrist"))
                .unwrap_or(false)
        });
    }
    o
}

fn act_from_manifest(v: Option<&Value>) -> ActionSpace {
    let mut a = ActionSpace::default();
    let Some(act) = v else { return a };
    a.joint = act.get("joint").is_some();
    a.ee_pose = act.get("ee_pose").is_some();
    a.gripper = act.get("gripper").is_some();
    a.chunk_size = act.get("chunk_size").and_then(|x| x.as_u64()).map(|n| n as u32);
    a.control_hz = act.get("control_hz").and_then(|x| x.as_u64()).map(|n| n as u32);
    a
}

/// Parse a policy bundle from `.tar` or `.tar.zst` bytes.
pub fn parse_policy_bundle(bytes: &[u8]) -> Result<Policy, PolicyError> {
    let files = read_tar_files(bytes)?;

    let has_weights = files.keys().any(|k| {
        k.ends_with(".safetensors") || k.ends_with(".pt") || k.ends_with(".pth") || k == "weights"
    });
    let has_train_config = files.contains_key("train_config.json");

    let config = files
        .get("config.json")
        .map(|b| serde_json::from_slice::<Value>(b))
        .transpose()
        .map_err(|e| PolicyError::Json("config.json", e.to_string()))?;

    let manifest: Option<ManifestFile> = if files.contains_key("manifest.json") {
        Some(
            serde_json::from_slice(files.get("manifest.json").unwrap())
                .map_err(|e| PolicyError::Json("manifest.json", e.to_string()))?,
        )
    } else {
        None
    };

    let lerobot = config.as_ref().map(is_lerobot_config).unwrap_or(false)
        || manifest
            .as_ref()
            .and_then(|m| m.framework.as_deref())
            .map(|f| f.eq_ignore_ascii_case("lerobot"))
            .unwrap_or(false);

    if !lerobot && manifest.as_ref().and_then(|m| m.framework.as_ref()).is_none() {
        return Err(PolicyError::Unrecognized);
    }

    let framework = manifest
        .as_ref()
        .and_then(|m| m.framework.clone())
        .unwrap_or_else(|| {
            if lerobot {
                "lerobot".into()
            } else {
                "custom".into()
            }
        });

    // Require config.json for lerobot fingerprint (scope rule).
    if framework.eq_ignore_ascii_case("lerobot") && config.is_none() {
        return Err(PolicyError::MissingFile("config.json"));
    }

    let observation = obs_from_manifest(manifest.as_ref().and_then(|m| m.observation_space.as_ref()));
    let action = act_from_manifest(manifest.as_ref().and_then(|m| m.action_space.as_ref()));
    let safety = manifest
        .as_ref()
        .and_then(|m| m.safety.as_ref())
        .map(|s| SafetyFlags {
            sim_only: s.sim_only,
            dead_man: s.dead_man,
        })
        .unwrap_or_default();
    let embodiment_targets = manifest
        .as_ref()
        .and_then(|m| m.embodiment.as_ref())
        .map(|e| e.targets.clone())
        .unwrap_or_default();

    // Touch parse_json to ensure train_config is valid JSON when present.
    if has_train_config {
        let _ = parse_json_file(&files, "train_config.json")?;
    }

    Ok(Policy {
        framework,
        has_weights,
        has_train_config,
        observation,
        action,
        safety,
        embodiment_targets,
    })
}

/// Derive verified policy.* / safety.* capabilities from a parsed policy.
pub fn derive_policy_capabilities(policy: &Policy) -> Vec<Capability> {
    let mut caps = Vec::new();

    if policy.framework.eq_ignore_ascii_case("lerobot") {
        caps.push(Capability::new("policy.framework.lerobot"));
    } else if !policy.framework.is_empty() {
        // Unknown frameworks stay declared-only at the manifest layer; we only
        // emit verified caps we can fingerprint. Custom/openvla/etc. land later.
    }

    if policy.observation.rgb {
        caps.push(Capability::new("policy.obs.rgb"));
    }
    if policy.observation.wrist_camera {
        caps.push(Capability::new("policy.obs.rgb.wrist"));
    }
    if policy.observation.rgbd {
        caps.push(Capability::new("policy.obs.rgbd"));
    }
    if policy.observation.proprio {
        caps.push(Capability::new("policy.obs.proprio"));
    }
    if policy.observation.tactile {
        caps.push(Capability::new("policy.obs.tactile"));
    }
    if policy.observation.language {
        caps.push(Capability::new("policy.obs.language"));
    }

    if policy.action.joint {
        caps.push(Capability::new("policy.act.joint"));
    }
    if policy.action.ee_pose {
        caps.push(Capability::new("policy.act.ee_pose"));
    }
    if policy.action.gripper {
        caps.push(Capability::new("policy.act.gripper"));
    }
    if let Some(n) = policy.action.chunk_size {
        caps.push(Capability::with("policy.act.chunk_size", "n", n.to_string()));
    }
    if let Some(hz) = policy.action.control_hz {
        caps.push(Capability::with("policy.act.control_hz", "hz", hz.to_string()));
    }

    if policy.embodiment_targets.iter().any(|t| t == "arm") {
        caps.push(Capability::new("policy.embodiment.arm"));
    }

    if policy.safety.sim_only {
        caps.push(Capability::new("safety.simonly"));
    }
    if policy.safety.dead_man {
        caps.push(Capability::new("safety.dead_man"));
    }

    caps
}

/// Hardware gate: refuse when `safety.simonly` is present.
/// Returns `Ok(())` if hardware execution is allowed.
pub fn assert_hardware_allowed(caps: &[Capability]) -> Result<(), String> {
    if caps.iter().any(|c| c.name == "safety.simonly") {
        Err(
            "BMF refusal: capability safety.simonly — this policy MUST NOT run on physical hardware"
                .into(),
        )
    } else {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn fixture_tar() -> Vec<u8> {
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../spec/examples");
        let zst = root.join("lerobot_so100_act.tar.zst");
        let tar = root.join("lerobot_so100_act.tar");
        if zst.exists() {
            std::fs::read(zst).unwrap()
        } else {
            std::fs::read(tar).expect("lerobot_so100_act.tar fixture missing")
        }
    }

    #[test]
    fn lerobot_fixture_derives_framework_and_simonly() {
        let policy = parse_policy_bundle(&fixture_tar()).expect("parse");
        assert_eq!(policy.framework, "lerobot");
        assert!(policy.safety.sim_only);
        assert!(policy.has_weights);
        let caps = derive_policy_capabilities(&policy);
        let names: Vec<_> = caps.iter().map(|c| c.name.as_str()).collect();
        assert!(names.contains(&"policy.framework.lerobot"));
        assert!(names.contains(&"policy.obs.rgb"));
        assert!(names.contains(&"policy.obs.proprio"));
        assert!(names.contains(&"policy.act.joint"));
        assert!(names.contains(&"policy.act.gripper"));
        assert!(names.contains(&"safety.simonly"));
        assert!(names.contains(&"safety.dead_man"));
        assert!(assert_hardware_allowed(&caps).is_err());
    }
}

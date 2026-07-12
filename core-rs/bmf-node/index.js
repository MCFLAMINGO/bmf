// SPDX-License-Identifier: Apache-2.0
// Loads the Rust bmf-core napi addon. This package IS the robotics verifier —
// kin.* derivation lives in Rust (bmf-core), not in TypeScript.

"use strict";

const { existsSync } = require("node:fs");
const { join } = require("node:path");

const candidates = [
  join(__dirname, "bmf_node.node"),
  // Local cargo output (monorepo / build-from-source).
  join(__dirname, "../target/release/bmf_node.node"),
  join(__dirname, "../target/debug/bmf_node.node"),
];

let binding = null;
let loadError = null;

for (const path of candidates) {
  if (!existsSync(path)) continue;
  try {
    binding = require(path);
    break;
  } catch (err) {
    loadError = err;
  }
}

if (!binding) {
  const hint =
    "Build the Rust addon: `cd core-rs && cargo build -p bmf-node --release && " +
    "cp target/release/libbmf_node.so bmf-node/bmf_node.node` " +
    "(on macOS use .dylib → bmf_node.node; on Windows .dll).";
  const err = new Error(
    `@mcflamingo/bmf-node: native addon not found. ${hint}` +
      (loadError ? ` Last error: ${loadError.message}` : ""),
  );
  err.code = "BMF_NATIVE_MISSING";
  throw err;
}

module.exports = binding;

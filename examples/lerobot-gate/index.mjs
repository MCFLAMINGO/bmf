#!/usr/bin/env node
// LeRobot fleet-gate demo: verify a policy bundle, refuse on hardware when
// safety.simonly is present. This is the "2-minute" sales artifact.
//
//   node examples/lerobot-gate/index.mjs
//   node examples/lerobot-gate/index.mjs --sim

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  checkHardwareAllowed,
  deriveCapabilities,
  hasCapability,
} from "@mcflamingo/bmf-sdk";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const bundle = resolve(root, "spec/examples/lerobot_so100_act.tar.zst");
const mode = process.argv.includes("--sim") ? "sim" : "hardware";

const bytes = new Uint8Array(await readFile(bundle));
const caps = deriveCapabilities("policy", bytes);

console.log("bundle:", bundle);
console.log("capabilities:");
for (const c of caps) console.log(" ", c);

if (!hasCapability({ capabilities: caps }, "policy.framework.lerobot")) {
  console.error("FAIL: expected policy.framework.lerobot");
  process.exit(1);
}

if (mode === "sim") {
  console.log("\nmode: sim — OK to evaluate offline");
  process.exit(0);
}

const gate = checkHardwareAllowed(caps);
console.log("\nmode: hardware");
if (gate.allowed) {
  console.log("ALLOWED — would execute on robot");
  process.exit(0);
}
console.log("REFUSED —", gate.reason);
console.log(
  "refusal_record:",
  JSON.stringify(
    {
      bmf_refusal_version: "0.2.0",
      capability: "safety.simonly",
      reason: gate.reason,
      at: new Date().toISOString(),
    },
    null,
    2,
  ),
);
process.exit(1);

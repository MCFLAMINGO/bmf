#!/usr/bin/env node
// Smoke: parse SO-100 URDF + Go2 MJCF via Rust bindings.
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../../..");
const require = createRequire(import.meta.url);
const nodePath = join(here, "../bmf_node.node");

if (!existsSync(nodePath)) {
  console.error("bmf_node.node missing — run npm run build first");
  process.exit(1);
}

const native = require(nodePath);
const so100 = readFileSync(join(root, "spec/examples/so100.urdf"), "utf8");
const go2 = readFileSync(join(root, "spec/examples/unitree_go2.mjcf"), "utf8");
const policyPath = existsSync(join(root, "spec/examples/lerobot_so100_act.tar.zst"))
  ? join(root, "spec/examples/lerobot_so100_act.tar.zst")
  : join(root, "spec/examples/lerobot_so100_act.tar");

const urdf = JSON.parse(native.parseUrdf(so100));
const mjcf = JSON.parse(native.parseMjcf(go2));
const urdfNames = urdf.capabilities.map((c) => c.name);
const mjcfNames = mjcf.capabilities.map((c) => c.name);

if (!urdfNames.includes("kin.urdf") || !urdfNames.includes("kin.arm")) {
  console.error("FAIL so100", urdfNames);
  process.exit(1);
}
if (!mjcfNames.includes("kin.mjcf") || !mjcfNames.includes("kin.legged.quadruped")) {
  console.error("FAIL go2", mjcfNames);
  process.exit(1);
}

const policyBytes = readFileSync(policyPath);
const policy = JSON.parse(native.parsePolicy(policyBytes));
const policyNames = policy.capabilities.map((c) => c.name);
if (!policyNames.includes("policy.framework.lerobot") || !policyNames.includes("safety.simonly")) {
  console.error("FAIL policy", policyNames);
  process.exit(1);
}
const gate = JSON.parse(native.checkHardwareAllowed(policyNames));
if (gate.allowed) {
  console.error("FAIL expected hardware refusal", gate);
  process.exit(1);
}
console.log("bmf-node smoke: PASS", { urdf: urdfNames, mjcf: mjcfNames, policy: policyNames, gate });

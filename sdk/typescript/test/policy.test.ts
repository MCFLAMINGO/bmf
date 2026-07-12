// SPDX-License-Identifier: Apache-2.0
// LeRobot policy bundle derivation + hardware gate.

import { ok } from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  checkHardwareAllowed,
  deriveCapabilities,
  loadNative,
  sniffPolicyBundle,
} from "../src/index.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const zst = resolve(root, "spec/examples/lerobot_so100_act.tar.zst");
const tar = resolve(root, "spec/examples/lerobot_so100_act.tar");
const nativeNode = resolve(root, "core-rs/bmf-node/bmf_node.node");

test("sniffPolicyBundle detects tar and zstd", () => {
  const bytes = new Uint8Array(readFileSync(existsSync(zst) ? zst : tar));
  ok(sniffPolicyBundle(bytes));
});

test("deriveCapabilities on LeRobot fixture via Rust", (t) => {
  if (!existsSync(nativeNode) || !loadNative()?.parsePolicy) {
    t.skip("bmf_node.node without parsePolicy — rebuild native");
    return;
  }
  const bytes = new Uint8Array(readFileSync(existsSync(zst) ? zst : tar));
  const caps = deriveCapabilities("policy", bytes);
  ok(caps.includes("policy.framework.lerobot"), String(caps));
  ok(caps.includes("policy.obs.rgb"));
  ok(caps.includes("policy.act.joint"));
  ok(caps.includes("safety.simonly"));
  const gate = checkHardwareAllowed(caps);
  ok(!gate.allowed);
  ok(gate.reason && gate.reason.includes("simonly"));
});

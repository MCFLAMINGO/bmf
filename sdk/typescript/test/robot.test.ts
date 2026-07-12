// SPDX-License-Identifier: Apache-2.0
// Day 3 — URDF/MJCF derivation via optional bmf-node native addon.

import { deepStrictEqual, ok } from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  deriveCapabilities,
  loadNative,
  sniffRobotKind,
  verifyRobotDescriptor,
} from "../src/index.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const so100 = resolve(root, "spec/examples/so100.urdf");
const go2 = resolve(root, "spec/examples/unitree_go2.mjcf");
const nativeNode = resolve(root, "core-rs/target/release/bmf_node.node");

test("sniffRobotKind distinguishes urdf vs mjcf", () => {
  if (!existsSync(so100) || !existsSync(go2)) return;
  const urdf = new Uint8Array(readFileSync(so100));
  const mjcf = new Uint8Array(readFileSync(go2));
  deepStrictEqual(sniffRobotKind(urdf), "urdf");
  deepStrictEqual(sniffRobotKind(mjcf), "mjcf");
  deepStrictEqual(sniffRobotKind(new Uint8Array([1, 2, 3])), null);
});

test("deriveCapabilities on SO-100 URDF via native core", (t) => {
  if (!existsSync(nativeNode) || !loadNative()) {
    t.skip("bmf_node.node not built — run: cargo build -p bmf-node --release && cp target/release/libbmf_node.so target/release/bmf_node.node");
    return;
  }
  const bytes = new Uint8Array(readFileSync(so100));
  const caps = deriveCapabilities("urdf", bytes);
  ok(caps.includes("kin.urdf"), `expected kin.urdf in ${caps}`);
  ok(caps.includes("kin.arm"), `expected kin.arm in ${caps}`);
  ok(caps.some((c) => c.startsWith("kin.dof.arm=")), `expected kin.dof.arm=N in ${caps}`);
  ok(caps.includes("safety.workspace.limits"));
});

test("verifyRobotDescriptor on Unitree Go2 MJCF", (t) => {
  if (!existsSync(nativeNode) || !loadNative()) {
    t.skip("bmf_node.node not built");
    return;
  }
  const bytes = new Uint8Array(readFileSync(go2));
  const caps = verifyRobotDescriptor(bytes);
  ok(caps.includes("kin.mjcf"), `expected kin.mjcf in ${caps}`);
  ok(caps.includes("kin.legged.quadruped"), `expected quadruped in ${caps}`);
  ok(caps.includes("kin.mobile"));
});

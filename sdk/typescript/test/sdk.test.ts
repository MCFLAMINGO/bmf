// SPDX-License-Identifier: Apache-2.0
// @mcflamingo/bmf-sdk — integration tests for the public API.

import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import {
  BMF_VERSION,
  assetHash,
  assertValidRoyaltyChain,
  canonicalize,
  deriveCapabilities,
  hasCapability,
  keygen,
  mintBmfUri,
  parseBmfUri,
  signManifest,
  verifyManifest,
  type UnsignedManifest,
} from "../src/index.js";

test("canonicalize sorts keys deterministically", () => {
  const a = canonicalize({ b: 1, a: [{ y: 2, x: 1 }] });
  const b = canonicalize({ a: [{ x: 1, y: 2 }], b: 1 });
  strictEqual(a, b);
  strictEqual(a, '{"a":[{"x":1,"y":2}],"b":1}');
});

test("canonicalize drops undefined but keeps null", () => {
  strictEqual(canonicalize({ a: undefined, b: null }), '{"b":null}');
});

test("assetHash treats Buffer, Uint8Array, and ArrayBuffer identically", async () => {
  // Node's Buffer allocates out of a shared pool, so `buf.buffer` is often
  // an 8 KB slab and `buf.byteOffset` > 0. This regression-guards that
  // sha256Hex hashes exactly `bytes.byteLength` bytes starting at
  // `bytes.byteOffset`, not the whole slab.
  const raw = new Uint8Array([1, 2, 3, 4, 5]);
  const buf = Buffer.from(raw);
  ok(buf.byteOffset > 0 || buf.buffer.byteLength > buf.byteLength);
  const hRaw = await assetHash(raw);
  const hBuf = await assetHash(buf);
  const hAb = await assetHash(raw.slice().buffer);
  strictEqual(hBuf, hRaw);
  strictEqual(hAb, hRaw);
});

test("assetHash matches SHA-256 of bytes", async () => {
  const bytes = new TextEncoder().encode("hello");
  const h = await assetHash(bytes);
  strictEqual(h, "sha256:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
});

test("mint + parse BMF URI round-trip", () => {
  const uri = mintBmfUri("gateway.example", "arthur/v1", "sha256:6b4836d2e7097420cd116fe15372695f583327ba82538be096b23fb9bb6f9f72");
  strictEqual(uri, "bmf://gateway.example/asset/arthur-v1-6b4836d2");
  deepStrictEqual(parseBmfUri(uri), { gateway: "gateway.example", id: "arthur-v1-6b4836d2" });
});

test("sign + verify round-trip", async () => {
  const { privateKey } = await keygen();
  const unsigned: UnsignedManifest = {
    bmf: BMF_VERSION,
    id: "bmf://gateway.example/asset/test-abc123",
    kind: "glb",
    mime: "model/gltf-binary",
    bytes: 42,
    asset_hash: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
    capabilities: ["humanoid.mixamo24"],
    provenance: [],
    royalty_chain: [{ recipient: "did:example:me", share_bps: 10000 }],
    issued_at: "2026-07-10T18:44:00.000Z",
    expires_at: null,
  };
  const signed = await signManifest(unsigned, privateKey);
  ok(await verifyManifest(signed), "signature must verify");

  // Tamper detection: flip one capability.
  const tampered = { ...signed, capabilities: ["humanoid.vrm"] };
  strictEqual(await verifyManifest(tampered), false, "tampered manifest must NOT verify");
});

test("royalty chain must sum to 10000", () => {
  assertValidRoyaltyChain([{ recipient: "a", share_bps: 6000 }, { recipient: "b", share_bps: 4000 }]);
  try {
    assertValidRoyaltyChain([{ recipient: "a", share_bps: 5000 }]);
    ok(false, "should have thrown");
  } catch (e) {
    ok(e instanceof Error && e.message.includes("10000"));
  }
});

test("hasCapability accepts verified and declared forms", () => {
  const m = { capabilities: ["anim.wave", "face.arkit52!"] };
  ok(hasCapability(m, "anim.wave"));
  ok(hasCapability(m, "face.arkit52"));
  ok(!hasCapability(m, "anim.crouch"));
});

test("deriveCapabilities returns [] for dataset stub", () => {
  deepStrictEqual(deriveCapabilities("dataset", new Uint8Array()), []);
});

test("deriveCapabilities on a synthetic humanoid GLB", () => {
  // Build a minimal GLB with a JSON chunk that declares a humanoid skeleton.
  const gltf = {
    asset: { version: "2.0" },
    nodes: [
      { name: "mixamorig:Hips" },        // 0
      { name: "mixamorig:Spine" },       // 1
      { name: "mixamorig:Neck" },        // 2
      { name: "mixamorig:Head" },        // 3
      { name: "mixamorig:LeftArm" },     // 4
      { name: "mixamorig:LeftForeArm" }, // 5
      { name: "mixamorig:LeftHand" },    // 6
      { name: "mixamorig:RightArm" },    // 7
      { name: "mixamorig:RightForeArm" },// 8
      { name: "mixamorig:RightHand" },   // 9
      { name: "mixamorig:LeftUpLeg" },   // 10
      { name: "mixamorig:LeftLeg" },     // 11
      { name: "mixamorig:LeftFoot" },    // 12
      { name: "mixamorig:RightUpLeg" },  // 13
      { name: "mixamorig:RightLeg" },    // 14
      { name: "mixamorig:RightFoot" },   // 15
      ...Array.from({ length: 24 }, (_, i) => ({ name: `filler_${i}` })), // pad to 40 nodes
    ],
    skins: [{ joints: Array.from({ length: 40 }, (_, i) => i) }],
    meshes: [{ primitives: [{ attributes: {} }] }],
  };
  const json = JSON.stringify(gltf);
  const jsonPadded = json + " ".repeat((4 - (json.length % 4)) % 4);
  const jsonBytes = new TextEncoder().encode(jsonPadded);
  const total = 12 + 8 + jsonBytes.length;
  const buf = new Uint8Array(total);
  const view = new DataView(buf.buffer);
  view.setUint32(0, 0x46546c67, true);       // magic "glTF"
  view.setUint32(4, 2, true);                // version
  view.setUint32(8, total, true);            // total length
  view.setUint32(12, jsonBytes.length, true);// chunk length
  view.setUint32(16, 0x4e4f534a, true);      // chunk type "JSON"
  buf.set(jsonBytes, 20);

  const caps = deriveCapabilities("glb", buf);
  ok(caps.includes("humanoid.mixamo24"), `expected humanoid.mixamo24 in ${caps}`);
  ok(caps.includes("mesh.singleroot"));
  ok(caps.includes("anim.gaze"));
  ok(caps.includes("anim.wave"));
  ok(caps.includes("anim.crouch"));
  ok(caps.includes("anim.locomotion"));
  ok(caps.includes("anim.breathe"));
  ok(caps.includes("phys.muscle"), `expected phys.muscle in ${caps}`);
  ok(caps.includes("phys.stance"), `expected phys.stance in ${caps}`);
  ok(caps.includes("phys.jump"), `expected phys.jump in ${caps}`);
});

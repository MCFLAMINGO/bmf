// SPDX-License-Identifier: Apache-2.0
// Smoke test the CLI: generate a synthetic humanoid GLB, sign it, verify it.
import { writeFile, readFile, mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const tmp = join(here, ".smoke");
await mkdir(tmp, { recursive: true });

// ── Build a minimal Mixamo-named GLB (16 humanoid joints + padding to 40). ──
const gltf = {
  asset: { version: "2.0" },
  nodes: [
    { name: "mixamorig:Hips" }, { name: "mixamorig:Spine" },
    { name: "mixamorig:Neck" }, { name: "mixamorig:Head" },
    { name: "mixamorig:LeftArm" }, { name: "mixamorig:LeftForeArm" }, { name: "mixamorig:LeftHand" },
    { name: "mixamorig:RightArm" }, { name: "mixamorig:RightForeArm" }, { name: "mixamorig:RightHand" },
    { name: "mixamorig:LeftUpLeg" }, { name: "mixamorig:LeftLeg" }, { name: "mixamorig:LeftFoot" },
    { name: "mixamorig:RightUpLeg" }, { name: "mixamorig:RightLeg" }, { name: "mixamorig:RightFoot" },
    ...Array.from({ length: 24 }, (_, i) => ({ name: `filler_${i}` })),
  ],
  skins: [{ joints: Array.from({ length: 40 }, (_, i) => i) }],
  meshes: [{ primitives: [{ attributes: {} }] }],
};
const json = JSON.stringify(gltf);
const padded = json + " ".repeat((4 - (json.length % 4)) % 4);
const jsonBytes = new TextEncoder().encode(padded);
const total = 12 + 8 + jsonBytes.length;
const buf = new Uint8Array(total);
const view = new DataView(buf.buffer);
view.setUint32(0, 0x46546c67, true);
view.setUint32(4, 2, true);
view.setUint32(8, total, true);
view.setUint32(12, jsonBytes.length, true);
view.setUint32(16, 0x4e4f534a, true);
buf.set(jsonBytes, 20);

const glbPath = join(tmp, "arthur.glb");
const manifestPath = join(tmp, "arthur.glb.bmf.json");
await writeFile(glbPath, buf);

const bin = join(here, "..", "dist", "bin.js");
function run(...args) {
  const r = spawnSync("node", [bin, ...args], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`bmf ${args.join(" ")} exited ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`);
  return r;
}

// ── Sign ──
const signOut = run("sign", glbPath, "--producer", "did:example:test", "--gateway", "test.local");
if (!signOut.stdout.includes("humanoid.mixamo24")) throw new Error(`sign did not derive capabilities:\n${signOut.stdout}`);
if (!signOut.stdout.includes("anim.locomotion")) throw new Error(`sign missing anim.locomotion:\n${signOut.stdout}`);

// ── Verify ──
const verifyOut = run("verify", glbPath, manifestPath);
if (!verifyOut.stdout.includes("OK — manifest verifies.")) throw new Error(`verify did not pass:\n${verifyOut.stdout}`);

// ── Inspect ──
const inspectOut = run("inspect", manifestPath);
const parsed = JSON.parse(inspectOut.stdout.split("\n\n")[0]);
if (parsed.bmf !== "0.2.0") throw new Error(`inspect returned wrong version: ${parsed.bmf}`);
if (!parsed.capabilities.includes("anim.wave")) throw new Error(`inspect missing anim.wave`);

// ── Tamper detection ──
const tampered = { ...parsed, capabilities: [...parsed.capabilities, "safety.simonly"] };
await writeFile(manifestPath, JSON.stringify(tampered));
const tamperCheck = spawnSync("node", [bin, "verify", glbPath, manifestPath], { encoding: "utf8" });
if (tamperCheck.status === 0) throw new Error(`tampered manifest should have failed verification`);
if (!tamperCheck.stdout.includes("FAIL")) throw new Error(`tamper verify missing FAIL marker`);

console.log("cli smoke: PASS (sign, verify, inspect, tamper-detect)");

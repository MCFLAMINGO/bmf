// SPDX-License-Identifier: Apache-2.0
// End-to-end smoke test for @mcflamingo/bmf-gateway.
// Starts the server on a random port, uploads a synthetic humanoid GLB via
// prepare/chunk/finalize, resolves the manifest, fetches the asset, verifies
// signature + asset_hash. Then tears down.

import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, unlinkSync } from "node:fs";
import { verifyManifest, assetHash } from "@mcflamingo/bmf-sdk";

const here = dirname(fileURLToPath(import.meta.url));
const bin = join(here, "..", "dist", "server.js");

const PORT = 18000 + Math.floor(Math.random() * 1000);
const DB = join(here, `.smoke-${PORT}.db`);
const KEY = join(here, `.smoke-${PORT}.key`);
for (const p of [DB, DB + "-wal", DB + "-shm", KEY]) if (existsSync(p)) unlinkSync(p);

const server = spawn("node", [bin], {
  env: { ...process.env, PORT: String(PORT), BMF_DB: DB, BMF_KEY: KEY, BMF_PUBLIC_HOST: `localhost:${PORT}` },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverLog = "";
server.stdout.on("data", (d) => (serverLog += d));
server.stderr.on("data", (d) => (serverLog += d));

async function waitForReady() {
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`http://localhost:${PORT}/.well-known/bmf.json`);
      if (r.ok) return;
    } catch {}
    await sleep(50);
  }
  throw new Error(`gateway did not start:\n${serverLog}`);
}

function synthGlb() {
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
  return buf;
}

async function main() {
  await waitForReady();
  const base = `http://localhost:${PORT}`;

  // discovery
  const disc = await (await fetch(`${base}/.well-known/bmf.json`)).json();
  if (disc.bmf !== "0.2.0") throw new Error(`discovery bmf version: ${disc.bmf}`);
  const caps = await (await fetch(`${base}/bmf/v1/capabilities`)).json();
  if (!caps.verified.includes("anim.wave")) throw new Error("capabilities missing anim.wave");

  // prepare
  const prep = await (await fetch(`${base}/bmf/v1/prepare`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind: "glb", mime: "model/gltf-binary", slug: "arthur", producer: "did:example:test" }),
  })).json();
  if (!prep.upload_id) throw new Error(`prepare failed: ${JSON.stringify(prep)}`);

  // chunk
  const bytes = synthGlb();
  const chunkRes = await fetch(`${base}/bmf/v1/chunk?upload_id=${prep.upload_id}&index=0`, {
    method: "POST", headers: { "content-type": "application/octet-stream" }, body: bytes,
  });
  if (!chunkRes.ok) throw new Error(`chunk failed: ${chunkRes.status}`);

  // finalize
  const fin = await (await fetch(`${base}/bmf/v1/finalize`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ upload_id: prep.upload_id }),
  })).json();
  const manifest = fin.manifest;
  if (!manifest || !manifest.signature) throw new Error(`finalize returned no manifest: ${JSON.stringify(fin)}`);
  if (!manifest.capabilities.includes("anim.wave")) throw new Error(`manifest missing anim.wave: ${manifest.capabilities}`);
  if (!(await verifyManifest(manifest))) throw new Error("signature verification failed");

  // resolve + asset fetch
  const id = manifest.id.split("/").pop();
  const resolved = await (await fetch(`${base}/bmf/v1/resolve/asset/${id}`)).json();
  if (resolved.signature.value !== manifest.signature.value) throw new Error("resolve returned different manifest");
  const assetBytes = new Uint8Array(await (await fetch(`${base}/api/asset/glb/${id}`)).arrayBuffer());
  const hash = await assetHash(assetBytes);
  if (hash !== manifest.asset_hash) throw new Error(`asset hash mismatch: ${hash} vs ${manifest.asset_hash}`);

  console.log("gateway smoke: PASS (discovery, capabilities, prepare/chunk/finalize, resolve, asset fetch, verify, hash-match)");
}

main().catch((e) => {
  console.error("gateway smoke: FAIL", e);
  console.error("--- server log ---\n" + serverLog);
  process.exitCode = 1;
}).finally(() => {
  server.kill("SIGTERM");
  for (const p of [DB, DB + "-wal", DB + "-shm", KEY]) if (existsSync(p)) try { unlinkSync(p); } catch {}
});

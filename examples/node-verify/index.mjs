// SPDX-License-Identifier: Apache-2.0
// Minimal BMF verifier: given a bmf:// URI (or http(s) manifest URL),
// fetch, verify signature, verify asset_hash, print capabilities.

import { loadManifest, hasCapability } from "@mcflamingo/bmf-sdk";

const uri = process.argv[2];
if (!uri) {
  console.error("usage: node index.mjs <bmf-uri | https://.../manifest.bmf.json>");
  process.exit(2);
}

const { manifest, verified, bytes } = await loadManifest(uri, { fetchBytes: true });

console.log(`id:           ${manifest.id}`);
console.log(`kind:         ${manifest.kind}`);
console.log(`bytes:        ${manifest.bytes}${bytes ? ` (fetched ${bytes.byteLength})` : ""}`);
console.log(`signature:    ${verified ? "OK" : "FAIL"}`);
console.log(`capabilities: ${manifest.capabilities.join(", ")}`);
console.log("");
console.log(`hasCapability('anim.wave'):     ${hasCapability(manifest, "anim.wave")}`);
console.log(`hasCapability('safety.simonly'): ${hasCapability(manifest, "safety.simonly")}`);

process.exit(verified ? 0 : 1);

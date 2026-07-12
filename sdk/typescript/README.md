# @mcflamingo/bmf-sdk

TypeScript SDK for the [BMF](https://github.com/MCFLAMINGO/bmf) manifest format. Sign, verify, canonicalize, and derive capabilities for embodied assets.

## Install

```bash
npm install @mcflamingo/bmf-sdk
```

Runs on Node 20+, Deno, Bun, Cloudflare Workers, and modern browsers. One runtime dep: [`@noble/ed25519`](https://www.npmjs.com/package/@noble/ed25519).

## Verify a signed manifest

```ts
import { loadManifest, hasCapability } from "@mcflamingo/bmf-sdk";

const { manifest, verified } = await loadManifest("bmf://wildwallet.ai/asset/arthur-6b4836d2");
if (!verified) throw new Error("BMF verification failed");

if (hasCapability(manifest, "anim.wave")) enableWaveBehavior();
if (hasCapability(manifest, "safety.simonly")) refuseToRunOnHardware();
```

`loadManifest` fetches the manifest, verifies the Ed25519 signature, fetches the asset bytes, and checks the SHA-256 matches. `verified: true` means every claim in the manifest binds to actual bytes.

## Sign your own manifest

```ts
import { assetHash, deriveCapabilities, keygen, mintBmfUri, signManifest } from "@mcflamingo/bmf-sdk";
import { readFile } from "node:fs/promises";

const bytes = new Uint8Array(await readFile("./arthur.glb"));
const { privateKey } = await keygen();

const hash = await assetHash(bytes);
const caps = deriveCapabilities("glb", bytes);

const signed = await signManifest({
  bmf: "0.2.0",
  id: mintBmfUri("gateway.example", "arthur", hash),
  kind: "glb",
  mime: "model/gltf-binary",
  bytes: bytes.byteLength,
  asset_hash: hash,
  capabilities: caps,
  provenance: [{ step: "source", source: "meshy://model/abc", notes: "generated" }],
  royalty_chain: [{ recipient: "did:example:me", share_bps: 10000 }],
  issued_at: new Date().toISOString(),
  expires_at: null,
}, privateKey);

console.log(JSON.stringify(signed, null, 2));
```

## Public API

| Export | Purpose |
|---|---|
| `canonicalize(v)` | Deterministic JCS-subset JSON for signing. |
| `sha256Hex(bytes)` / `assetHash(bytes)` | SHA-256 helpers. |
| `keygen()` | Fresh Ed25519 keypair. |
| `signManifest(unsigned, privateKey)` | Sign a manifest. |
| `verifyManifest(manifest)` | Verify the Ed25519 signature. |
| `deriveCapabilities(kind, bytes)` | Verified capability set from bytes. |
| `hasCapability(manifest, cap)` | Membership check accepting `cap` or `cap!`. |
| `assertValidRoyaltyChain(chain)` | Enforce shares sum to 10000. |
| `mintBmfUri(gateway, slug, hash)` / `parseBmfUri(uri)` | URI helpers. |
| `loadManifest(uri, opts?)` | Fetch + verify manifest and bytes over HTTP. |
| `inspectGlb(bytes)` / `deriveGlbCapabilities(landmarks)` | Low-level GLB primitives (incl. `phys.*`). |
| `verifyRobotDescriptor(bytes)` | Sniff URDF/MJCF and derive `kin.*` via optional Rust `bmf-node`. |
| `loadNative()` | Load `bmf-node` if built; otherwise `null`. |

GLB derivation grants `phys.muscle` / `phys.stance` / `phys.jump` when full leg-chain landmarks are present. URDF/MJCF derivation requires a local `bmf_node.node` (see `docs/HANDOFF-2.0.md`); without it those kinds return `[]`.

## License

Apache-2.0.

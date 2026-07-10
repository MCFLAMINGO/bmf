# BMF — Bake Manifest Format

**A signed, content-addressed manifest format for embodied assets — 3D characters, robot policies, URDF/MJCF rigs, teleop datasets. One spec, one verifier, one royalty chain.**

Every embodied asset your app or robot loads today — a Meshy character, a LeRobot policy checkpoint, a URDF, a teleop trajectory — is unsigned bytes at a URL. You have no way to prove it wasn't swapped. No royalty chain for the creator or data provider. No way to know before you load 500 MB of weights whether that policy expects RGB or RGB-D, joint targets or end-effector pose, or whether it's simulation-only.

BMF fixes that in one signed JSON.

```json
{
  "bmf": "0.1.0",
  "id": "bmf://gateway.example/asset/policy-6b48",
  "kind": "policy",
  "asset_hash": "sha256:6b4836d2e7097420cd116fe15372695f583327ba82538be096b23fb9bb6f9f72",
  "capabilities": [
    "policy.framework.lerobot",
    "policy.obs.rgb", "policy.obs.proprio",
    "policy.act.joint",
    "kin.dof.7", "kin.gripper.parallel",
    "skill.pick_place",
    "safety.simonly"
  ],
  "provenance": [
    { "step": "train", "source": "bmf://hf.co/asset/openvla-7b", "notes": "fine-tuned on 47 demos" }
  ],
  "royalty_chain": [
    { "recipient": "did:example:trainer", "share_bps": 7000 },
    { "recipient": "did:example:datalab", "share_bps": 2000 },
    { "recipient": "did:bmf:platform",    "share_bps": 1000 }
  ],
  "signature": {
    "alg": "ed25519",
    "public_key": "base64url:pMd2WfkY9xC8LOxAnbnyuWXr_ctu0LRCZV0CcnUmdBU",
    "value": "base64url:xZ9I2XYZ..."
  }
}
```

## Why this matters

- **Signed & content-addressed.** Every asset gets a `bmf://<gateway>/asset/<slug>-<hash8>` URI derived from the SHA-256 of its bytes. The manifest is Ed25519-signed by the gateway. A downstream consumer — a game engine, a robot controller, a fleet manager — can prove bytes match claims before loading.
- **Capability contracts.** Capabilities like `anim.wave`, `kin.dof.7`, `policy.obs.rgb`, `skill.pick_place` are stamped by the gateway from the actual bytes — not declared by the uploader. Consumers read the capability set and enable exactly the behaviors the asset supports. No per-asset branches.
- **Safety as a signed claim.** `safety.simonly`, `safety.workspace.limits`, `safety.dead_man` are first-class. A fleet controller can refuse to load a policy onto hardware when the required safety capability is missing. That's a category no competing format has.
- **Royalty chain.** Every derivative pays the original creator and data providers. Shares sum to 10 000 basis points. Enforced by the spec.
- **Paywall-ready.** Assets can be listed with x402 price challenges — pay-per-fetch for policies, datasets, or premium characters. No bespoke commerce layer.
- **Zero-lockin.** BMF is a spec plus reference implementations. Runs on any HTTP gateway. SDK verifies manifests without a server round-trip.

## What BMF handles

BMF `kind` field is open-ended. The reference implementation ships validators for these at 0.1.0:

| Kind | Bytes | Capability namespaces derived | Status |
|---|---|---|---|
| `glb` | glTF 2.0 binary | `humanoid.*`, `mesh.*`, `anim.*`, `face.*` | shipped, in production at [wildwallet.ai](https://wildwallet.ai) |
| `urdf` | Unified Robot Description Format XML | `kin.*` | 0.2.0 (validator stubbed) |
| `mjcf` | MuJoCo XML | `kin.*` | 0.2.0 |
| `policy` | Framework-specific checkpoint (LeRobot, OpenVLA, RT-2, custom) | `policy.*`, `skill.*` | 0.2.0 |
| `dataset` | Bundled demonstrations (LeRobot / RLDS / custom) | `data.*` | 0.2.0 |
| `trajectory-bundle` | Recorded teleop sequences | `skill.teleop_replay`, `data.*` | 0.2.0 |

Every kind is signed with the same primitives. Adding a new kind is one file: `sdk/typescript/src/kinds/<kind>.ts` that exports `validateBytes(bytes) → landmarks` and `deriveCapabilities(landmarks) → Capability[]`.

## 30-second start

```bash
# Verify a signed manifest against its asset bytes
npx @bmf/cli verify ./arthur.glb ./arthur.bmf.json

# Sign a new manifest
npx @bmf/cli sign ./arthur.glb --producer did:example:me --out arthur.bmf.json

# Inspect a manifest served by any BMF gateway
npx @bmf/cli inspect bmf://wildwallet.ai/asset/arthur-6b4836d2

# Run your own reference gateway locally
npx @bmf/gateway
```

Or in code:

```ts
import { loadManifest, hasCapability } from "@bmf/sdk";

// loadManifest fetches, checks the signature, and verifies asset_hash matches the bytes.
const { manifest, bytes, verified } = await loadManifest("bmf://wildwallet.ai/asset/arthur-6b4836d2");
if (!verified) throw new Error("BMF verification failed");

// Trust the signed capability set:
if (hasCapability(manifest, "anim.wave")) enableWaveBehavior();
if (hasCapability(manifest, "safety.simonly")) refuseToRunOnHardware();
```

## Who this is for

- **Game & AR devs** shipping UGC characters (Meshy, Tripo, Rodin outputs) to third parties.
- **Robotics teams** publishing policies, URDFs, or teleop datasets — [LeRobot](https://huggingface.co/lerobot), [Physical Intelligence](https://www.physicalintelligence.company/), [Open-X-Embodiment](https://robotics-transformer-x.github.io/), fleet operators.
- **AI-agent builders** whose agents need embodied avatars with verifiable capabilities.
- **Marketplaces** needing provenance, royalties, and paid downloads without building commerce infrastructure.
- **VTuber tooling** needing capability-signed rigs so an app knows which model supports which behaviors.

## Repository layout

| Path | Purpose |
|---|---|
| [`spec/`](./spec) | Human-readable specification, JSON Schemas, canonical examples |
| [`sdk/typescript/`](./sdk/typescript) | `@bmf/sdk` — verify, sign, hash, canonicalize, deriveCapabilities |
| [`cli/`](./cli) | `@bmf/cli` — `bmf verify`, `bmf sign`, `bmf inspect`, `bmf keygen` |
| [`gateway/`](./gateway) | Reference gateway (SQLite, single-file, no external deps) |
| [`examples/three-js-loader/`](./examples/three-js-loader) | Load a signed BMF character in three.js with capability-aware behaviors |
| [`examples/node-verify/`](./examples/node-verify) | Verify a manifest end-to-end in ~40 lines |

## Adoption partners

BMF ships in production at [wildwallet.ai](https://wildwallet.ai) — every character in the marketplace is served through a BMF gateway with signed capability contracts. See [`examples/three-js-loader`](./examples/three-js-loader) for a reference integration.

Robotics-kind support (URDF, MJCF, policy checkpoints) lands in `0.2.0`. Interested in being a reference partner? Open an issue.

## Spec

Read the spec: **[spec/SPEC.md](./spec/SPEC.md)** (~15 pages, RFC-2119 keywords). Current version: **0.1.0**.

## Contributing

Issues, PRs, spec proposals welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

Apache-2.0. Copyright MCFL Restaurant Holdings LLC / Erik Osol.

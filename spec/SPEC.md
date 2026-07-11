# BMF — Bake Manifest Format Specification

**Version:** 0.1.0
**Status:** Draft
**Editor:** Erik Osol (MCFL)
**License:** Apache-2.0

---

## 1. Introduction

BMF is a signed, content-addressed manifest format for **embodied assets** — 3D characters, robot policies, URDF/MJCF rigs, teleop datasets, and any other asset that has a runtime capability contract.

A BMF manifest binds three things together with a cryptographic signature:

1. **The asset bytes**, addressed by their SHA-256 hash.
2. **A capability contract** describing what the asset can do, derived from the bytes at signing time.
3. **A royalty chain** describing who is owed value from downstream use.

Consumers — game engines, robot controllers, marketplaces, fleet managers — verify the signature, read the capability set, and enable exactly the behaviors the asset supports. No per-asset branches. No unsigned metadata. No decorative claims.

### 1.1 Requirements Language

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

### 1.2 Non-Goals

BMF is **not**:

- A file format. Assets remain in their native formats (GLB, URDF, safetensors, etc.). BMF wraps them.
- A DRM system. Signatures prove provenance, not access control. Paywalls are handled by [x402](https://x402.gitbook.io/) integration, not by BMF itself.
- A transport protocol. BMF is served over HTTPS. The gateway API in §7 is a reference — any transport that preserves bytes works.

---

## 2. Terminology

- **Asset**: The bytes being described (e.g. a `.glb`, a `.urdf`, a `.safetensors` policy checkpoint).
- **Manifest**: A JSON object describing an asset, defined in §3.
- **Kind**: A short string identifying the asset type (`glb`, `urdf`, `policy`, etc.). See §4.
- **Capability**: A namespaced string, e.g. `anim.wave` or `policy.act.joint`, drawn from the registry in §5.
- **Producer**: The entity that signs the manifest. Identified by a DID.
- **Gateway**: An HTTP service that ingests bytes, produces manifests, and serves both.
- **Verified capability**: A capability the gateway derived from the bytes at signing time.
- **Declared capability**: A capability the producer asserted but the gateway did not verify. Suffixed with `!` when serialized.

---

## 3. The Manifest

A BMF manifest is a JSON object with the following shape:

```json
{
  "bmf": "0.1.0",
  "id": "bmf://<gateway-host>/asset/<slug-or-hash>",
  "kind": "glb",
  "mime": "model/gltf-binary",
  "bytes": 7693848,
  "asset_hash": "sha256:6b4836d2e7097420cd116fe15372695f583327ba82538be096b23fb9bb6f9f72",
  "capabilities": [
    "humanoid.mixamo24",
    "mesh.singleroot",
    "anim.gaze",
    "anim.breathe",
    "anim.wave",
    "anim.crouch",
    "anim.locomotion",
    "face.arkit52!"
  ],
  "provenance": [
    { "step": "source", "source": "meshy://model/abc123", "notes": "generated from prompt" },
    { "step": "rig",    "source": "mixamo://autorig",     "notes": "24-joint auto-rig" }
  ],
  "royalty_chain": [
    { "recipient": "did:example:creator",  "share_bps": 9000 },
    { "recipient": "did:bmf:platform",     "share_bps": 1000 }
  ],
  "x402": {
    "price": { "amount": "500000", "currency": "USDC", "chain": "base" },
    "recipient": "0x0000000000000000000000000000000000000000"
  },
  "issued_at": "2026-07-10T18:44:00.000Z",
  "expires_at": null,
  "signature": {
    "alg": "ed25519",
    "public_key": "base64url:pMd2WfkY9xC8LOxAnbnyuWXr_ctu0LRCZV0CcnUmdBU",
    "value": "base64url:GYgruU7BQL1SjJHJWYqjV2jhX-AvmGoWdOvOx5w6_JbRPd8Oq-Vq3B_-H0bzU1oA6XuAEvB10ktOSOuHE6xgBA"
  }
}
```

### 3.1 Required Fields

| Field | Type | Description |
|---|---|---|
| `bmf` | string | Spec version. MUST be `"0.1.0"` for this document. |
| `id` | string | Stable identifier. MUST be a URI. RECOMMENDED form: `bmf://<gateway-host>/asset/<opaque-id>`. |
| `kind` | string | Asset kind. See §4. |
| `mime` | string | IANA media type of the asset bytes. |
| `bytes` | integer | Byte length of the asset. MUST match the actual bytes. |
| `asset_hash` | string | `"sha256:"` + lowercase hex SHA-256 of the asset bytes. |
| `capabilities` | array of strings | Capability set. Each entry MUST be from the registry (§5). Entries suffixed with `!` are declared but unverified. |
| `provenance` | array of objects | Ordered chain of transformations. MAY be empty. See §6. |
| `royalty_chain` | array of objects | Royalty recipients and shares. Shares MUST sum to `10000`. See §3.3. |
| `issued_at` | string | RFC 3339 UTC timestamp when the manifest was signed. |
| `expires_at` | string or null | RFC 3339 UTC timestamp after which the manifest MUST be considered invalid. `null` means no expiration. |
| `signature` | object | Ed25519 signature. See §3.4. |

### 3.2 Optional Fields

| Field | Type | Description |
|---|---|---|
| `x402` | object | Price challenge. See §8. |
| `producer` | string | DID of the producer. If omitted, the gateway is the producer. |
| `metadata` | object | Arbitrary key-value metadata. MUST NOT be relied on for capability decisions. |

### 3.3 `royalty_chain`

Each entry has:

```json
{ "recipient": "did:example:creator", "share_bps": 9000 }
```

- `recipient` — a DID or wallet address URI.
- `share_bps` — basis points (integer 0–10000). Sum across all entries MUST equal exactly `10000`.

Downstream consumers that resell or license the asset MUST honor the chain, allocating payment proportionally.

### 3.4 `signature`

```json
{
  "alg": "ed25519",
  "public_key": "base64url:...",
  "value": "base64url:..."
}
```

- `alg` — signature algorithm. `"ed25519"` is REQUIRED for 0.1.0.
- `public_key` — the raw 32-byte Ed25519 public key, base64url-encoded, prefixed with `base64url:`.
- `value` — the raw 64-byte Ed25519 signature over the canonical JSON (§9) of the manifest with the `signature` field removed, base64url-encoded, prefixed with `base64url:`.

Consumers verify by:

1. Reconstructing the unsigned manifest (copy, delete `signature`).
2. Canonicalizing per §9.
3. Verifying the Ed25519 signature over the canonical bytes.

Additionally, consumers MUST verify that `asset_hash` matches the SHA-256 of the fetched asset bytes.

---

## 4. Kinds

A kind identifies the asset type. Each kind has:

- A byte-format check (does this look like the format?).
- A landmark extractor that produces structural facts.
- A capability derivation function (§5) that maps landmarks → verified capabilities.

### 4.1 Kinds Registered at 0.1.0

| Kind | MIME | Bytes | Namespaces derived |
|---|---|---|---|
| `glb` | `model/gltf-binary` | glTF 2.0 binary | `humanoid.*`, `mesh.*`, `anim.*`, `phys.*`, `face.*` |
| `urdf` | `application/xml` | URDF XML | `kin.*` (0.2.0) |
| `mjcf` | `application/xml` | MuJoCo XML | `kin.*` (0.2.0) |
| `policy` | `application/octet-stream` | Framework-specific checkpoint | `policy.*`, `skill.*` (0.2.0) |
| `dataset` | `application/x-lerobot-dataset` or `application/x-rlds` | Bundled demonstrations | `data.*` (0.2.0) |
| `trajectory-bundle` | `application/x-bmf-trajectory` | Recorded teleop sequences | `skill.teleop_replay`, `data.*` (0.2.0) |

Kinds marked 0.2.0 are stubbed in the reference SDK — signatures still work, but no capabilities are derived. Producers MAY set declared capabilities suffixed with `!`.

### 4.2 Extending with a New Kind

`Kind` is a string union. Adding a kind is a two-step change in the SDK:

1. Add the new string to `KINDS` in `sdk/typescript/src/types.ts`.
2. Add a file under `sdk/typescript/src/kinds/<kind>.ts` that exports an `inspect<Kind>(bytes)` extractor and a `derive<Kind>Capabilities(landmarks)` mapper, then add a `case` for it in `deriveCapabilities` in `src/derive.ts`.

The exhaustive switch means the TypeScript compiler tells you when a kind is missing a handler. Registering a new kind against the public registry requires a spec RFC (§10).

---

## 5. Capability Registry

Capabilities are namespaced strings. This registry is versioned with the spec. Consumers MUST reject unknown capabilities in strict mode; they MAY accept-with-warning in lenient mode.

### 5.1 Namespaces at 0.1.0

#### 5.1.1 `humanoid.*` (GLB kind)

- `humanoid.mixamo24` — verified when the GLB has ≥24 skin joints and ≥10 of 11 humanoid landmarks match (score ≥ 90 / 100, computed as `round(matched / 11 × 100)`). The 11 landmarks are: `hips`, `spine`, `neck_head`, `left_arm`, `right_arm`, `left_forearm_hand`, `right_forearm_hand`, `left_leg`, `right_leg`, `left_foot`, `right_foot` (each is the union of the Mixamo and "standard" bone names for that landmark).
- `humanoid.vrm` — declared only at 0.1.0.

#### 5.1.2 `mesh.*` (GLB kind)

- `mesh.singleroot` — verified when the GLB contains at least one skinned mesh. (In 0.2.0 this will additionally require a single skeleton root; today the reference derivation only checks skin count.)

#### 5.1.3 `anim.*` (GLB kind)

Derived from landmark presence:

- `anim.gaze` — head bone present.
- `anim.breathe` — spine or pelvis + at least one shoulder chain.
- `anim.wave` — full arm chain (shoulder + forearm/hand) on at least one side.
- `anim.crouch` — hips + at least one leg chain.
- `anim.locomotion` — hips + BOTH legs (needed to alternate stride).

Any other `anim.*` value MAY be declared but MUST be suffixed with `!`.

#### 5.1.4 `phys.*` (GLB kind)

The `phys.*` namespace declares that an asset is driven by BMF's anatomically grounded muscle model rather than baked clips. Bone positions are the OUTPUT of a per-joint force balance (Hill-type muscle torque vs gravity torque), not hand-authored keyframes. The reference runtime contract is `client/src/lib/muscleModel.ts`.

- `phys.muscle` — whole-skeleton Hill-type actuator model. Each of the 7 modeled joints (hip, knee, ankle, spine, shoulder, elbow, neck) is a torque-limited PD actuator whose peak torque is derived from physiological cross-sectional area times a specific tension of 26.8 N/cm^2, modulated live by force-length and force-velocity factors (Anderson & Pandy 2007). Verified when both leg chains are present. Self-consistency check: `pcsaTorque(joint)` reproduces each joint's published peak torque within 1%.
- `phys.stance` — quiet-stance solver (`standingPose()`): the joint angles a rig settles at under body weight plus tonic muscle stiffness. In the sagittal plane it corrects an arbitrary bind-pose crouch to a believable near-straight stand (hip ~0 rad, knee soft-lock ~0.05 rad, ankle flat). In the frontal plane it adds a stance-width term: the hip abductors (gluteus medius/minimus, peak ~120 Nm at 75 kg via `JOINTS.hipAbduction`) hold each thigh in ~9 deg (~0.157 rad) of abduction, mirrored left/right, so the feet plant about shoulder-width apart instead of converging under the pelvis. Verified when hips + both leg chains are present.
- `phys.jump` — muscle-driven vertical jump. Crouch-anticipation, push-off extension, airborne, and land-absorb phases are produced by real leg compression/extension through the `phys.muscle` actuators (`grounded|crouch|launch|air|land` state machine), not a baked clip. Verified when hips + both full leg chains (including feet) are present.

Gravity is 9.81 m/s^2 against a 75 kg reference body mass; both are declared in the registry `params` so a runtime can rescale to a specific character. Any other `phys.*` value MAY be declared but MUST be suffixed with `!`.

#### 5.1.5 `face.*` (GLB kind)

Declared-only at 0.1.0:

- `face.arkit52!` — 52 ARKit blendshapes.
- `face.perfectsync!` — Perfect Sync blendshape set.

Verification (blendshape name matching) lands in 0.2.0.

#### 5.1.6 `kin.*` (URDF / MJCF kinds — 0.2.0)

- `kin.urdf` — parseable URDF.
- `kin.mjcf` — parseable MuJoCo scene.
- `kin.dof.<N>` — total degrees of freedom.
- `kin.arm` — has one identifiable arm chain (base → shoulder → elbow → wrist).
- `kin.bimanual` — two arm chains.
- `kin.mobile` — has a mobile base (wheeled / legged / tracked).
- `kin.gripper.parallel` / `kin.gripper.suction` / `kin.gripper.dex` — end-effector class.

#### 5.1.7 `policy.*` (policy kind — 0.2.0)

- `policy.framework.lerobot` / `policy.framework.openvla` / `policy.framework.rt2` / `policy.framework.custom`.
- `policy.obs.rgb` / `policy.obs.rgbd` / `policy.obs.proprio` / `policy.obs.tactile`.
- `policy.act.joint` / `policy.act.ee_pose` / `policy.act.gripper`.

Derived by inspecting the checkpoint's observation and action space.

#### 5.1.8 `skill.*` (policy or trajectory-bundle kinds — 0.2.0)

- `skill.pick_place` — validated against a standard eval set defined in a future RFC.
- `skill.door_open` / `skill.stack_cube` / `skill.follow` / `skill.teleop_replay`.

`skill.*` capabilities are only ever verified against a named eval; otherwise declared with `!`.

#### 5.1.9 `data.*` (dataset / trajectory-bundle kinds — 0.2.0)

- `data.episodes.<N>` — N demonstrations bundled.
- `data.hz.<rate>` — control rate.
- `data.embodiment.<slug>` — target robot slug (`so-100`, `franka_panda`, `unitree_g1`).

#### 5.1.10 `safety.*` (all kinds — 0.2.0, MAY be declared at 0.1.0)

Safety capabilities are **first-class**. Runtimes SHOULD refuse to execute an asset lacking required safety declarations on hardware.

- `safety.workspace.limits` — asset declares joint/velocity limits within a machine-readable envelope.
- `safety.dead_man` — asset requires operator presence.
- `safety.simonly` — asset MUST NOT be executed on physical hardware. Runtimes MUST enforce.

### 5.2 Verified vs. Declared

A capability serialized as `foo.bar` is verified. A capability serialized as `foo.bar!` is declared but not verified by the signing gateway. Consumers MAY treat declared capabilities as advisory but SHOULD NOT make safety-critical decisions on them.

### 5.3 Discovering the Registry

A gateway MUST expose its supported capability list at:

```
GET /bmf/v1/capabilities
```

Response:

```json
{
  "bmf": "0.1.0",
  "namespaces": ["humanoid", "mesh", "anim", "face", "kin", "policy", "skill", "data", "safety"],
  "verified": ["humanoid.mixamo24", "mesh.singleroot", "anim.gaze", "anim.breathe", "anim.wave", "anim.crouch", "anim.locomotion"],
  "declared_only": ["face.arkit52", "face.perfectsync", "safety.simonly"]
}
```

---

## 6. Provenance

`provenance` is an ordered array of transformations. Each entry:

```json
{ "step": "rig", "source": "mixamo://autorig", "notes": "24-joint auto-rig" }
```

- `step` — one of `source`, `rig`, `retexture`, `remesh`, `retarget`, `train`, `finetune`, `edit`. Producers MAY define others as `custom:<name>`.
- `source` — URI of the input to this step. MAY be a `bmf://` URI, in which case consumers can chain-verify upstream.
- `notes` — free-form.

The provenance chain is descriptive, not enforced. Consumers MAY reject assets whose provenance chain includes forbidden sources.

---

## 7. HTTP Gateway API

A BMF gateway serves manifests over HTTPS. All endpoints are namespaced under `/bmf/v1/`.

### 7.1 Discovery

```
GET /.well-known/bmf.json
```

Response:

```json
{
  "bmf": "0.1.0",
  "gateway": "https://gateway.example",
  "public_key": "base64url:MCowBQYDK2VwAyEA...",
  "endpoints": {
    "capabilities": "/bmf/v1/capabilities",
    "resolve":      "/bmf/v1/resolve/asset/{id}",
    "prepare":      "/bmf/v1/prepare",
    "chunk":        "/bmf/v1/chunk",
    "finalize":     "/bmf/v1/finalize",
    "status":       "/bmf/v1/status/{upload_id}",
    "asset":        "/api/asset/glb/{id}"
  }
}
```

### 7.2 Ingest (Producer Side)

```
POST /bmf/v1/prepare        → { upload_id, chunk_size }
POST /bmf/v1/chunk          → { upload_id, index, bytes }
POST /bmf/v1/finalize       → { manifest }
GET  /bmf/v1/status/{id}    → { state: "pending" | "signed", ... }
```

Chunked upload is REQUIRED for assets > 4 MB, RECOMMENDED for all uploads.

### 7.3 Resolve (Consumer Side)

```
GET /bmf/v1/resolve/asset/{id}   → the signed manifest JSON
GET /api/asset/{kind}/{id}       → the raw asset bytes
```

The gateway MAY re-derive capabilities at resolve time and re-sign the manifest if the verification logic has been upgraded. This is the "lazy upgrade" pattern; the reference gateway does not implement it (resolve returns the stored manifest verbatim). Producers who need this today can re-run `POST /bmf/v1/prepare` → `finalize` on the same asset bytes.

---

## 8. Paid Assets (x402 Integration)

Manifests MAY include an `x402` field:

```json
"x402": {
  "price":     { "amount": "500000", "currency": "USDC", "chain": "base" },
  "recipient": "0x0000000000000000000000000000000000000000"
}
```

Gateways MAY respond to `GET /api/asset/{kind}/{id}` with HTTP `402 Payment Required` and an [x402](https://x402.gitbook.io/) challenge. Once payment is settled, the gateway MUST return the asset bytes.

Royalties from the `royalty_chain` MUST be honored at payment settlement — the payment recipient in `x402` is typically an escrow that fans out to the chain.

---

## 9. Canonical JSON

BMF signatures are over a canonical JSON encoding, a subset of [JCS (RFC 8785)](https://www.rfc-editor.org/rfc/rfc8785):

1. **UTF-8** encoding.
2. **No insignificant whitespace** — no spaces, no newlines outside string values.
3. **Object keys sorted** lexicographically (by UTF-16 code unit).
4. **No trailing commas.**
5. **Strings** encoded per [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259) with the shortest escape form.
6. **Numbers** MUST be integers or JSON numbers with no leading `+`, no trailing `.`, no exponent for integers.

The reference SDK ships `canonicalize(obj)` that implements this deterministically. Producers and consumers MUST use canonical JSON for signing and verification.

---

## 10. Extension Process

New kinds, capabilities, or manifest fields go through a short RFC process:

1. Open an issue in the [bmf repo](https://github.com/mcflamingo/bmf) tagged `rfc`.
2. Describe motivation, spec delta, and back-compat.
3. Iterate publicly.
4. Merged proposals ship in the next spec version.

Breaking changes bump the minor version (`0.2.0`). Additive changes (new declared-only capabilities, new optional fields) MAY ship as `0.1.x` errata.

---

## 11. Security Considerations

- **Signature forgery** — Ed25519 with a compromised key is game over. Gateways SHOULD support key rotation via a JWKS-style endpoint. Rotation lands in 0.2.0.
- **Replay** — Manifests are static and content-addressed. Replay is not a threat.
- **Downgrade attacks** — Consumers MUST reject manifests where `bmf` version is unknown.
- **Capability lies** — A malicious producer might declare capabilities the asset doesn't have. Declared capabilities are marked with `!`; consumers MUST NOT make safety-critical decisions on them.
- **Byte swaps** — Prevented by `asset_hash`. Consumers MUST verify the hash matches the fetched bytes.
- **Sim-to-real safety** — `safety.simonly` MUST be enforced by the runtime, not by the network. Any runtime willing to load `safety.simonly` assets on hardware is out of spec.

---

## 12. Reference Implementations

- **`@mcflamingo/bmf-sdk`** — TypeScript SDK: `canonicalize`, `sign`, `verify`, `deriveCapabilities`, `loadManifest`.
- **`@mcflamingo/bmf-cli`** — Command-line tool: `verify`, `sign`, `inspect`, `keygen`.
- **`@mcflamingo/bmf-gateway`** — Reference gateway: single file, SQLite-backed, `npx @mcflamingo/bmf-gateway`.

All three are in this repo under `sdk/`, `cli/`, and `gateway/`.

---

## Appendix A. Example: Signed Character Manifest

See [`spec/examples/character.bmf.json`](./examples/character.bmf.json).

## Appendix B. Example: Signed Policy Manifest

See [`spec/examples/policy.bmf.json`](./examples/policy.bmf.json). (0.2.0)

## Appendix C. Change Log

See [`CHANGELOG.md`](../CHANGELOG.md).

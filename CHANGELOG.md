# Changelog

All notable changes to the BMF spec and reference implementations are documented here.
This project follows [Semantic Versioning](https://semver.org/) at the spec level.

## [Unreleased]

### Spec

- New `phys.*` capability namespace (GLB kind): assets driven by BMF's anatomically grounded muscle model rather than baked clips. Bone positions are the OUTPUT of a per-joint Hill-type muscle-torque vs gravity-torque balance.
  - `phys.muscle` — whole-skeleton Hill-type joint-actuator model. Peak torque per joint derived from PCSA times specific tension 26.8 N/cm^2, modulated by force-length and force-velocity factors (Anderson & Pandy 2007). Seven modeled joints; self-consistent with published peak torques within 1%.
  - `phys.stance` — quiet-stance solver (`standingPose()`) that resolves an arbitrary bind-pose crouch to a believable near-straight stand under body weight plus tonic muscle stiffness. Adds a frontal-plane stance-width term: hip abductors (gluteus medius/minimus) hold each thigh in ~9 deg of abduction (`JOINTS.hipAbduction`) so the feet plant shoulder-width apart instead of converging.
  - `phys.jump` — muscle-driven vertical jump (crouch/launch/air/land) produced by real leg compression/extension through the `phys.muscle` actuators, not a clip.
  - Registry `params` declare specific tension (26.8 N/cm^2), gravity (9.81 m/s^2), and a 75 kg reference body mass so runtimes can rescale.
  - Reference runtime contract: Wild Wallet `client/src/lib/muscleModel.ts`.

## [0.1.0] — 2026-07-10

Initial public release.

### Spec

- Content-addressed asset URIs: `bmf://<gateway>/asset/<slug>-<hash8>`, where `hash8` is the first 8 hex chars of the SHA-256.
- Canonical JSON (JCS-subset) for signing.
- Ed25519 manifest signatures (raw 32-byte keys, base64url-encoded).
- Capability namespaces: `humanoid`, `mesh`, `anim`, `face`, `kin`, `policy`, `skill`, `data`, `safety`.
- Verified vs. declared capabilities (unverified declarations suffixed `!`).
- Provenance chain (source → rig → retexture → remesh → retarget → train → finetune → edit).
- Royalty chain (integer bps, must sum to 10 000).
- x402 price challenge for paid assets.
- HTTP gateway endpoints: `prepare`, `chunk`, `finalize`, `status`, `resolve`, `asset`, `capabilities`, plus `/.well-known/bmf.json` discovery.

### SDK

- `@mcflamingo/bmf-sdk` (TypeScript): `canonicalize`, `assetHash`, `sha256Hex`, `keygen`, `publicKeyFromPrivate`, `signManifest`, `verifyManifest`, `deriveCapabilities`, `hasCapability`, `assertValidRoyaltyChain`, `mintBmfUri`, `parseBmfUri`, `loadManifest`.
- Zero runtime dependencies besides `@noble/ed25519`.

### CLI

- `@mcflamingo/bmf-cli`: `verify`, `sign`, `inspect`, `keygen`.

### Reference gateway

- Single-file Express server, SQLite-backed, no external services.
- Runs with `npx @mcflamingo/bmf-gateway`.

### Verified capabilities

At `0.1.0` the reference implementation verifies these capabilities from GLB bytes:

- `humanoid.mixamo24` — ≥24 skin joints and ≥10 of 11 humanoid landmarks matched (score ≥90/100).
- `mesh.singleroot` — the asset contains at least one skinned mesh.
- `anim.gaze` — head bone present.
- `anim.breathe` — spine (or pelvis) + at least one shoulder chain.
- `anim.wave` — full arm chain (shoulder + forearm/hand) on at least one side.
- `anim.crouch` — hips + at least one leg chain.
- `anim.locomotion` — hips + both legs (needed to alternate stride).

All other capabilities declared by the producer are recorded but suffixed with `!` to mark them as unverified.

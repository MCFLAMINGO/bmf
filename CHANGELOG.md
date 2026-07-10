# Changelog

All notable changes to the BMF spec and reference implementations are documented here.
This project follows [Semantic Versioning](https://semver.org/) at the spec level.

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

- `@bmf/sdk` (TypeScript): `canonicalize`, `assetHash`, `sha256Hex`, `keygen`, `publicKeyFromPrivate`, `signManifest`, `verifyManifest`, `deriveCapabilities`, `hasCapability`, `assertValidRoyaltyChain`, `mintBmfUri`, `parseBmfUri`, `loadManifest`.
- Zero runtime dependencies besides `@noble/ed25519`.

### CLI

- `@bmf/cli`: `verify`, `sign`, `inspect`, `keygen`.

### Reference gateway

- Single-file Express server, SQLite-backed, no external services.
- Runs with `npx @bmf/gateway`.

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

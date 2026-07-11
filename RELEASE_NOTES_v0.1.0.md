## BMF 0.1.0 — Signed manifests for embodied AI assets

BMF (Binary Manifest Format) is a signed, content-addressed manifest format for embodied assets: 3D characters, robot policies, URDFs, and teleoperation datasets. If USD/glTF are the "what is this asset," BMF is the "who signed it, what can it do, and who gets paid when it's used."

This is the initial public release. Apache-2.0, no dependencies beyond `@noble/ed25519`.

### What's in the box

- **Spec** — [SPEC.md](https://github.com/MCFLAMINGO/bmf/blob/main/spec/SPEC.md), JSON Schemas, RFC 2119 wording, ready to implement against.
- **`@mcflamingo/bmf-sdk`** (TypeScript) — canonicalize, sign, verify, derive capabilities, load manifests. Runs in Node and the browser.
- **`@mcflamingo/bmf-cli`** — `bmf verify`, `bmf sign`, `bmf inspect`, `bmf keygen`.
- **`@mcflamingo/bmf-gateway`** — single-file reference gateway (Express + SQLite), `npx`-runnable.
- **Examples** — `node-verify` (minimum viable client) and `three-js-loader` (capability-driven character loading).

### Key features

- **Content-addressed URIs** — `bmf://<gateway>/asset/<slug>-<hash8>`. Verifiable without the gateway.
- **Ed25519 signatures over canonical JSON** — one-shot verify, no XML canonicalization ceremony.
- **Verified vs. declared capabilities** — the SDK derives what an asset can actually do from its bytes (skin joints, bone landmarks, animation clips). Declared-but-unverified capabilities are suffixed with `!` so consumers can tell the difference.
- **Provenance chain** — every retexture, remesh, retarget, or edit is signed and preserved. You can trace an asset back to its source.
- **Royalty chain** — integer basis points, must sum to 10,000. Payment splits ride with the manifest.
- **Kind system extends beyond characters** — GLB is implemented today; the manifest carries `kind` for policies, URDFs, teleop datasets, and safety profiles as the ecosystem lands them.

### Verified capabilities at 0.1.0 (GLB kind)

- `humanoid.mixamo24` — ≥24 skin joints, ≥10 of 11 humanoid landmarks matched
- `mesh.singleroot` — asset contains at least one skinned mesh
- `anim.gaze`, `anim.breathe`, `anim.wave`, `anim.crouch`, `anim.locomotion` — derived from bone-chain presence

### Try it

```bash
git clone https://github.com/MCFLAMINGO/bmf.git
cd bmf
npm install
npm run build

# Sign a GLB, verify the manifest, inspect it
node cli/dist/bin.js keygen --out signer.key
node cli/dist/bin.js sign my-character.glb --key signer.key --out character.bmf.json
node cli/dist/bin.js verify my-character.glb --manifest character.bmf.json
node cli/dist/bin.js inspect character.bmf.json
```

### npm packages

The three packages will be published to npm shortly. In the meantime, install directly from this repo:

```bash
npm install github:MCFLAMINGO/bmf#v0.1.0
```

### What's next

- 0.2.0: additional kinds (`urdf`, `policy`, `teleop-data`, `safety`), gateway lazy re-sign, staged publishing pipeline.
- Reference implementations in Rust and Python.

### Test status

- SDK: 10/10 passing (`tsx --test`)
- CLI smoke: PASS (sign, verify, inspect, tamper-detect)
- Gateway smoke: PASS (discovery, capabilities, prepare/chunk/finalize, resolve, asset fetch, verify, hash-match)

### License

Apache-2.0. Fork it, embed it, ship it.

# BMF — Bake Manifest Format

**Signed capability verification for embodied assets — characters today, robot fleets tomorrow.**

Spec **0.2.0**. One manifest binds asset bytes, a verified capability contract, and a royalty chain with Ed25519. Consumers prove claims before load — game engines, AR runtimes, and robot controllers alike.

```bash
npm install @mcflamingo/bmf-sdk@0.2.0   # pulls @mcflamingo/bmf-node (Rust)
```

## Why robotics labs should care

The integration question for foundation-model robot policies is: *does this artifact actually have the capability it claims, and can I verify that in &lt;50ms before I let it move a $30k arm?*

BMF 0.1.0 answered that for GLB characters. **BMF 0.2.0 answers it for robot bodies — in Rust.**

| Layer | Role | Language |
|---|---|---|
| Spec + schemas | Capability contract (`kin.*`, `phys.*`, `safety.*`, …) | Markdown / JSON Schema |
| **`bmf-core`** | URDF + MJCF parse → morphology → verified `kin.*` | **Rust** |
| `@mcflamingo/bmf-node` | napi-rs binding (Node / CI / gateways) | Rust → Node |
| `bmf-py` | PyO3 binding (LeRobot / openpi / lab notebooks) | Rust → Python |
| `@mcflamingo/bmf-sdk` | Sign / verify / GLB `phys.*` / call into Rust for robots | TypeScript |

**Rust is intentional.** Fleet operators and platform teams (Unitree, Boston Dynamics Spot SDK consumers, Figure, Physical Intelligence, Nvidia Isaac) expect a systems-language verifier they can embed beside the controller — not a JS-only toy parser. One core, two FFI surfaces (napi + PyO3), zero drift between Node dashboards and Python training loops.

There is **no TypeScript reimplementation** of URDF/MJCF. Robotics kinds go through `bmf-core`.

```ts
import { deriveCapabilities, hasCapability, verifyRobotDescriptor } from "@mcflamingo/bmf-sdk";

const caps = deriveCapabilities("urdf", urdfBytes); // Rust
if (hasCapability({ capabilities: caps }, "safety.workspace.limits")) {
  // safe to consider for hardware paths
}
```

## What's in 0.2.0

### Rust `kin.*` (robot descriptors)

Verified from real fixtures (Franka Panda, SO-ARM100, Unitree H1 / G1 / Go2):

- `kin.urdf` / `kin.mjcf`
- `kin.arm`, `kin.dof.arm=N`
- `kin.mobile`, `kin.legged.biped`, `kin.legged.quadruped`
- `kin.superhuman.joints` (continuous / Atlas-class)
- `safety.workspace.limits`

### `phys.*` (characters — muscle model)

Bone positions as the output of Hill-type muscle torque vs gravity (specific tension 26.8 N/cm²). `phys.muscle`, `phys.stance` (incl. stance-width), `phys.jump`. Live at [wildwallet.ai](https://wildwallet.ai).

### Still planned (0.2.x)

Policy / trajectory / choreography kind validators, multi-arch napi prebuilds, `face.arkit52` promotion. Scope: [`docs/0.2.0-robotics-scope.md`](./docs/0.2.0-robotics-scope.md).

## 30-second start

```bash
npx @mcflamingo/bmf-cli@0.2.0 verify ./arthur.glb ./arthur.bmf.json
npx @mcflamingo/bmf-cli@0.2.0 sign ./robot.urdf --kind urdf --out robot.bmf.json
npx @mcflamingo/bmf-gateway@0.2.0
```

```ts
import { loadManifest, hasCapability } from "@mcflamingo/bmf-sdk";

const { manifest, verified } = await loadManifest("bmf://wildwallet.ai/asset/arthur-6b4836d2");
if (!verified) throw new Error("BMF verification failed");
if (hasCapability(manifest, "phys.stance")) enableMuscleStance();
if (hasCapability(manifest, "safety.simonly")) refuseToRunOnHardware();
```

## Who this is for

- **Robotics platform / fleet teams** who need signed URDF/MJCF/policy gates before hardware.
- **Foundation-model labs** (LeRobot, openpi, Isaac, GR00T-class stacks) publishing policies with a verifiable envelope.
- **Game & AR** shipping UGC characters with `anim.*` / `phys.*` contracts (production: wildwallet.ai).
- **Marketplaces** needing provenance, royalties, and x402 paywalls without bespoke commerce.

## Repository layout

| Path | Purpose |
|---|---|
| [`spec/`](./spec) | Spec 0.2.0, JSON Schemas, examples |
| [`core-rs/`](./core-rs) | **Rust workspace** — `bmf-core`, `bmf-node`, `bmf-py` |
| [`sdk/typescript/`](./sdk/typescript) | `@mcflamingo/bmf-sdk` |
| [`cli/`](./cli) | `@mcflamingo/bmf-cli` |
| [`gateway/`](./gateway) | Reference gateway |
| [`llms.txt`](./llms.txt) | Machine-readable summary for agents |
| [`RELEASE_NOTES_v0.2.0.md`](./RELEASE_NOTES_v0.2.0.md) | Upgrade notes |

## Spec

**[spec/SPEC.md](./spec/SPEC.md)** — current version **0.2.0**. Manifests may declare `0.1.0` or `0.2.0`; new signs use `0.2.0`.

## License

Apache-2.0. Copyright MCFL Restaurant Holdings LLC / Erik Osol.

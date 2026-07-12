## BMF 0.2.0 — Muscle physics + Rust robotics core

Upgrade from 0.1.0. Spec version `0.2.0`. npm: `@mcflamingo/bmf-node`, `@mcflamingo/bmf-sdk`, `@mcflamingo/bmf-cli`, `@mcflamingo/bmf-gateway`.

### Why Rust (the product story)

Robotics buyers — fleet platforms, foundation-model labs, OEM SDK teams — will not standardize on a JS-only body verifier. **BMF 0.2.0 puts URDF/MJCF morphology and `kin.*` derivation in Rust (`bmf-core`)**, with napi and PyO3 bindings so the same core sits in Node gateways and Python training loops. TypeScript signs and verifies manifests and handles GLB/`phys.*`; it does **not** reimplement robot parsers.

That is the wedge for selling the concept to large robotics orgs: signed capability checks in a language they already trust beside the controller.

### What's new

#### Rust `kin.*` (robot descriptors)

- Package **`@mcflamingo/bmf-node`** — napi-rs over `bmf-core`
- Verified: `kin.urdf`, `kin.mjcf`, `kin.arm`, `kin.dof.arm=N`, `kin.mobile`, `kin.legged.biped`, `kin.legged.quadruped`, `kin.superhuman.joints`, `safety.workspace.limits`
- Fixtures: Franka Panda, SO-ARM100, Unitree H1/G1/Go2
- In-repo `bmf-py` (PyO3) for LeRobot/openpi-style workflows (PyPI follows)

#### `phys.*` (GLB muscle model)

- `phys.muscle` / `phys.stance` (incl. stance-width) / `phys.jump`
- Specific tension 26.8 N/cm²; gravity 9.81; ref mass 75 kg
- Runtime contract: Wild Wallet `muscleModel.ts`

#### Spec / SDK

- Manifest `bmf` accepts `0.1.0` | `0.2.0` (new signs use `0.2.0`)
- `verifyRobotDescriptor` / `deriveCapabilities("urdf"|"mjcf", …)` call Rust

### Install

```bash
npm install @mcflamingo/bmf-sdk@0.2.0
npx @mcflamingo/bmf-cli@0.2.0 sign ./robot.urdf --kind urdf --out robot.bmf.json
```

### Explicitly not in 0.2.0

Policy / trajectory / choreography validators, multi-arch napi prebuilds beyond CI linux, `face.arkit52` promotion. See `docs/0.2.0-robotics-scope.md`.

### License

Apache-2.0.

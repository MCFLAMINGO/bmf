# BMF 2.0 — durable handoff

Author: cursor cloud agent (Arthur stance-width / BMF resume)
Date: 2026-07-12
Repo: `MCFLAMINGO/bmf`, default branch `main`

## Ground truth (read this first)

| Fact | Value |
|------|--------|
| Spec phys.* introduced | `e6c56e6` |
| Stance-width term added to phys.stance | `53a2e82` (was HEAD when this thread started) |
| This handoff branch | `cursor/phys-caps-and-day3-wiring-419c` |
| Rust core | `core-rs/` @ `0.2.0-dev.0`, **17/17 tests passing** on rustc 1.97 |
| Reference runtime | Wild Wallet `client/src/lib/muscleModel.ts` (private repo — not in this org's public list) |
| Live character | `wildwallet.ai/#/friend/arthur-7a3d0a` |

## What BMF is

**Bake Manifest Format** — signed, content-addressed manifests for embodied-AI assets (3D characters, robot policies, URDFs, teleop datasets). Capability namespaces: `humanoid`, `mesh`, `anim`, `phys`, `face`, `kin`, `policy`, `skill`, `data`, `safety`.

## phys.* (BMF muscle model — character side of 2.0)

Bone positions are the **OUTPUT** of a per-joint Hill-type muscle-torque vs gravity-torque balance — not baked clips.

| Cap | Meaning |
|-----|---------|
| `phys.muscle` | Whole-skeleton Hill-type actuators. Specific tension **26.8 N/cm²**, gravity **9.81**, ref mass **75 kg**. 7 joints. |
| `phys.stance` | Quiet-stance solver + **frontal-plane stance-width** (~9° / 0.157 rad hip abduction via gluteus med/min, peak ~120 Nm). |
| `phys.jump` | Muscle-driven crouch/launch/air/land from real leg compression. |

### Verifier status (this branch)

- Spec + registry already declared phys.* as verifiable.
- **Gap that was open on `53a2e82`:** TS SDK `deriveGlbCapabilities` never emitted `phys.*`.
- **Fixed here:** GLB landmark table splits shin (`l_leg`/`r_leg`) from feet; derivation grants `phys.muscle`/`phys.stance`/`phys.jump` when the registry landmark gates pass. Example Arthur manifest updated.

### Runtime status (Wild Wallet — out of this repo)

Arthur still reported pinned-at-waist / pigeon-toed / voice lag on real devices after the previous thread's sandbox death. Spec stance-width is documented; **confirm `muscleModel.ts` actually applies `JOINTS.hipAbduction` on a hard-refreshed prod load** before calling Arthur "fixed." This repo cannot see that private client.

## Robotics 0.2.0 (Days 1–3)

| Day | Status |
|-----|--------|
| 1–2 | **Done.** URDF + MJCF parsers, PyO3 + napi-rs, 5 fixtures, 17 tests. Verdict: Rust holds. |
| 3 | **Started this branch.** TS SDK loads optional `bmf-node` and derives `kin.*` / `safety.workspace.limits` for URDF/MJCF. Registry marks those caps `verifiable: true`. |
| 4–12 | Not started. See `docs/0.2.0-robotics-scope.md` + `docs/0.2.0-day2-verdict.md`. |

### Build native addon for local SDK tests

```bash
source ~/.cargo/env   # or rustup default stable (≥1.88 for current napi-build)
cd core-rs
cargo build -p bmf-node --release
cp target/release/libbmf_node.so target/release/bmf_node.node
cd ../sdk/typescript && npm test
```

Without `bmf_node.node`, GLB/`phys.*` tests still run; robot tests skip.

## Next concrete steps

1. **Wild Wallet (Arthur):** verify stance-width + jump crouch on a real hard-refreshed prod device; remove jump button / voice-activate attributes if still outstanding.
2. **BMF Day 3 finish:** Python SDK skeleton calling `bmf-py`; CI job for `cargo test` + native `.node` artifact.
3. **Day 4+:** Unitree G1_SDK / Agibot YAML, then policy kind.
4. Do **not** trust headless screenshots alone for Arthur locomotion QA.

## Doctrine reminders

- Specific paths only on commits (no `git add -A` of secrets).
- Canonical JSON + Ed25519 for manifests.
- `safety.simonly` MUST refuse on hardware; refusal audit is Day 8.

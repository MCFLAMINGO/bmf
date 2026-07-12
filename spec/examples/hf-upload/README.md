---
license: apache-2.0
tags:
  - robotics
  - lerobot
  - bmf
  - safety
  - so-arm100
  - policy-verification
library_name: lerobot
pipeline_tag: robotics
---

# BMF × LeRobot — SO-100 ACT fixture (sim-only)

Structural **LeRobot-shaped** policy bundle for [BMF](https://github.com/MCFLAMINGO/bmf) verification demos.

This is **not** a trained policy. Weights are dummy. It exists so labs can run:

> download → BMF verify → **refuse on hardware** because `safety.simonly`

## Why it exists

BMF is a signed capability gate for embodied assets. For robot policies the load-path question is:

> Does this artifact actually have the capabilities it claims, and can I refuse it before it moves a physical arm?

This fixture fingerprints as `policy.framework.lerobot` and declares `safety.sim_only: true`. BMF must **REFUSE** hardware execution.

## Files

| File | Role |
|------|------|
| `config.json` | LeRobot policy fingerprint (`type: "lerobot"` / ACT-shaped) |
| `train_config.json` | LeRobot checkpoint fingerprint |
| `model.safetensors` | Dummy weights (not for inference) |
| `manifest.json` | BMF policy manifest (obs/act spaces + safety) |
| `lerobot_so100_act.tar.zst` | Same bundle as a single archive (what `bmf check-safety` takes) |

## Verify with BMF

```bash
npm install -g @mcflamingo/bmf-cli   # or use repo CLI
# after building native bmf-node in the monorepo:

bmf check-safety lerobot_so100_act.tar.zst           # sim parse
bmf check-safety lerobot_so100_act.tar.zst --hardware  # REFUSED
```

Or from the BMF repo:

```bash
node examples/lerobot-gate/index.mjs --sim   # OK
node examples/lerobot-gate/index.mjs         # REFUSED + refusal_record
```

Expected capabilities include:

- `policy.framework.lerobot`
- `policy.obs.rgb`, `policy.obs.proprio`
- `policy.act.joint`, `policy.act.gripper`
- `safety.simonly`, `safety.dead_man`

## Embodiment

SO-ARM100–shaped spaces (6-DoF + gripper). Pair with the URDF fixture in the BMF repo: `spec/examples/so100.urdf`.

## License

Apache-2.0. Part of [MCFLAMINGO/bmf](https://github.com/MCFLAMINGO/bmf).

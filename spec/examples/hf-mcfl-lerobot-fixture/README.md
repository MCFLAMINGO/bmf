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

## One-liner demo (BMF 0.2.1)

```bash
npm install -g @mcflamingo/bmf-cli@0.2.1
# If native addon missing on your OS, from the installed package:
#   cd "$(npm root -g)/@mcflamingo/bmf-node" && npm run build

huggingface-cli download MCFL/bmf-lerobot-so100-act-fixture \
  lerobot_so100_act.tar.zst --local-dir .

bmf check-safety lerobot_so100_act.tar.zst           # sim — OK
bmf check-safety lerobot_so100_act.tar.zst --hardware  # REFUSED
```

Expected: `REFUSED — … safety.simonly — this policy MUST NOT run on physical hardware`.

## Why it exists

BMF is a signed capability gate for embodied assets. For robot policies the load-path question is:

> Does this artifact actually have the capabilities it claims, and can I refuse it before it moves a physical arm?

This fixture fingerprints as `policy.framework.lerobot` and declares `safety.sim_only: true`.

## Files

| File | Role |
|------|------|
| `config.json` | LeRobot policy fingerprint (`type: "lerobot"` / ACT-shaped) |
| `train_config.json` | LeRobot checkpoint fingerprint |
| `model.safetensors` | Dummy weights (not for inference) |
| `manifest.json` | BMF policy manifest (obs/act spaces + safety) |
| `lerobot_so100_act.tar.zst` | Same bundle as a single archive |

## Capabilities derived

- `policy.framework.lerobot`
- `policy.obs.rgb`, `policy.obs.rgb.wrist`, `policy.obs.proprio`
- `policy.act.joint`, `policy.act.gripper`, `policy.act.chunk_size=50`, `policy.act.control_hz=50`
- `policy.embodiment.arm`
- `safety.simonly`, `safety.dead_man`

## Links

- Spec / code: https://github.com/MCFLAMINGO/bmf
- npm: `@mcflamingo/bmf-cli@0.2.1`, `@mcflamingo/bmf-sdk@0.2.1`, `@mcflamingo/bmf-node@0.2.1`
- Release notes: https://github.com/MCFLAMINGO/bmf/blob/main/RELEASE_NOTES_v0.2.1.md

## License

Apache-2.0.

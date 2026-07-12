---
license: apache-2.0
tags:
  - robotics
  - lerobot
  - bmf
  - safety
  - act
  - aloha
  - policy-verification
library_name: lerobot
pipeline_tag: robotics
base_model: lerobot/act_aloha_sim_transfer_cube_human
---

# BMF wrap — LeRobot ACT ALOHA sim (transfer cube)

Real weights from [`lerobot/act_aloha_sim_transfer_cube_human`](https://huggingface.co/lerobot/act_aloha_sim_transfer_cube_human), plus a BMF `manifest.json` that declares **`safety.sim_only: true`**.

This is not a re-train. BMF only adds a signed capability / hardware-refuse gate.

## One-liner (BMF 0.2.1)

```bash
npm install -g @mcflamingo/bmf-cli@0.2.1
# If native addon missing:
#   cd "$(npm root -g)/@mcflamingo/bmf-node" && npm run build

huggingface-cli download MCFL/bmf-lerobot-act-aloha-sim-wrap \
  act_aloha_sim_transfer_cube_human.bmf.tar.zst --local-dir .

bmf check-safety act_aloha_sim_transfer_cube_human.bmf.tar.zst           # sim — OK
bmf check-safety act_aloha_sim_transfer_cube_human.bmf.tar.zst --hardware  # REFUSED
```

## Upstream

| Field | Value |
|-------|--------|
| Hub | `lerobot/act_aloha_sim_transfer_cube_human` |
| Policy | ACT (`type: act`) |
| Env | `AlohaTransferCube-v0` (sim) |
| License | Apache-2.0 |

## Why wrap it

Dummy fixtures prove the parser. Wrapping an **official** LeRobot checkpoint proves the fleet gate on something labs already download.

## Links

- Spec / code: https://github.com/MCFLAMINGO/bmf
- Wrap script: `scripts/wrap-lerobot-act-aloha-sim.sh`
- npm: `@mcflamingo/bmf-cli@0.2.1`

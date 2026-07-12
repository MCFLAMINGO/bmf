# Real LeRobot ACT wrap — ALOHA sim transfer cube

Wraps the **official** Hub checkpoint
[`lerobot/act_aloha_sim_transfer_cube_human`](https://huggingface.co/lerobot/act_aloha_sim_transfer_cube_human)
as a BMF policy bundle.

- Weights / `config.json` / `train_config.json`: upstream, unchanged (Apache-2.0)
- `manifest.json`: BMF-authored obs/act/safety (`sim_only: true`)

This is the “real checkpoint” follow-on to the dummy SO-100 fixture.

## Why this model (not FastWAM / VLA-JEPA)

The LeRobot org page leads with multi‑GB VLAs. Those are wrong for a first wrap:
too large to download casually, and not needed to prove the gate.

This ACT checkpoint is ~200 MB, official, `type: act`, and trained on **AlohaTransferCube-v0** (sim) — so `safety.simonly` is an honest claim.

## Build the bundle

```bash
./scripts/wrap-lerobot-act-aloha-sim.sh
# → spec/examples/lerobot_act_aloha_sim/dist/act_aloha_sim_transfer_cube_human.bmf.tar.zst
```

## Verify (BMF 0.2.1+)

```bash
npm install -g @mcflamingo/bmf-cli@0.2.1
# native once if needed:
#   cd "$(npm root -g)/@mcflamingo/bmf-node" && npm run build

bmf check-safety \
  spec/examples/lerobot_act_aloha_sim/dist/act_aloha_sim_transfer_cube_human.bmf.tar.zst \
  --hardware
# → REFUSED — safety.simonly
```

## Expected capabilities

- `policy.framework.lerobot`
- `policy.obs.rgb`, `policy.obs.proprio`
- `policy.act.joint`, `policy.act.chunk_size=100`, `policy.act.control_hz=50`
- `policy.embodiment.arm`
- `safety.simonly`, `safety.dead_man`

## HF publish (Erik)

Create a new public model (suggested id): **`MCFL/bmf-lerobot-act-aloha-sim-wrap`**

Upload from the wrap output + this folder:

| File | Source |
|------|--------|
| `README.md` | `spec/examples/hf-mcfl-act-aloha-sim-wrap/README.md` |
| `manifest.json` | this folder |
| `config.json` | upstream / this folder |
| `train_config.json` | upstream / this folder |
| `model.safetensors` | upstream (or from wrap workdir) |
| `act_aloha_sim_transfer_cube_human.bmf.tar.zst` | wrap script output |

Do **not** commit the ~190 MB `.tar.zst` or `.safetensors` into git.

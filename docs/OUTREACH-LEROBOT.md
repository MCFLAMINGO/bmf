# Outreach — BMF × LeRobot (ready to send)

## Target
- Hugging Face LeRobot Discord / Discussions, or
- A maintainer / robotics engineer who already uses SO-100 / LeRobot

## Subject / title
Signed capability gate for LeRobot policies — refuse `sim_only` before hardware

## Body (copy-paste)

Hi — we shipped a small open verifier for embodied policy bundles.

**BMF** (Bake Manifest Format) checks a LeRobot-shaped `.tar.zst` structurally in Rust and refuses hardware execution when `safety.simonly` is set. No weight loading, no inference — just a load-path gate you can drop in front of `robot.execute(policy)`.

2-minute demo:

```bash
npm install -g @mcflamingo/bmf-cli@0.2.1
huggingface-cli download MCFL/bmf-lerobot-so100-act-fixture \
  lerobot_so100_act.tar.zst --local-dir .
bmf check-safety lerobot_so100_act.tar.zst --hardware
# → REFUSED — safety.simonly
```

- Fixture (dummy weights, SO-100 shaped): https://huggingface.co/MCFL/bmf-lerobot-so100-act-fixture  
- Spec / Rust core: https://github.com/MCFLAMINGO/bmf  
- npm: `@mcflamingo/bmf-node` (Rust) + `@mcflamingo/bmf-cli`

**Ask:** Would you be open to wrapping one real public LeRobot checkpoint as a reference BMF policy bundle (we’ll do the manifest + CI check)? Happy to credit you / the project on the fixture page.

— Erik Osol / MCFL  
https://github.com/MCFLAMINGO/bmf

## Where to post
1. https://github.com/huggingface/lerobot/discussions — new discussion
2. LeRobot Discord (if you’re in it) — #general or #show-and-tell
3. Optional later: RAI / Unitree-adjacent once a real policy is wrapped

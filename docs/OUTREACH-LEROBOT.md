# Outreach — BMF × LeRobot (ready to send)

## Reality check (new accounts)

LeRobot Discord / GitHub Discussions often **block brand-new users**. That is not a BMF problem — you do **not** need contributor rights to finish the wedge.

Already shipped without their permission:
- npm `@mcflamingo/bmf-cli@0.2.1`
- public fixture https://huggingface.co/MCFL/bmf-lerobot-so100-act-fixture
- GitHub https://github.com/MCFLAMINGO/bmf

The “ask for a real checkpoint” is optional amplification. Use a channel you can actually post in.

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

## Where to post (if you’re blocked as a new user)

### Works now (preferred)
1. **Your own X account** — post the short version below, tag `@LeRobotHF`
2. **Your HF model Discussions** — https://huggingface.co/MCFL/bmf-lerobot-so100-act-fixture/discussions (you own this; new-user blocks usually don’t apply)
3. **Reply to a public LeRobot / SO-100 thread** you already can comment on (X, LinkedIn, blog)

### Often blocked for new accounts
4. https://github.com/huggingface/lerobot/discussions — needs GitHub discussion rights / account age
5. LeRobot Discord https://discord.gg/q8Dzzpym3f — often needs phone verify / account age; try again later, don’t spam join

### Do not do
- Open a fake “bug” issue on `huggingface/lerobot` just to advertise
- Mass-DM maintainers

## Short X version (copy-paste)

```
Signed capability gate for LeRobot policies:

download a .tar.zst → BMF verifies in Rust → refuses hardware if safety.simonly

npm i -g @mcflamingo/bmf-cli@0.2.1
hf download MCFL/bmf-lerobot-so100-act-fixture lerobot_so100_act.tar.zst
bmf check-safety lerobot_so100_act.tar.zst --hardware

Looking for one real public ACT/Diffusion checkpoint to wrap as a reference bundle.
@LeRobotHF https://github.com/MCFLAMINGO/bmf
```

## If nobody replies

You’re still fine. Next product move is wrap **any** public LeRobot checkpoint yourself (pick one from https://huggingface.co/lerobot) and publish a second fixture — no permission required for that.

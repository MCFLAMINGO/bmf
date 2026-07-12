## BMF 0.2.1 — LeRobot policy gate

npm upgrade over 0.2.0. Same spec (`bmf: "0.2.0"`). New: Rust policy bundle verification + hardware refuse.

### Why this release

Makes the fleet-gate demo installable without cloning the monorepo:

```bash
npm install -g @mcflamingo/bmf-cli@0.2.1
# build native once if prebuild missing for your OS:
#   cd $(npm root -g)/@mcflamingo/bmf-node && npm run build

huggingface-cli download MCFL/bmf-lerobot-so100-act-fixture \
  lerobot_so100_act.tar.zst --local-dir .

bmf check-safety lerobot_so100_act.tar.zst --hardware
# → REFUSED — safety.simonly
```

### What's new

- Rust `parse_policy` for `.tar` / `.tar.zst` (LeRobot fingerprint)
- Verified: `policy.framework.lerobot`, `policy.obs.*`, `policy.act.*`, `safety.simonly`, `safety.dead_man`
- CLI: `bmf check-safety <bundle> [--hardware]`
- SDK: `deriveCapabilities("policy", bytes)`, `checkHardwareAllowed(caps)`
- Fixture on Hugging Face: https://huggingface.co/MCFL/bmf-lerobot-so100-act-fixture
- Demo: `examples/lerobot-gate`

### Packages

- `@mcflamingo/bmf-node@0.2.1` (Rust)
- `@mcflamingo/bmf-sdk@0.2.1`
- `@mcflamingo/bmf-cli@0.2.1`
- `@mcflamingo/bmf-gateway@0.2.1`

### License

Apache-2.0.

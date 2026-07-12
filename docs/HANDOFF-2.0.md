# BMF 2.0 — durable handoff

**Product rule:** robotics kinds are Rust-only (`bmf-core`). The 0.2.0 upgrade is positioned for large robotics platform/lab buyers — one systems-language verifier, napi + PyO3 FFI, no TS fork of URDF/MJCF.

Author: cursor cloud agent  
Date: 2026-07-12  
Repo: `MCFLAMINGO/bmf`

## Ground truth

| Fact | Value |
|------|--------|
| Spec | **0.2.0** |
| Rust core | `core-rs/` — `bmf-core`, `bmf-node`, `bmf-py` |
| npm | `@mcflamingo/bmf-node`, `bmf-sdk`, `bmf-cli`, `bmf-gateway` @ 0.2.0 |
| Machine summary | `llms.txt` |
| Release notes | `RELEASE_NOTES_v0.2.0.md` |

## phys.* (characters)

`phys.muscle` / `phys.stance` / `phys.jump` — verified in TS SDK from GLB landmarks. Runtime: Wild Wallet `muscleModel.ts`.

## kin.* (robots — Rust)

Verified only via `@mcflamingo/bmf-node`. Build: `npm run build -w @mcflamingo/bmf-node`.

## Still open

Policy/trajectory/choreography kinds; multi-arch prebuilds; Arthur prod QA on Wild Wallet (private).

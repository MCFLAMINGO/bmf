# @mcflamingo/bmf-gateway

Reference BMF gateway. Single-file Express server, SQLite-backed, npx-runnable.

## Run

```bash
npx @mcflamingo/bmf-gateway
# bmf gateway 0.1.0 on http://localhost:8787
```

The first run generates an Ed25519 signing key at `./bmf-gateway.key` and a SQLite database at `./bmf-gateway.db`. Both paths are configurable via env.

## Environment

| Var | Default | Purpose |
|---|---|---|
| `PORT` | `8787` | Listen port |
| `BMF_DB` | `./bmf-gateway.db` | SQLite path |
| `BMF_KEY` | `./bmf-gateway.key` | Ed25519 private key (32 bytes, raw) |
| `BMF_PUBLIC_HOST` | `localhost:$PORT` | Host embedded in `bmf://` URIs |

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/.well-known/bmf.json` | Discovery |
| GET | `/bmf/v1/capabilities` | Verified + declared-only capability list |
| POST | `/bmf/v1/prepare` | Start an upload |
| POST | `/bmf/v1/chunk?upload_id=&index=` | Upload a chunk (raw bytes) |
| POST | `/bmf/v1/finalize` | Assemble, derive caps, sign, store |
| GET | `/bmf/v1/status/:upload_id` | `pending` / `signed` / `failed` |
| GET | `/bmf/v1/resolve/asset/:id` | Signed manifest |
| GET | `/api/asset/:kind/:id` | Raw asset bytes |

## Upload example

```bash
gw=http://localhost:8787
uid=$(curl -s -X POST $gw/bmf/v1/prepare \
       -H 'content-type: application/json' \
       -d '{"kind":"glb","mime":"model/gltf-binary","slug":"arthur","producer":"did:example:me"}' \
       | jq -r .upload_id)
curl -s -X POST "$gw/bmf/v1/chunk?upload_id=$uid&index=0" \
     -H 'content-type: application/octet-stream' --data-binary @arthur.glb
curl -s -X POST $gw/bmf/v1/finalize \
     -H 'content-type: application/json' -d "{\"upload_id\":\"$uid\"}" | jq .manifest
```

## Not in the reference

The reference gateway is minimal on purpose. In production you probably want:

- Auth on ingest (this gateway accepts anonymous uploads).
- Object storage for bytes instead of SQLite BLOBs.
- Key rotation and multi-key JWKS.
- Rate limiting.
- x402 payment settlement on paid assets.

These are out of scope for the reference — the point is to show the protocol works in ~250 LOC.

## License

Apache-2.0.

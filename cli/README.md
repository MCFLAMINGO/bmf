# @bmf/cli

Command-line tool for BMF manifests.

## Install

```bash
npm install -g @bmf/cli
# or run without installing:
npx @bmf/cli --help
```

## Commands

### `bmf verify <asset> <manifest.bmf.json>`

Verify the Ed25519 signature and check that `asset_hash` matches the asset bytes. Exits 0 on success, 1 on failure.

```bash
$ bmf verify ./arthur.glb ./arthur.bmf.json
  PASS  signature (ed25519)
  PASS  asset_hash matches — sha256:6b4836...
  PASS  bytes length — 7693848 declared / 7693848 actual

OK — manifest verifies.
```

### `bmf sign <asset> [options]`

Produce a fresh signed manifest for an asset. Derives verified capabilities from the bytes.

Options:

| Flag | Default | Purpose |
|---|---|---|
| `--kind <k>` | inferred from extension | `glb`, `urdf`, `mjcf`, `policy`, `dataset`, `trajectory-bundle` |
| `--key <file>` | ephemeral | Private key (32-byte raw Ed25519). Generate with `bmf keygen --out key.bin`. |
| `--producer <did>` | `did:example:local` | Producer DID recorded in the manifest. |
| `--recipient <did>` | equals `--producer` | Royalty chain recipient. |
| `--gateway <host>` | `local` | Gateway hostname embedded in the `bmf://` URI. |
| `--out <file>` | `<asset>.bmf.json` | Output manifest path. |

### `bmf inspect <bmf-uri | manifest.bmf.json>`

Pretty-print a manifest and check its signature. Works on files and on live `bmf://` URIs served by any BMF gateway.

### `bmf keygen [--out <file>]`

Generate a fresh Ed25519 keypair. Writes the private key to `--out` (binary, 32 bytes) and prints the public key to stdout.

## License

Apache-2.0.

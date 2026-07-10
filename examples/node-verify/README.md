# node-verify

Minimum-viable BMF client. Given a manifest URI, fetches it, verifies the Ed25519 signature, verifies `asset_hash` matches the bytes, and prints capabilities.

```bash
npm install
node index.mjs bmf://localhost:8787/asset/arthur-6b4836d2
```

Total logic: one call to `loadManifest(uri, { fetchBytes: true })`. Everything else is printing.

#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// @bmf/gateway — reference implementation.
//
// A single-file Express server that:
//   - accepts uploads via prepare/chunk/finalize,
//   - stores bytes + manifests in SQLite,
//   - derives verified capabilities from bytes,
//   - Ed25519-signs the manifest,
//   - serves /.well-known/bmf.json, /bmf/v1/capabilities, /bmf/v1/resolve, /api/asset.
//
// No Postgres, no external services, no shared state. Run:
//
//   npx @bmf/gateway
//
// Optional env:
//   PORT=8787              listen port
//   BMF_DB=/path/gw.db     SQLite path (default ./bmf-gateway.db)
//   BMF_KEY=/path/key.bin  32-byte Ed25519 private key (generated on first run)
//   BMF_PUBLIC_HOST=host   gateway host recorded in bmf:// URIs

import express from "express";
import Database from "better-sqlite3";
import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  BMF_VERSION,
  assertValidRoyaltyChain,
  assetHash,
  deriveCapabilities,
  keygen,
  mintBmfUri,
  parseBmfUri,
  signManifest,
  KINDS,
  type Kind,
  type UnsignedManifest,
} from "@bmf/sdk";

// ── config ──────────────────────────────────────────────────────────────────

const PORT = Number(process.env.PORT ?? 8787);
const DB_PATH = resolve(process.env.BMF_DB ?? "./bmf-gateway.db");
const KEY_PATH = resolve(process.env.BMF_KEY ?? "./bmf-gateway.key");
const PUBLIC_HOST = process.env.BMF_PUBLIC_HOST ?? `localhost:${PORT}`;

// ── key material ────────────────────────────────────────────────────────────

async function loadOrCreateKey(): Promise<{ privateKey: Uint8Array; publicKey: string }> {
  if (existsSync(KEY_PATH)) {
    const { publicKeyFromPrivate } = await import("@bmf/sdk");
    const privateKey = new Uint8Array(await readFile(KEY_PATH));
    const publicKey = await publicKeyFromPrivate(privateKey);
    return { privateKey, publicKey };
  }
  const kp = await keygen();
  await writeFile(KEY_PATH, kp.privateKey, { mode: 0o600 });
  process.stderr.write(`generated new signing key at ${KEY_PATH}\n`);
  return kp;
}

// ── db ──────────────────────────────────────────────────────────────────────

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS uploads (
    upload_id  TEXT PRIMARY KEY,
    kind       TEXT NOT NULL,
    mime       TEXT NOT NULL,
    slug       TEXT NOT NULL,
    producer   TEXT,
    recipient  TEXT,
    state      TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS chunks (
    upload_id TEXT NOT NULL,
    idx       INTEGER NOT NULL,
    bytes     BLOB NOT NULL,
    PRIMARY KEY (upload_id, idx)
  );
  CREATE TABLE IF NOT EXISTS assets (
    id         TEXT PRIMARY KEY,
    kind       TEXT NOT NULL,
    mime       TEXT NOT NULL,
    bytes      BLOB NOT NULL,
    manifest   TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
`);

const insertUpload = db.prepare(`
  INSERT INTO uploads (upload_id, kind, mime, slug, producer, recipient, state, created_at)
  VALUES (@upload_id, @kind, @mime, @slug, @producer, @recipient, 'pending', @created_at)
`);
const getUpload = db.prepare(`SELECT * FROM uploads WHERE upload_id = ?`);
const insertChunk = db.prepare(`INSERT OR REPLACE INTO chunks (upload_id, idx, bytes) VALUES (?, ?, ?)`);
const listChunks = db.prepare(`SELECT bytes FROM chunks WHERE upload_id = ? ORDER BY idx ASC`);
const clearChunks = db.prepare(`DELETE FROM chunks WHERE upload_id = ?`);
const upsertAsset = db.prepare(`
  INSERT INTO assets (id, kind, mime, bytes, manifest, created_at)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET manifest = excluded.manifest, created_at = excluded.created_at
`);
const getAsset = db.prepare(`SELECT * FROM assets WHERE id = ?`);
const claimUpload = db.prepare(`UPDATE uploads SET state = 'signed' WHERE upload_id = ? AND state = 'pending'`);

// ── app ─────────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json({ limit: "8mb" }));
app.use(express.raw({ type: "application/octet-stream", limit: "16mb" }));

const { privateKey, publicKey } = await loadOrCreateKey();

// ── discovery ──────────────────────────────────────────────────────────────

app.get("/.well-known/bmf.json", (_req, res) => {
  res.json({
    bmf: BMF_VERSION,
    gateway: `https://${PUBLIC_HOST}`,
    public_key: publicKey,
    endpoints: {
      capabilities: "/bmf/v1/capabilities",
      resolve:      "/bmf/v1/resolve/asset/{id}",
      prepare:      "/bmf/v1/prepare",
      chunk:        "/bmf/v1/chunk",
      finalize:     "/bmf/v1/finalize",
      status:       "/bmf/v1/status/{upload_id}",
      asset:        "/api/asset/{kind}/{id}",
    },
  });
});

app.get("/bmf/v1/capabilities", (_req, res) => {
  res.json({
    bmf: BMF_VERSION,
    namespaces: ["humanoid", "mesh", "anim", "face", "kin", "policy", "skill", "data", "safety"],
    verified: [
      "humanoid.mixamo24", "mesh.singleroot",
      "anim.gaze", "anim.breathe", "anim.wave", "anim.crouch", "anim.locomotion",
    ],
    declared_only: [
      "humanoid.vrm", "face.arkit52", "face.perfectsync",
      "safety.simonly", "safety.workspace.limits", "safety.dead_man",
    ],
  });
});

// ── ingest ─────────────────────────────────────────────────────────────────

app.post("/bmf/v1/prepare", (req, res, next) => {
  try {
    const { kind, mime, slug, producer, recipient } = req.body ?? {};
    if (!kind || !mime || !slug) return res.status(400).json({ error: "kind, mime, slug required" });
    if (!KINDS.includes(kind)) return res.status(400).json({ error: `unknown kind: ${kind}` });
    const upload_id = randomBytes(12).toString("hex");
    insertUpload.run({ upload_id, kind, mime, slug, producer: producer ?? null, recipient: recipient ?? null, created_at: Date.now() });
    res.json({ upload_id, chunk_size: 4 * 1024 * 1024 });
  } catch (e) { next(e); }
});

app.post("/bmf/v1/chunk", (req, res, next) => {
  try {
    const upload_id = String(req.query.upload_id ?? "");
    const index = Number(req.query.index);
    if (!Number.isInteger(index) || index < 0) return res.status(400).json({ error: "index must be a non-negative integer" });
    const upload = getUpload.get(upload_id) as { state: string } | undefined;
    if (!upload) return res.status(404).json({ error: "unknown upload_id" });
    if (upload.state !== "pending") return res.status(409).json({ error: "upload already finalized" });
    if (!Buffer.isBuffer(req.body)) return res.status(400).json({ error: "chunk body must be application/octet-stream" });
    insertChunk.run(upload_id, index, req.body);
    res.json({ ok: true, index, bytes: req.body.length });
  } catch (e) { next(e); }
});

app.post("/bmf/v1/finalize", async (req, res, next) => {
  try {
    const upload_id = String(req.body?.upload_id ?? "");
    const upload = getUpload.get(upload_id) as
      | { kind: Kind; mime: string; slug: string; producer: string | null; recipient: string | null; state: string }
      | undefined;
    if (!upload) return res.status(404).json({ error: "unknown upload_id" });

    // Atomic claim: only one concurrent finalizer wins.
    const claimed = claimUpload.run(upload_id);
    if (claimed.changes === 0) return res.status(409).json({ error: "already finalized" });

    const rows = listChunks.all(upload_id) as Array<{ bytes: Buffer }>;
    if (rows.length === 0) return res.status(400).json({ error: "no chunks uploaded" });
    const bytes = Buffer.concat(rows.map((r) => r.bytes));
    const hash = await assetHash(bytes);

    const capabilities = deriveCapabilities(upload.kind, bytes);
    const producer = upload.producer ?? "did:bmf:gateway";
    const recipient = upload.recipient ?? producer;
    const royalty_chain = [{ recipient, share_bps: 10000 }];
    assertValidRoyaltyChain(royalty_chain);

    const uri = mintBmfUri(PUBLIC_HOST, upload.slug, hash);
    const parsed = parseBmfUri(uri);
    if (!parsed) throw new Error("internal: minted URI failed to parse");

    const unsigned: UnsignedManifest = {
      bmf: BMF_VERSION,
      id: uri,
      kind: upload.kind,
      mime: upload.mime,
      bytes: bytes.length,
      asset_hash: hash,
      capabilities,
      provenance: [],
      royalty_chain,
      producer,
      issued_at: new Date().toISOString(),
      expires_at: null,
    };
    const manifest = await signManifest(unsigned, privateKey);
    // Content-addressed: same id -> same bytes. Re-signing an identical asset is idempotent.
    upsertAsset.run(parsed.id, upload.kind, upload.mime, bytes, JSON.stringify(manifest), Date.now());
    clearChunks.run(upload_id);
    res.json({ manifest });
  } catch (e) { next(e); }
});

app.get("/bmf/v1/status/:upload_id", (req, res) => {
  const row = getUpload.get(req.params.upload_id) as { state: string } | undefined;
  if (!row) return res.status(404).json({ error: "unknown upload_id" });
  res.json({ state: row.state });
});

// Central error handler — never let an async throw kill the process.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  process.stderr.write(`bmf gateway error: ${(err as Error)?.stack ?? String(err)}\n`);
  if (res.headersSent) return;
  res.status(500).json({ error: "internal error" });
});

// ── resolve + serve ────────────────────────────────────────────────────────

app.get("/bmf/v1/resolve/asset/:id", (req, res) => {
  const row = getAsset.get(req.params.id) as { manifest: string } | undefined;
  if (!row) return res.status(404).json({ error: "unknown asset id" });
  res.type("application/json").send(row.manifest);
});

app.get("/api/asset/:kind/:id", (req, res) => {
  const row = getAsset.get(req.params.id) as { kind: string; mime: string; bytes: Buffer } | undefined;
  if (!row) return res.status(404).json({ error: "unknown asset id" });
  if (row.kind !== req.params.kind) return res.status(400).json({ error: `kind mismatch: asset is ${row.kind}` });
  res.type(row.mime).send(row.bytes);
});

// ── go ─────────────────────────────────────────────────────────────────────

const server = app.listen(PORT, () => {
  process.stdout.write(`bmf gateway ${BMF_VERSION} on http://localhost:${PORT}\n  db:   ${DB_PATH}\n  key:  ${KEY_PATH}\n  host: ${PUBLIC_HOST}\n`);
});

process.on("SIGTERM", () => server.close(() => process.exit(0)));
process.on("SIGINT",  () => server.close(() => process.exit(0)));

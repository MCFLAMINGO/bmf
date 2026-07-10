#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// @bmf/cli — command-line tool.
//
// Commands:
//   bmf verify <asset> <manifest>       Verify signature + asset_hash.
//   bmf sign   <asset> [--out <file>]   Sign a fresh manifest for an asset.
//   bmf inspect <uri-or-file>           Pretty-print a manifest with a summary.
//   bmf keygen [--out <file>]           Generate an Ed25519 keypair.

import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import {
  assetHash,
  assertValidRoyaltyChain,
  BMF_VERSION,
  deriveCapabilities,
  isKind,
  KINDS,
  keygen,
  loadManifest,
  mintBmfUri,
  signManifest,
  verifyManifest,
  type Kind,
  type Manifest,
  type UnsignedManifest,
} from "@bmf/sdk";

const USAGE = `bmf ${BMF_VERSION}

Usage:
  bmf verify <asset> <manifest.bmf.json>
  bmf sign   <asset> [--kind glb|urdf|mjcf|policy|dataset|trajectory-bundle]
                     [--key <private-key-file>] [--producer <did>]
                     [--recipient <did>] [--gateway <host>]
                     [--out <manifest.bmf.json>]
  bmf inspect <bmf-uri | manifest.bmf.json>
  bmf keygen [--out <private-key-file>]
`;

async function main(argv: string[]): Promise<number> {
  const [cmd, ...rest] = argv;
  switch (cmd) {
    case "verify":  return cmdVerify(rest);
    case "sign":    return cmdSign(rest);
    case "inspect": return cmdInspect(rest);
    case "keygen":  return cmdKeygen(rest);
    case "-h": case "--help": case undefined:
      process.stdout.write(USAGE);
      return 0;
    default:
      process.stderr.write(`unknown command: ${cmd}\n\n${USAGE}`);
      return 2;
  }
}

// ── verify ──────────────────────────────────────────────────────────────────

async function cmdVerify(args: string[]): Promise<number> {
  const [assetPath, manifestPath] = args;
  if (!assetPath || !manifestPath) {
    process.stderr.write("usage: bmf verify <asset> <manifest.bmf.json>\n");
    return 2;
  }
  const bytes = new Uint8Array(await readFile(assetPath));
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Manifest;

  const versionOk = manifest.bmf === BMF_VERSION;
  const notExpired = !manifest.expires_at || Date.parse(manifest.expires_at) >= Date.now();
  const sigOk = await verifyManifest(manifest);
  const actualHash = await assetHash(bytes);
  const hashOk = actualHash === manifest.asset_hash;
  const bytesOk = manifest.bytes === bytes.byteLength;

  const rows: [string, boolean, string?][] = [
    ["bmf version",         versionOk, `${manifest.bmf} declared / ${BMF_VERSION} supported`],
    ["not expired",         notExpired, manifest.expires_at ?? "no expiry"],
    ["signature (ed25519)", sigOk],
    ["asset_hash matches",  hashOk, hashOk ? actualHash : `expected ${manifest.asset_hash}, got ${actualHash}`],
    ["bytes length",        bytesOk, `${manifest.bytes} declared / ${bytes.byteLength} actual`],
  ];
  for (const [label, ok, detail] of rows) {
    const mark = ok ? "PASS" : "FAIL";
    process.stdout.write(`  ${mark}  ${label}${detail ? ` — ${detail}` : ""}\n`);
  }
  const allOk = rows.every((r) => r[1]);
  process.stdout.write(allOk ? "\nOK — manifest verifies.\n" : "\nFAILED — manifest does NOT verify.\n");
  return allOk ? 0 : 1;
}

// ── sign ────────────────────────────────────────────────────────────────────

async function cmdSign(args: string[]): Promise<number> {
  const { positional, flags } = parseFlags(args);
  const assetPath = positional[0];
  if (!assetPath) {
    process.stderr.write("usage: bmf sign <asset> [options]\n");
    return 2;
  }
  const kind: Kind = flags.kind ? (isKind(flags.kind) ? flags.kind : (() => {
    process.stderr.write(`unknown --kind: ${flags.kind}. Expected one of: ${KINDS.join(", ")}\n`);
    process.exit(2);
  })()) : guessKind(assetPath);
  const outPath = flags.out || `${assetPath}.bmf.json`;

  let privateKey: Uint8Array;
  if (flags.key) {
    privateKey = new Uint8Array(await readFile(flags.key));
  } else {
    const kp = await keygen();
    privateKey = kp.privateKey;
    process.stderr.write("note: generated an ephemeral keypair. Save with `bmf keygen --out key.bin` for reproducible signing.\n");
  }

  const bytes = new Uint8Array(await readFile(assetPath));
  const hash = await assetHash(bytes);
  const capabilities = deriveCapabilities(kind, bytes);

  const producer = flags.producer || "did:example:local";
  const recipient = flags.recipient || producer;
  const gateway = flags.gateway || "local";
  const royalty_chain = [{ recipient, share_bps: 10000 }];
  assertValidRoyaltyChain(royalty_chain);

  const unsigned: UnsignedManifest = {
    bmf: BMF_VERSION,
    id: mintBmfUri(gateway, basename(assetPath).replace(/\.[^.]+$/, ""), hash),
    kind,
    mime: mimeFor(kind),
    bytes: bytes.byteLength,
    asset_hash: hash,
    capabilities,
    provenance: [],
    royalty_chain,
    producer,
    issued_at: new Date().toISOString(),
    expires_at: null,
  };
  const signed = await signManifest(unsigned, privateKey);
  await writeFile(outPath, JSON.stringify(signed, null, 2));
  process.stdout.write(`signed ${outPath}\n  id:           ${signed.id}\n  kind:         ${kind}\n  bytes:        ${signed.bytes}\n  capabilities: ${capabilities.join(", ") || "(none derived)"}\n`);
  return 0;
}

// ── inspect ─────────────────────────────────────────────────────────────────

async function cmdInspect(args: string[]): Promise<number> {
  const target = args[0];
  if (!target) {
    process.stderr.write("usage: bmf inspect <bmf-uri | manifest.bmf.json>\n");
    return 2;
  }
  let manifest: Manifest;
  let verified: boolean;
  if (target.startsWith("bmf://") || target.startsWith("http://") || target.startsWith("https://")) {
    const r = await loadManifest(target, { fetchBytes: false });
    manifest = r.manifest;
    verified = r.verified;
  } else {
    manifest = JSON.parse(await readFile(target, "utf8")) as Manifest;
    verified = await verifyManifest(manifest);
  }
  process.stdout.write(JSON.stringify(manifest, null, 2) + "\n");
  process.stdout.write(`\n  signature: ${verified ? "OK" : "FAIL"}\n  bytes:     ${manifest.bytes}\n  kind:      ${manifest.kind}\n  caps:      ${manifest.capabilities.length}\n`);
  return verified ? 0 : 1;
}

// ── keygen ──────────────────────────────────────────────────────────────────

async function cmdKeygen(args: string[]): Promise<number> {
  const { flags } = parseFlags(args);
  const { publicKey, privateKey } = await keygen();
  if (flags.out) {
    await writeFile(flags.out, privateKey);
    process.stdout.write(`wrote private key: ${flags.out}\npublic_key: ${publicKey}\n`);
  } else {
    process.stdout.write(`public_key: ${publicKey}\nprivate_key_hex: ${Buffer.from(privateKey).toString("hex")}\n`);
  }
  return 0;
}

// ── helpers ─────────────────────────────────────────────────────────────────

interface Flags {
  positional: string[];
  flags: Record<string, string>;
}

function parseFlags(argv: string[]): Flags {
  const out: Flags = { positional: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) { out.flags[key] = next; i++; }
      else out.flags[key] = "";
    } else {
      out.positional.push(a);
    }
  }
  return out;
}

function guessKind(path: string): Kind {
  const ext = path.toLowerCase().split(".").pop() ?? "";
  if (ext === "glb") return "glb";
  if (ext === "urdf") return "urdf";
  if (ext === "mjcf" || ext === "xml") return "mjcf";
  if (["safetensors", "pt", "pth", "bin", "ckpt"].includes(ext)) return "policy";
  return "glb";
}

function mimeFor(kind: Kind): string {
  switch (kind) {
    case "glb":  return "model/gltf-binary";
    case "urdf": return "application/xml";
    case "mjcf": return "application/xml";
    case "policy": return "application/octet-stream";
    case "dataset": return "application/x-lerobot-dataset";
    case "trajectory-bundle": return "application/x-bmf-trajectory";
  }
}

main(process.argv.slice(2))
  .then((code) => { process.exitCode = code; })
  .catch((err) => {
    process.stderr.write((err as Error).stack ?? String(err));
    process.stderr.write("\n");
    process.exitCode = 1;
  });

// SPDX-License-Identifier: Apache-2.0
// BMF SDK — Ed25519 signing and verification.
//
// Uses @noble/ed25519, which is audited, zero-dependency, and works in every
// JS runtime. Public keys and signatures are base64url with a "base64url:" prefix
// so a signature field is self-describing (per SPEC.md §3.4).

import * as ed from "@noble/ed25519";
import { canonicalize } from "./canonicalize.js";
import type { Manifest, Signature, UnsignedManifest } from "./types.js";

const B64U = "base64url:";

function b64uEncode(bytes: Uint8Array): string {
  // Buffer is available in Node/Bun/Deno. Browsers need a shim; keep simple for 0.1.0.
  return B64U + Buffer.from(bytes).toString("base64url");
}

function b64uDecode(s: string): Uint8Array {
  if (!s.startsWith(B64U)) throw new Error(`BMF: expected ${B64U} prefix`);
  return new Uint8Array(Buffer.from(s.slice(B64U.length), "base64url"));
}

/** Generate a fresh Ed25519 keypair. */
export async function keygen(): Promise<{ publicKey: string; privateKey: Uint8Array }> {
  const privateKey = ed.utils.randomPrivateKey();
  const publicKey = await publicKeyFromPrivate(privateKey);
  return { publicKey, privateKey };
}

/** Derive the base64url-prefixed public key string from a raw 32-byte private key. */
export async function publicKeyFromPrivate(privateKey: Uint8Array): Promise<string> {
  return b64uEncode(await ed.getPublicKeyAsync(privateKey));
}

/** Sign an unsigned manifest, returning a signed manifest. */
export async function signManifest(
  unsigned: UnsignedManifest,
  privateKey: Uint8Array,
): Promise<Manifest> {
  const publicKey = await ed.getPublicKeyAsync(privateKey);
  const payload = new TextEncoder().encode(canonicalize(unsigned));
  const sig = await ed.signAsync(payload, privateKey);
  const signature: Signature = {
    alg: "ed25519",
    public_key: b64uEncode(publicKey),
    value: b64uEncode(sig),
  };
  return { ...unsigned, signature };
}

/**
 * Verify a manifest's Ed25519 signature. Returns `false` for anything that
 * isn't a valid ed25519 signature — never throws. Does NOT check that the
 * bytes match `asset_hash`; compare `assetHash(bytes)` to `manifest.asset_hash`
 * yourself, or use `loadManifest({ fetchBytes: true })`.
 */
export async function verifyManifest(manifest: Manifest): Promise<boolean> {
  try {
    const { signature, ...unsigned } = manifest ?? ({} as Manifest);
    if (signature?.alg !== "ed25519") return false;
    const payload = new TextEncoder().encode(canonicalize(unsigned));
    return await ed.verifyAsync(b64uDecode(signature.value), payload, b64uDecode(signature.public_key));
  } catch {
    return false;
  }
}

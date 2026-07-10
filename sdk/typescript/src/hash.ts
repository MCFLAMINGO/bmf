// SPDX-License-Identifier: Apache-2.0
// BMF SDK — SHA-256 helpers. Uses the platform Web Crypto API so this SDK
// works unchanged in Node 20+, Deno, Bun, Cloudflare Workers, and browsers.

import type { Sha256 } from "./types.js";

const HEX = "0123456789abcdef";

function toHex(buf: ArrayBuffer): string {
  const view = new Uint8Array(buf);
  let out = "";
  for (let i = 0; i < view.length; i++) {
    const b = view[i]!;
    out += HEX[b >>> 4]! + HEX[b & 0x0f]!;
  }
  return out;
}

export async function sha256Hex(bytes: Uint8Array | ArrayBuffer): Promise<string> {
  // subtle.digest wants an ArrayBuffer view whose bytes exactly match what we
  // want to hash. Node's Buffer.prototype.slice returns a view over shared pool
  // memory (not a copy), so we build a fresh ArrayBuffer whenever the input
  // isn't already a standalone one.
  let data: ArrayBuffer;
  if (bytes instanceof Uint8Array) {
    if (
      bytes.byteOffset === 0 &&
      bytes.byteLength === bytes.buffer.byteLength &&
      bytes.buffer instanceof ArrayBuffer &&
      Object.getPrototypeOf(bytes) === Uint8Array.prototype
    ) {
      data = bytes.buffer;
    } else {
      const copy = new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      data = copy.buffer;
    }
  } else {
    data = bytes;
  }
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(digest);
}

export async function assetHash(bytes: Uint8Array | ArrayBuffer): Promise<Sha256> {
  return `sha256:${await sha256Hex(bytes)}` as Sha256;
}

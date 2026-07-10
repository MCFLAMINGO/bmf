// SPDX-License-Identifier: Apache-2.0
// BMF SDK — URI helpers.

import type { BmfUri, Sha256 } from "./types.js";

/**
 * Mint a BMF URI: `bmf://<gateway>/asset/<slug>-<hash8>`.
 * `slug` is sanitized; `hash` is the asset_hash (`sha256:...`).
 */
export function mintBmfUri(gateway: string, slug: string, hash: Sha256): BmfUri {
  const hash8 = hash.slice(7, 15);
  const safeSlug = slug.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 64) || "asset";
  return `bmf://${gateway}/asset/${safeSlug}-${hash8}`;
}

/** Extract the opaque asset id from a `bmf://` URI, or return null. */
export function parseBmfUri(uri: string): { gateway: string; id: string } | null {
  const m = uri.match(/^bmf:\/\/([^/]+)\/asset\/(.+)$/);
  return m ? { gateway: m[1]!, id: m[2]! } : null;
}

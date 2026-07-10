// SPDX-License-Identifier: Apache-2.0
// BMF SDK — client-side manifest loading over HTTP.

import { assetHash } from "./hash.js";
import { verifyManifest } from "./signing.js";
import { parseBmfUri } from "./uri.js";
import { BMF_VERSION, type Manifest } from "./types.js";

export interface LoadOptions {
  /**
   * If provided, overrides the gateway host embedded in the bmf:// URI.
   * Useful when the URI is stable but you want to point at a mirror.
   */
  gateway?: string;
  /** Also fetch the asset bytes and verify asset_hash. Default true. */
  fetchBytes?: boolean;
  /** Custom fetch implementation. Defaults to globalThis.fetch. */
  fetch?: typeof fetch;
}

export interface LoadResult {
  manifest: Manifest;
  bytes: Uint8Array | null;
  /** True iff signature verified AND (if fetched) asset_hash matches bytes. */
  verified: boolean;
}

/**
 * Load and verify a BMF manifest given a `bmf://` URI or a direct HTTPS resolve URL.
 * Throws on network/parse errors; returns { verified: false } if verification fails.
 */
export async function loadManifest(uri: string, opts: LoadOptions = {}): Promise<LoadResult> {
  const doFetch = opts.fetch ?? fetch;
  const fetchBytes = opts.fetchBytes ?? true;

  const manifestUrl = resolveManifestUrl(uri, opts.gateway);
  const res = await doFetch(manifestUrl);
  if (!res.ok) throw new Error(`BMF loadManifest: ${res.status} from ${manifestUrl}`);
  const manifest = (await res.json()) as Manifest;

  if (manifest?.bmf !== BMF_VERSION) return { manifest, bytes: null, verified: false };
  if (manifest.expires_at && Date.parse(manifest.expires_at) < Date.now()) return { manifest, bytes: null, verified: false };

  const sigOk = await verifyManifest(manifest);
  if (!sigOk) return { manifest, bytes: null, verified: false };

  if (!fetchBytes) return { manifest, bytes: null, verified: true };

  const assetUrl = resolveAssetUrl(manifest, opts.gateway);
  const assetRes = await doFetch(assetUrl);
  if (!assetRes.ok) throw new Error(`BMF loadManifest: asset ${assetRes.status} from ${assetUrl}`);
  const bytes = new Uint8Array(await assetRes.arrayBuffer());
  const actualHash = await assetHash(bytes);
  const hashOk = actualHash === manifest.asset_hash;
  return { manifest, bytes, verified: hashOk };
}

/** `http` for localhost/loopback hosts, `https` otherwise. */
function schemeFor(host: string): "http" | "https" {
  const hostname = host.split(":")[0] ?? host;
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") return "http";
  return "https";
}

function resolveManifestUrl(uri: string, gatewayOverride?: string): string {
  if (uri.startsWith("http://") || uri.startsWith("https://")) return uri;
  const parsed = parseBmfUri(uri);
  if (!parsed) throw new Error(`BMF loadManifest: not a bmf:// or https:// URI: ${uri}`);
  const host = gatewayOverride ?? parsed.gateway;
  return `${schemeFor(host)}://${host}/bmf/v1/resolve/asset/${parsed.id}`;
}

function resolveAssetUrl(manifest: Manifest, gatewayOverride?: string): string {
  const parsed = parseBmfUri(manifest.id);
  if (!parsed) throw new Error(`BMF loadManifest: manifest.id is not a bmf:// URI: ${manifest.id}`);
  const host = gatewayOverride ?? parsed.gateway;
  return `${schemeFor(host)}://${host}/api/asset/${manifest.kind}/${parsed.id}`;
}

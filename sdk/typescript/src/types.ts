// SPDX-License-Identifier: Apache-2.0
// BMF SDK — public types. Aligned with spec/SPEC.md §3.

export const BMF_VERSION = "0.2.0" as const;

/** Spec versions this SDK can verify. New signs always use `BMF_VERSION`. */
export const BMF_VERSIONS_SUPPORTED = ["0.1.0", "0.2.0"] as const;

export type Sha256 = `sha256:${string}`;
export type BmfUri = string;
export type Capability = string;

/** All kinds recognized by this SDK. Runtime validation should use `KINDS`. */
export const KINDS = ["glb", "urdf", "mjcf", "policy", "dataset", "trajectory-bundle"] as const;
export type Kind = typeof KINDS[number];

/** True when `s` is a Kind this SDK knows how to handle. */
export function isKind(s: unknown): s is Kind {
  return typeof s === "string" && (KINDS as readonly string[]).includes(s);
}

export interface Provenance {
  /** source | rig | retexture | remesh | retarget | train | finetune | edit | custom:<name> */
  step: string;
  source?: string;
  notes?: string;
}

export interface Royalty {
  recipient: string;
  share_bps: number;
}

export interface X402Price {
  amount: string;
  currency: string;
  chain: string;
}

export interface X402Challenge {
  price: X402Price;
  recipient: string;
}

export interface Signature {
  alg: "ed25519";
  /** Raw 32-byte Ed25519 public key, base64url-encoded, prefixed with `base64url:`. */
  public_key: string;
  /** base64url signature, prefixed with `base64url:` */
  value: string;
}

export interface UnsignedManifest {
  bmf: typeof BMF_VERSION;
  id: BmfUri;
  kind: Kind;
  mime: string;
  bytes: number;
  asset_hash: Sha256;
  capabilities: Capability[];
  provenance: Provenance[];
  royalty_chain: Royalty[];
  x402?: X402Challenge;
  producer?: string;
  metadata?: Record<string, unknown>;
  issued_at: string;
  expires_at: string | null;
}

export interface Manifest extends UnsignedManifest {
  signature: Signature;
}

// SPDX-License-Identifier: Apache-2.0
// @mcflamingo/bmf-sdk — public API.

export { BMF_VERSION, KINDS, isKind } from "./types.js";
export type {
  BmfUri, Capability, Kind, Manifest, Provenance, Royalty,
  Sha256, Signature, UnsignedManifest, X402Challenge, X402Price,
} from "./types.js";

export { canonicalize } from "./canonicalize.js";
export { assetHash, sha256Hex } from "./hash.js";
export { keygen, publicKeyFromPrivate, signManifest, verifyManifest } from "./signing.js";
export { deriveCapabilities, hasCapability } from "./derive.js";
export { assertValidRoyaltyChain, royaltyBpsSum } from "./royalties.js";
export { mintBmfUri, parseBmfUri } from "./uri.js";
export { loadManifest } from "./load.js";
export type { LoadOptions, LoadResult } from "./load.js";
export { loadNative } from "./native.js";

// Kind-specific exports for advanced use.
export { deriveGlbCapabilities, inspectGlb } from "./kinds/glb.js";
export type { GlbLandmarks } from "./kinds/glb.js";
export {
  deriveRobotCapabilities,
  sniffRobotKind,
  verifyRobotDescriptor,
} from "./kinds/robot.js";

// SPDX-License-Identifier: Apache-2.0
// BMF SDK — capability derivation dispatch. One entry point per kind.
// Add a new kind by adding a case here and a file under src/kinds/.

import { deriveGlbCapabilities, inspectGlb } from "./kinds/glb.js";
import type { Capability, Kind } from "./types.js";

/**
 * Derive the verified capability set for an asset given its bytes and kind.
 * Returns [] if the kind is not yet implemented (URDF/MJCF/policy at 0.1.0).
 */
export function deriveCapabilities(kind: Kind, bytes: Uint8Array): Capability[] {
  switch (kind) {
    case "glb": {
      const landmarks = inspectGlb(bytes);
      return landmarks ? deriveGlbCapabilities(landmarks) : [];
    }
    case "urdf":
    case "mjcf":
    case "policy":
    case "dataset":
    case "trajectory-bundle":
      // Stubs — validators land in 0.2.0. Producers may still declare
      // capabilities suffixed with `!`; the gateway records but does not verify.
      return [];
  }
}

export function hasCapability(
  manifest: { capabilities: Capability[] },
  cap: Capability,
): boolean {
  // A verified capability satisfies a query for its own name AND for the
  // declared-only form. A declared-only capability (with `!`) only satisfies
  // the declared-only query.
  return manifest.capabilities.includes(cap) || manifest.capabilities.includes(`${cap}!`);
}

// SPDX-License-Identifier: Apache-2.0
// BMF SDK — capability derivation dispatch. One entry point per kind.
// Add a new kind by adding a case here and a file under src/kinds/.

import { deriveGlbCapabilities, inspectGlb } from "./kinds/glb.js";
import { derivePolicyCapabilities, sniffPolicyBundle } from "./kinds/policy.js";
import { deriveRobotCapabilities } from "./kinds/robot.js";
import type { Capability, Kind } from "./types.js";

/**
 * Derive the verified capability set for an asset given its bytes and kind.
 * GLB is pure-TS. URDF/MJCF/policy require the Rust `bmf-node` addon
 * (returns [] when the native core is not built). Dataset/trajectory
 * remain stubs until later 0.2.x days.
 */
export function deriveCapabilities(kind: Kind, bytes: Uint8Array): Capability[] {
  switch (kind) {
    case "glb": {
      const landmarks = inspectGlb(bytes);
      return landmarks ? deriveGlbCapabilities(landmarks) : [];
    }
    case "urdf":
    case "mjcf":
      return deriveRobotCapabilities(kind, bytes);
    case "policy":
      return derivePolicyCapabilities(bytes);
    case "dataset":
    case "trajectory-bundle":
      // Stubs — validators land later in 0.2.x. Producers may still declare
      // capabilities suffixed with `!`; the gateway records but does not verify.
      return [];
  }
}

export { sniffPolicyBundle };


export function hasCapability(
  manifest: { capabilities: Capability[] },
  cap: Capability,
): boolean {
  // A verified capability satisfies a query for its own name AND for the
  // declared-only form. A declared-only capability (with `!`) only satisfies
  // the declared-only query.
  return manifest.capabilities.includes(cap) || manifest.capabilities.includes(`${cap}!`);
}

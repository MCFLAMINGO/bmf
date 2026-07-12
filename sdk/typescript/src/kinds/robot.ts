// SPDX-License-Identifier: Apache-2.0
// BMF SDK — URDF / MJCF kind dispatch via the Rust core (bmf-node).
//
// Capability names are flattened to the string form the rest of the SDK uses
// (`kin.dof.arm=7`). When the native addon is missing, returns [].

import { loadNative } from "../native.js";
import type { Capability, Kind } from "../types.js";

interface NativeCap {
  name: string;
  attrs?: Record<string, string>;
}

interface NativeParseResult {
  capabilities: NativeCap[];
}

/** Detect URDF vs MJCF from leading bytes (XML sniff). Returns null if unknown. */
export function sniffRobotKind(bytes: Uint8Array): "urdf" | "mjcf" | null {
  const head = new TextDecoder("utf-8", { fatal: false })
    .decode(bytes.subarray(0, Math.min(bytes.length, 4096)))
    .toLowerCase();
  if (head.includes("<mujoco")) return "mjcf";
  if (head.includes("<robot")) return "urdf";
  return null;
}

function flattenCap(c: NativeCap): Capability {
  const dof = c.attrs?.dof;
  if (c.name === "kin.dof.arm" && dof) return `kin.dof.arm=${dof}`;
  return c.name;
}

/**
 * Derive verified kin.* / safety.* capabilities for a robot descriptor.
 * `kind` must be `urdf` or `mjcf`. Returns [] if native core is unavailable
 * or the parse fails.
 */
export function deriveRobotCapabilities(kind: Kind, bytes: Uint8Array): Capability[] {
  if (kind !== "urdf" && kind !== "mjcf") return [];
  const native = loadNative();
  if (!native) return [];

  const src = new TextDecoder("utf-8").decode(bytes);
  let raw: string;
  try {
    raw = kind === "urdf" ? native.parseUrdf(src) : native.parseMjcf(src);
  } catch {
    return [];
  }

  let parsed: NativeParseResult;
  try {
    parsed = JSON.parse(raw) as NativeParseResult;
  } catch {
    return [];
  }

  const caps = (parsed.capabilities ?? []).map(flattenCap);
  return [...new Set(caps)].sort();
}

/**
 * Convenience entry: sniff format from bytes, then derive. Returns [] when
 * the bytes are not a recognized robot descriptor or native core is missing.
 */
export function verifyRobotDescriptor(bytes: Uint8Array): Capability[] {
  const kind = sniffRobotKind(bytes);
  if (!kind) return [];
  return deriveRobotCapabilities(kind, bytes);
}

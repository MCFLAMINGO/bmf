// SPDX-License-Identifier: Apache-2.0
// BMF SDK — policy kind via Rust bmf-core (LeRobot / BMF policy bundles).

import { loadNative } from "../native.js";
import type { Capability } from "../types.js";

interface NativeCap {
  name: string;
  attrs?: Record<string, string>;
}

interface NativePolicyResult {
  capabilities: NativeCap[];
}

function flattenCap(c: NativeCap): Capability {
  if (c.name === "policy.act.chunk_size" && c.attrs?.n) {
    return `policy.act.chunk_size=${c.attrs.n}`;
  }
  if (c.name === "policy.act.control_hz" && c.attrs?.hz) {
    return `policy.act.control_hz=${c.attrs.hz}`;
  }
  return c.name;
}

/** True when bytes look like a tar or zstd-compressed tar. */
export function sniffPolicyBundle(bytes: Uint8Array): boolean {
  if (bytes.length >= 4 && bytes[0] === 0x28 && bytes[1] === 0xb5 && bytes[2] === 0x2f && bytes[3] === 0xfd) {
    return true; // zstd
  }
  // ustar at offset 257
  if (bytes.length > 262) {
    const mag = String.fromCharCode(...bytes.subarray(257, 262));
    if (mag === "ustar") return true;
  }
  return false;
}

/**
 * Derive verified policy.* / safety.* capabilities from a `.tar` / `.tar.zst`
 * policy bundle via Rust. Returns [] if native core is unavailable.
 */
export function derivePolicyCapabilities(bytes: Uint8Array): Capability[] {
  const native = loadNative();
  if (!native?.parsePolicy) return [];
  let raw: string;
  try {
    raw = native.parsePolicy(Buffer.from(bytes));
  } catch {
    return [];
  }
  let parsed: NativePolicyResult;
  try {
    parsed = JSON.parse(raw) as NativePolicyResult;
  } catch {
    return [];
  }
  return [...new Set((parsed.capabilities ?? []).map(flattenCap))].sort();
}

/** Hardware gate via Rust. `allowed: false` when `safety.simonly` is present. */
export function checkHardwareAllowed(capabilities: Capability[]): {
  allowed: boolean;
  reason: string | null;
} {
  const native = loadNative();
  if (!native?.checkHardwareAllowed) {
    // Fail closed if we cannot ask Rust: simonly in the list → refuse.
    if (capabilities.includes("safety.simonly")) {
      return {
        allowed: false,
        reason:
          "BMF refusal: capability safety.simonly — this policy MUST NOT run on physical hardware",
      };
    }
    return { allowed: true, reason: null };
  }
  const raw = native.checkHardwareAllowed(capabilities);
  return JSON.parse(raw) as { allowed: boolean; reason: string | null };
}

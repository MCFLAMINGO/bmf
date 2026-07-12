// SPDX-License-Identifier: Apache-2.0
// Load the Rust bmf-core bindings (@mcflamingo/bmf-node).
//
// Robotics kinds (urdf/mjcf → kin.*) are verified ONLY through Rust.
// There is intentionally no TypeScript reimplementation of those parsers.

import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface NativeBindings {
  parseUrdf(src: string): string;
  parseMjcf(src: string): string;
}

let cached: NativeBindings | null | undefined;

function tryRequire(require: NodeRequire, pathOrId: string): NativeBindings | null {
  try {
    return require(pathOrId) as NativeBindings;
  } catch {
    return null;
  }
}

/** Load Rust bmf-node. Returns null when the addon is unavailable on this platform. */
export function loadNative(): NativeBindings | null {
  if (cached !== undefined) return cached;
  const require = createRequire(import.meta.url);
  const here = dirname(fileURLToPath(import.meta.url));

  // 1) Published / workspace package (preferred).
  const fromPkg = tryRequire(require, "@mcflamingo/bmf-node");
  if (fromPkg) {
    cached = fromPkg;
    return cached;
  }

  // 2) Monorepo cargo output (dev without workspace link).
  const localCandidates = [
    resolve(here, "../../../core-rs/bmf-node/bmf_node.node"),
    resolve(here, "../../../core-rs/target/release/bmf_node.node"),
    resolve(here, "../../../core-rs/target/debug/bmf_node.node"),
  ];
  for (const path of localCandidates) {
    if (!existsSync(path)) continue;
    const hit = tryRequire(require, path);
    if (hit) {
      cached = hit;
      return cached;
    }
  }

  cached = null;
  return null;
}

/** Test helper: clear the cached native handle. */
export function resetNativeCache(): void {
  cached = undefined;
}

// SPDX-License-Identifier: Apache-2.0
// Optional Rust core (bmf-node) loader for URDF/MJCF capability derivation.
//
// The npm package ships without a prebuilt .node (Day 12). In the monorepo,
// `cargo build -p bmf-node --release` produces
// `core-rs/target/release/libbmf_node.so`; copy/rename it to `bmf_node.node`
// and this loader finds it. When the addon is absent, robot kinds return [].

import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface NativeBindings {
  parseUrdf(src: string): string;
  parseMjcf(src: string): string;
}

let cached: NativeBindings | null | undefined;

function candidatePaths(): string[] {
  const here = dirname(fileURLToPath(import.meta.url));
  return [
    // Monorepo release / debug builds (from src/ or dist/).
    resolve(here, "../../../core-rs/target/release/bmf_node.node"),
    resolve(here, "../../../core-rs/target/release/libbmf_node.so"),
    resolve(here, "../../../core-rs/target/debug/bmf_node.node"),
    resolve(here, "../../../core-rs/target/debug/libbmf_node.so"),
    // Optional vendored copy next to the package.
    resolve(here, "../native/bmf_node.node"),
    resolve(here, "./bmf_node.node"),
  ];
}

/** Load bmf-node if present. Returns null when the native addon is unavailable. */
export function loadNative(): NativeBindings | null {
  if (cached !== undefined) return cached;
  const require = createRequire(import.meta.url);
  for (const path of candidatePaths()) {
    if (!existsSync(path)) continue;
    // Node only loads ELF addons via a `.node` extension. If we only have the
    // cargo-produced `.so`, skip it here — callers must copy to `.node`.
    if (path.endsWith(".so")) continue;
    try {
      cached = require(path) as NativeBindings;
      return cached;
    } catch {
      // try next candidate
    }
  }
  cached = null;
  return null;
}

/** Test helper: clear the cached native handle. */
export function resetNativeCache(): void {
  cached = undefined;
}

// SPDX-License-Identifier: Apache-2.0
// BMF SDK — canonical JSON per SPEC.md §9 (JCS subset sufficient for signing).
//
// Rules:
//   1. UTF-8.
//   2. No insignificant whitespace.
//   3. Object keys sorted lexicographically (UTF-16 code unit order,
//      which is Array.prototype.sort's default on strings).
//   4. undefined values are dropped (not serialized).
//   5. Numbers are formatted with default JSON.stringify. BMF only uses
//      integers where precision matters (bytes, share_bps), so IEEE-754
//      edge cases don't affect signing.

export function canonicalize(value: unknown): string {
  if (value === null) return "null";
  const t = typeof value;
  if (t === "number" || t === "boolean" || t === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalize).join(",") + "]";
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
    return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalize(obj[k])).join(",") + "}";
  }
  throw new Error(`BMF canonicalize: unsupported type ${typeof value}`);
}

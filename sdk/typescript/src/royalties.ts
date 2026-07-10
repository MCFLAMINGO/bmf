// SPDX-License-Identifier: Apache-2.0
// BMF SDK — royalty chain validation (SPEC.md §3.3).

import type { Royalty } from "./types.js";

export function royaltyBpsSum(chain: Royalty[]): number {
  let sum = 0;
  for (const r of chain) sum += r.share_bps;
  return sum;
}

export function assertValidRoyaltyChain(chain: Royalty[]): void {
  for (const r of chain) {
    if (!r.recipient) throw new Error("BMF: royalty recipient missing");
    if (!Number.isInteger(r.share_bps) || r.share_bps < 0 || r.share_bps > 10000) {
      throw new Error(`BMF: royalty share must be an integer in [0, 10000], got ${r.share_bps}`);
    }
  }
  const sum = royaltyBpsSum(chain);
  if (sum !== 10000) throw new Error(`BMF: royalty_chain must sum to 10000 bps, got ${sum}`);
}

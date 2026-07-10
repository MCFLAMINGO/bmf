// SPDX-License-Identifier: Apache-2.0
// BMF SDK — GLB (glTF 2.0 binary) kind.
//
// Parses the container just enough to read the JSON chunk, matches humanoid
// bone landmarks by substring against node names, and derives the anim.*
// and humanoid.* capabilities the spec defines.
//
// Works across every rig convention we've seen: Mixamo (mixamorig:Hips,
// LeftArm...), Tripo, VRoid/VRM (J_Bip_C_Hips...), Blender Rigify, Ready
// Player Me. Add a term to the LANDMARKS table below if you hit one that
// doesn't match.

import type { Capability } from "../types.js";

const GLB_MAGIC = 0x46546c67; // "glTF"
const CHUNK_JSON = 0x4e4f534a; // "JSON"

const LANDMARKS = [
  { key: "hips",       terms: ["hip", "hips", "pelvis", "root"] },
  { key: "spine",      terms: ["spine", "chest", "torso"] },
  { key: "head",       terms: ["neck", "head"] },
  { key: "l_up_arm",   terms: ["leftarm", "left_arm", "l_arm", "leftupperarm", "left_upper_arm", "l_upperarm", "leftshoulder", "left_shoulder", "l_shoulder", "clavicle_l", "l_clavicle"] },
  { key: "r_up_arm",   terms: ["rightarm", "right_arm", "r_arm", "rightupperarm", "right_upper_arm", "r_upperarm", "rightshoulder", "right_shoulder", "r_shoulder", "clavicle_r", "r_clavicle"] },
  { key: "l_forearm",  terms: ["leftforearm", "left_forearm", "leftlowerarm", "left_lower_arm", "lefthand", "left_hand", "l_hand", "l_forearm"] },
  { key: "r_forearm",  terms: ["rightforearm", "right_forearm", "rightlowerarm", "right_lower_arm", "righthand", "right_hand", "r_hand", "r_forearm"] },
  { key: "l_up_leg",   terms: ["leftupleg", "leftthigh", "left_thigh", "leftupperleg", "left_upper_leg", "l_thigh", "upperleg_l"] },
  { key: "r_up_leg",   terms: ["rightupleg", "rightthigh", "right_thigh", "rightupperleg", "right_upper_leg", "r_thigh", "upperleg_r"] },
  { key: "l_foot",     terms: ["leftfoot", "left_foot", "l_foot", "leftlowerleg", "left_lower_leg", "leftshin", "lowerleg_l"] },
  { key: "r_foot",     terms: ["rightfoot", "right_foot", "r_foot", "rightlowerleg", "right_lower_leg", "rightshin", "lowerleg_r"] },
] as const;

type LandmarkKey = (typeof LANDMARKS)[number]["key"];

export interface GlbLandmarks {
  jointCount: number;
  skinCount: number;
  matched: Set<LandmarkKey>;
}

/** Parse a GLB and extract the humanoid landmarks. Returns null on parse failure. */
export function inspectGlb(buf: Uint8Array): GlbLandmarks | null {
  if (buf.length < 12) return null;
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (view.getUint32(0, true) !== GLB_MAGIC) return null;

  // Walk chunks looking for JSON.
  let offset = 12;
  let jsonText: string | null = null;
  while (offset + 8 <= buf.length) {
    const len = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    const start = offset + 8;
    if (type === CHUNK_JSON) {
      jsonText = new TextDecoder("utf-8").decode(buf.subarray(start, start + len));
      break;
    }
    offset = start + len;
  }
  if (!jsonText) return null;

  let gltf: { nodes?: Array<{ name?: string }>; skins?: Array<{ joints?: number[] }> };
  try { gltf = JSON.parse(jsonText); } catch { return null; }

  const nodes = gltf.nodes ?? [];
  const skins = gltf.skins ?? [];
  const jointCount = skins.reduce((sum, s) => sum + (s.joints?.length ?? 0), 0);

  const matched = new Set<LandmarkKey>();
  const jointIdSet = new Set<number>();
  for (const s of skins) for (const j of s.joints ?? []) jointIdSet.add(j);

  // Only match landmarks against nodes that are actual joints in a skin.
  for (const [idx, node] of nodes.entries()) {
    if (!jointIdSet.has(idx)) continue;
    const name = (node.name ?? "").toLowerCase();
    if (!name) continue;
    for (const lm of LANDMARKS) {
      if (matched.has(lm.key)) continue;
      if (lm.terms.some((t) => name.includes(t))) matched.add(lm.key);
    }
  }

  return { jointCount, skinCount: skins.length, matched };
}

/**
 * Derive the verified capability set for a GLB, per SPEC.md §5.1.
 * Callers may append declared-only capabilities (suffixed with `!`) after.
 */
export function deriveGlbCapabilities(l: GlbLandmarks): Capability[] {
  const caps: Capability[] = [];
  const has = (k: LandmarkKey) => l.matched.has(k);
  const humanoidScore = Math.round((l.matched.size / LANDMARKS.length) * 100);

  if (l.jointCount >= 24 && humanoidScore >= 90) caps.push("humanoid.mixamo24");
  if (l.skinCount >= 1) caps.push("mesh.singleroot");
  if (has("head")) caps.push("anim.gaze");
  if ((has("spine") || has("hips")) && (has("l_up_arm") || has("r_up_arm"))) caps.push("anim.breathe");
  if ((has("l_up_arm") && has("l_forearm")) || (has("r_up_arm") && has("r_forearm"))) caps.push("anim.wave");
  if (has("hips") && (has("l_up_leg") || has("r_up_leg"))) caps.push("anim.crouch");
  if (has("hips") && has("l_up_leg") && has("r_up_leg")) caps.push("anim.locomotion");

  return caps.sort();
}

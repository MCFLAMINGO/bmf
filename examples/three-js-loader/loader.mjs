// SPDX-License-Identifier: Apache-2.0
// BMF-aware three.js loader.
//
// Usage:
//   import { loadBmfCharacter } from "./loader.mjs";
//   const char = await loadBmfCharacter("bmf://localhost:8787/asset/arthur-6b4836d2");
//   if (char.can("anim.wave")) char.playWave();
//   scene.add(char.root);

import { loadManifest, hasCapability } from "@mcflamingo/bmf-sdk";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export async function loadBmfCharacter(uri) {
  const { manifest, verified, bytes } = await loadManifest(uri, { fetchBytes: true });
  if (!verified) throw new Error(`bmf: signature invalid for ${uri}`);
  if (manifest.kind !== "glb") throw new Error(`bmf: expected kind=glb, got ${manifest.kind}`);
  if (!bytes) throw new Error(`bmf: no bytes returned for ${uri}`);

  const gltf = await new GLTFLoader().parseAsync(bytes.buffer, "");
  return {
    manifest,
    root: gltf.scene,
    animations: gltf.animations,
    can: (capability) => hasCapability(manifest, capability),
    playWave() {
      if (!hasCapability(manifest, "anim.wave")) {
        throw new Error(`bmf: this character does not declare anim.wave`);
      }
      // Application-specific: find the arm bones, play a hand-authored clip,
      // or route through an animation graph. This example is behavior-agnostic.
    },
  };
}

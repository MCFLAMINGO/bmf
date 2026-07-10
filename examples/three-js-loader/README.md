# three-js-loader

A three.js loader that treats a BMF manifest as a required precondition. Signature must verify. `asset_hash` must match. Only then is the GLB parsed into a scene.

```js
import { loadBmfCharacter } from "./loader.mjs";

const char = await loadBmfCharacter("bmf://localhost:8787/asset/arthur-6b4836d2");
scene.add(char.root);

if (char.can("anim.wave"))       char.playWave();
if (char.can("anim.locomotion")) startWalking(char);
if (char.can("safety.simonly"))  refuseToActuateRealHardware(char);
```

The point isn't the animation code — it's the pattern: capabilities gate behaviors at the app boundary, not deep inside the code. A signed manifest is the contract.

## Notes

- `parseAsync` is used because BMF gives you the bytes directly. You skip the `load(url, ...)` path entirely, which is good — the URL was untrusted; the bytes are content-addressed and verified.
- The same pattern works for URDF/MJCF/policy kinds — swap `GLTFLoader` for your robot-side loader and gate on `kin.*`, `policy.*`, or `safety.*`.

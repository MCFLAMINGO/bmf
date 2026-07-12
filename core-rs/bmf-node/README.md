# `@mcflamingo/bmf-node`

**Rust is the source of truth** for BMF robotics kinds (`urdf`, `mjcf`). This package is the napi-rs binding over `bmf-core` — URDF/MJCF parse + `kin.*` / `safety.workspace.limits` derivation.

Do **not** reimplement these parsers in TypeScript. The TypeScript SDK (`@mcflamingo/bmf-sdk`) calls into this addon.

## API

```js
const { parseUrdf, parseMjcf } = require("@mcflamingo/bmf-node");

const { robot, capabilities } = JSON.parse(parseUrdf(urdfXml));
// capabilities: [{ name: "kin.urdf" }, { name: "kin.arm" }, { name: "kin.dof.arm", attrs: { dof: "6" } }, ...]
```

## Build

Requires [Rust stable](https://rustup.rs/) (≥ 1.88).

```bash
cd core-rs/bmf-node
npm run build   # cargo build -p bmf-node --release → bmf_node.node
npm test
```

## License

Apache-2.0.

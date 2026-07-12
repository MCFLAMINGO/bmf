#!/usr/bin/env node
// Build bmf-node: cargo release → copy cdylib to bmf_node.node beside index.js.
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const crateDir = join(here, "..");
const workspaceDir = join(crateDir, "..");
const outNode = join(crateDir, "bmf_node.node");

const cargo = spawnSync("cargo", ["build", "-p", "bmf-node", "--release"], {
  cwd: workspaceDir,
  stdio: "inherit",
  env: process.env,
});
if (cargo.status !== 0) {
  process.stderr.write("cargo build -p bmf-node --release failed\n");
  process.exit(cargo.status ?? 1);
}

const releaseDir = join(workspaceDir, "target", "release");
const candidates = [
  join(releaseDir, "libbmf_node.so"),      // linux
  join(releaseDir, "libbmf_node.dylib"),   // macOS
  join(releaseDir, "bmf_node.dll"),        // windows
  join(releaseDir, "bmf_node.node"),
];

const built = candidates.find((p) => existsSync(p));
if (!built) {
  process.stderr.write(`no cdylib found under ${releaseDir}\n`);
  process.exit(1);
}

mkdirSync(crateDir, { recursive: true });
copyFileSync(built, outNode);
process.stdout.write(`bmf-node: wrote ${outNode} from ${built}\n`);

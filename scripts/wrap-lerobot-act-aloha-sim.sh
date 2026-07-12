#!/usr/bin/env bash
# Wrap the official LeRobot ACT sim checkpoint as a BMF policy bundle.
#
# Source (unchanged weights): lerobot/act_aloha_sim_transfer_cube_human
# Output: <outdir>/act_aloha_sim_transfer_cube_human.bmf.tar.zst
#
# Usage:
#   ./scripts/wrap-lerobot-act-aloha-sim.sh [outdir]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FIXTURE="$ROOT/spec/examples/lerobot_act_aloha_sim"
OUTDIR="${1:-$ROOT/spec/examples/lerobot_act_aloha_sim/dist}"
WORKDIR="${TMPDIR:-/tmp}/bmf-wrap-act-aloha-$$"
HUB="https://huggingface.co/lerobot/act_aloha_sim_transfer_cube_human/resolve/main"

mkdir -p "$WORKDIR" "$OUTDIR"
cleanup() { rm -rf "$WORKDIR"; }
trap cleanup EXIT

echo "Downloading upstream checkpoint files…"
for f in config.json train_config.json model.safetensors; do
  curl -fsSL -o "$WORKDIR/$f" "$HUB/$f"
done
cp "$FIXTURE/manifest.json" "$WORKDIR/manifest.json"

# Prefer fixture copies of JSON if they diverge intentionally (manifest is ours).
# Keep downloaded config/train_config as source of truth for fingerprint.

echo "Packing BMF tar.zst…"
python3 - <<PY
import tarfile
from pathlib import Path
try:
    import zstandard as zstd
except ImportError:
    import subprocess, sys
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "zstandard"])
    import zstandard as zstd

work = Path("$WORKDIR")
outdir = Path("$OUTDIR")
files = ["config.json", "train_config.json", "model.safetensors", "manifest.json"]
tar_path = work / "bundle.tar"
with tarfile.open(tar_path, "w") as tar:
    for name in files:
        tar.add(work / name, arcname=name)
cctx = zstd.ZstdCompressor(level=10)
out = outdir / "act_aloha_sim_transfer_cube_human.bmf.tar.zst"
out.write_bytes(cctx.compress(tar_path.read_bytes()))
print("wrote", out, "bytes", out.stat().st_size)
PY

echo "Done. Verify with:"
echo "  bmf check-safety $OUTDIR/act_aloha_sim_transfer_cube_human.bmf.tar.zst --hardware"
echo "  # expect REFUSED — safety.simonly"

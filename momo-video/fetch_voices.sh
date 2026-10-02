#!/usr/bin/env bash
# Download the free Piper voices used for the draft soundtrack (~300 MB, not committed).
set -euo pipefail
DIR="${VOICES_DIR:-/tmp/claude-0/voices}"
mkdir -p "$DIR"
B=https://huggingface.co/rhasspy/piper-voices/resolve/main
for v in en/en_GB/jenny_dioco/medium/en_GB-jenny_dioco-medium \
         en/en_GB/alan/medium/en_GB-alan-medium \
         en/en_GB/cori/high/en_GB-cori-high; do
  n=$(basename "$v")
  [ -f "$DIR/$n.onnx" ] || curl -sSL -o "$DIR/$n.onnx" "$B/$v.onnx"
  [ -f "$DIR/$n.onnx.json" ] || curl -sSL -o "$DIR/$n.onnx.json" "$B/$v.onnx.json"
done
echo "voices in $DIR"

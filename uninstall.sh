#!/bin/zsh
# Chiikawa skin uninstaller launcher (macOS).
set -euo pipefail
REPO_DIR="${0:A:h}"
NODE_BIN="$(command -v node || true)"
if [[ -z "$NODE_BIN" ]]; then
  local -a candidates
  candidates=("$HOME"/.workbuddy/binaries/node/versions/*/bin/node(N))
  NODE_BIN="${candidates[1]:-}"
fi
if [[ -z "$NODE_BIN" ]]; then
  print -u2 "未找到 Node.js。"
  exit 1
fi
exec "$NODE_BIN" "$REPO_DIR/scripts/install-skin.mjs" --uninstall "$@"

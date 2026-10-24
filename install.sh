#!/bin/zsh
# Chiikawa skin installer launcher (macOS).
set -euo pipefail

REPO_DIR="${0:A:h}"

find_node() {
  if command -v node >/dev/null 2>&1; then
    print -r -- "$(command -v node)"
    return 0
  fi
  local candidate
  local -a candidates
  candidates=("$HOME"/.workbuddy/binaries/node/versions/*/bin/node(N))
  for candidate in ${(On)candidates}; do
    print -r -- "$candidate"
    return 0
  done
  return 1
}

NODE_BIN="$(find_node || true)"
if [[ -z "$NODE_BIN" ]]; then
  print -u2 "未找到 Node.js。请安装 Node.js 18+，或先运行一次 WorkBuddy（自带 Node）后重试。"
  exit 1
fi

exec "$NODE_BIN" "$REPO_DIR/scripts/install-skin.mjs" "$@"

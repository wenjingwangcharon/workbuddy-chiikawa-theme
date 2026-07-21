#!/bin/zsh
set -euo pipefail

REPO_DIR="${0:A:h}"
APP_ASAR="/Applications/WorkBuddy.app/Contents/Resources/app.asar"
BACKUP="${1:-}"

if [[ -z "$BACKUP" ]]; then
  print -u2 "用法：./restore.sh /完整路径/到/backup/app.asar"
  print -u2 "备份位于 ~/.workbuddy/backups/workbuddy-qq2008/ 下。"
  exit 1
fi

NODE_BIN=""
if command -v node >/dev/null 2>&1; then
  NODE_BIN="$(command -v node)"
fi
if [[ -z "$NODE_BIN" ]]; then
  candidates=("$HOME"/.workbuddy/binaries/node/versions/*/bin/node(N))
  if (( ${#candidates[@]} > 0 )); then
    NODE_BIN="${candidates[-1]}"
  fi
fi
if [[ -z "$NODE_BIN" ]]; then
  print -u2 "未找到 Node.js。"
  exit 1
fi

"$NODE_BIN" "$REPO_DIR/scripts/restore-theme.mjs" \
  --backup "$BACKUP" \
  --target "$APP_ASAR"

print "恢复完成。请重新打开 WorkBuddy。"

#!/bin/zsh
set -euo pipefail

REPO_DIR="${0:A:h}"
APP_ASAR="/Applications/WorkBuddy.app/Contents/Resources/app.asar"
SKIN="$REPO_DIR/theme/qq2008-skin.css"
PENGUIN="$REPO_DIR/theme/qq-penguin-user.png"
NOTIFY_SCRIPT="$REPO_DIR/theme/qq2008-notify.js"
MESSAGE_SOUND="$REPO_DIR/theme/qq-message.wav"
FAILURE_SOUND="$REPO_DIR/theme/qq-failure.wav"

if [[ "$(uname -s)" != "Darwin" ]]; then
  print -u2 "仅支持 macOS。"
  exit 1
fi

if [[ ! -f "$APP_ASAR" ]]; then
  print -u2 "未找到 WorkBuddy：$APP_ASAR"
  exit 1
fi

find_managed_node() {
  local candidate
  local -a candidates
  candidates=("$HOME"/.workbuddy/binaries/node/versions/*/bin/node(N))
  for candidate in ${(On)candidates}; do
    local major
    major="$($candidate -p 'Number(process.versions.node.split(".")[0])')"
    if (( major >= 22 )); then
      print -r -- "$candidate"
      return 0
    fi
  done
  return 1
}

NODE_BIN=""
if command -v node >/dev/null 2>&1; then
  NODE_BIN="$(command -v node)"
fi
if [[ -z "$NODE_BIN" || "$($NODE_BIN -p 'Number(process.versions.node.split(".")[0])')" -lt 22 ]]; then
  NODE_BIN="$(find_managed_node || true)"
fi
if [[ -z "$NODE_BIN" ]]; then
  print -u2 "需要 Node.js 22.12 或更高版本。请让 WorkBuddy Agent 先准备隔离 Node 运行时。"
  exit 1
fi

NPM_BIN="${NODE_BIN:h}/npm"
if [[ ! -x "$NPM_BIN" ]]; then
  print -u2 "未找到与 Node 配套的 npm：$NPM_BIN"
  exit 1
fi

cd "$REPO_DIR"
if [[ ! -d "$REPO_DIR/node_modules/@electron/asar" ]]; then
  "$NPM_BIN" ci --ignore-scripts
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
RUN_DIR="$REPO_DIR/.work/run-$STAMP"
PATCHED="$RUN_DIR/app.qq2008.asar"
EXTRACT="$RUN_DIR/extract"
mkdir -p "$RUN_DIR"

"$NODE_BIN" "$REPO_DIR/scripts/patch-theme.mjs" \
  --source "$APP_ASAR" \
  --output "$PATCHED" \
  --skin "$SKIN" \
  --script "$NOTIFY_SCRIPT" \
  --asset "$PENGUIN" \
  --asset "$MESSAGE_SOUND" \
  --asset "$FAILURE_SOUND" \
  --work "$EXTRACT"

"$NODE_BIN" "$REPO_DIR/scripts/install-theme.mjs" \
  --patched "$PATCHED" \
  --target "$APP_ASAR" \
  --allow-running

print ""
print "安装完成。请用 Command + Q 完全退出 WorkBuddy，再重新打开。"
print "原版已备份到 ~/.workbuddy/backups/workbuddy-qq2008/ 下。"

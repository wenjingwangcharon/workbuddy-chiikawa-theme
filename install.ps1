# Chiikawa skin installer launcher (Windows).
# ASCII-only body: PS 5.1 on zh-CN machines misreads UTF-8 Chinese strings.
$ErrorActionPreference = 'Stop'
$repo = $PSScriptRoot

$node = $null
try { $node = (Get-Command node -ErrorAction Stop).Source } catch {}
if (-not $node) {
  $managed = Get-ChildItem "$env:USERPROFILE\.workbuddy\binaries\node\versions\*\node.exe" -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending | Select-Object -First 1
  if ($managed) { $node = $managed.FullName }
}
if (-not $node) {
  Write-Host "Node.js not found. Install Node.js 22+ (or run WorkBuddy once so its bundled Node exists), then retry."
  exit 1
}

& $node (Join-Path $repo 'scripts\install-skin.mjs') @args

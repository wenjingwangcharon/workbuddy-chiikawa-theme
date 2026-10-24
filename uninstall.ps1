# Chiikawa skin uninstaller launcher (Windows). ASCII-only body.
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
  Write-Host "Node.js not found."
  exit 1
}

& $node (Join-Path $repo 'scripts\install-skin.mjs') --uninstall @args

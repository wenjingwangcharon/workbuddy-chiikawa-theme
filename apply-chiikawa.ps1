# Apply a prebuilt Chiikawa patched asar to WorkBuddy (run AFTER fully quitting WorkBuddy).
# Safely backs up the current app.asar, then swaps in the patched one.
# Generic: auto-detects WorkBuddy install path and the newest prebuilt asar in this repo.
#
# Usage (fully quit WorkBuddy first, including tray icon):
#   powershell -ExecutionPolicy Bypass -File .\apply-chiikawa.ps1
#   powershell -ExecutionPolicy Bypass -File .\apply-chiikawa.ps1 -Patched 'D:\app.chiikawa.asar'

[CmdletBinding()]
param(
  [string]$Patched = "",
  [string]$AppAsar = ""
)

$ErrorActionPreference = 'Stop'
$RepoDir = $PSScriptRoot

function Fail([string]$message) { Write-Error $message; exit 1 }

function Find-WorkBuddyResources {
  $roots = @(
    (Join-Path $env:LOCALAPPDATA 'Programs\WorkBuddy'),
    (Join-Path $env:ProgramFiles 'WorkBuddy'),
    (Join-Path ${env:ProgramFiles(x86)} 'WorkBuddy')
  )
  foreach ($root in $roots) {
    if ([string]::IsNullOrWhiteSpace($root)) { continue }
    $candidate = Join-Path $root 'resources\app.asar'
    if (Test-Path -LiteralPath $candidate) { return $candidate }
  }
  return $null
}

# 1) Locate patched asar (explicit param, else newest under .work\)
if ([string]::IsNullOrWhiteSpace($Patched)) {
  $candidates = @()
  if (Test-Path -LiteralPath (Join-Path $RepoDir '.work')) {
    $candidates = Get-ChildItem -LiteralPath (Join-Path $RepoDir '.work') -Recurse -Filter 'app.chiikawa.asar' -File -ErrorAction SilentlyContinue |
      Sort-Object LastWriteTime -Descending
  }
  if ($candidates.Count -eq 0) {
    Fail "Prebuilt patch app.chiikawa.asar not found. Run install.ps1 first, or pass -Patched."
  }
  $Patched = $candidates[0].FullName
}
if (-not (Test-Path -LiteralPath $Patched)) { Fail "Patch not found: $Patched" }
Write-Host "Patch: $Patched"

# 2) Locate WorkBuddy resources
if ([string]::IsNullOrWhiteSpace($AppAsar)) { $AppAsar = Find-WorkBuddyResources }
if ([string]::IsNullOrWhiteSpace($AppAsar) -or -not (Test-Path -LiteralPath $AppAsar)) {
  Fail "WorkBuddy app.asar not found. Pass -AppAsar manually."
}
$resources = Split-Path $AppAsar -Parent
$orig = $AppAsar

# 3) Make sure WorkBuddy is not running
$wb = Get-Process -Name 'WorkBuddy' -ErrorAction SilentlyContinue
if ($wb) {
  Write-Host 'ERROR: WorkBuddy is still running. Fully quit (including tray icon) and retry.' -ForegroundColor Red
  exit 1
}

# 4) Backup current app.asar
$backupDir = Join-Path $HOME '.workbuddy\backups\workbuddy-chiikawa'
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
$ts = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $backupDir ('app.asar.orig.' + $ts)
Copy-Item -LiteralPath $orig -Destination $backup -Force
Write-Host "Backup created: $backup"

# 5) Stage a copy next to the target (same volume => atomic replace possible)
$staged = Join-Path $resources 'app.asar.new'
if (Test-Path -LiteralPath $staged) { Remove-Item -LiteralPath $staged -Force }
Copy-Item -LiteralPath $Patched -Destination $staged -Force
Write-Host "Staged: $staged"

# 6) Atomic replace via MoveFileEx (with rollback on failure)
Add-Type @"
using System; using System.Runtime.InteropServices;
public class MV {
    [DllImport("kernel32.dll", SetLastError=true)]
    public static extern bool MoveFileEx(string lpExistingFileName, string lpNewFileName, int dwFlags);
    public const int REPLACE_EXISTING = 1;
    public const int DEL = 1;
}
"@
$old = Join-Path $resources 'app.asar.old'
if (Test-Path -LiteralPath $old) { Remove-Item -LiteralPath $old -Force }

$r1 = [MV]::MoveFileEx($orig, $old, [MV]::REPLACE_EXISTING)
if (-not $r1) {
  $err = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
  Remove-Item -LiteralPath $staged -Force -ErrorAction SilentlyContinue
  Write-Host "ERROR: Could not move original app.asar (Win32 error $err). Is WorkBuddy still running?" -ForegroundColor Red
  exit 1
}
$r2 = [MV]::MoveFileEx($staged, $orig, [MV]::REPLACE_EXISTING)
if (-not $r2) {
  [MV]::MoveFileEx($old, $orig, [MV]::REPLACE_EXISTING) | Out-Null
  Write-Host 'ERROR: Replace failed; original file restored, no changes made.' -ForegroundColor Red
  exit 1
}
[MV]::MoveFileEx($old, $null, [MV]::DEL) | Out-Null

Write-Host 'DONE: Chiikawa theme installed. Reopen WorkBuddy to see it.' -ForegroundColor Green
Write-Host "Patch source kept at: $Patched"

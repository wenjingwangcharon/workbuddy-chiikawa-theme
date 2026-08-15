# Apply a prebuilt Chiikawa patched asar to WorkBuddy (run AFTER fully quitting WorkBuddy).
# Safely backs up the current app.asar, then swaps in the patched one.
# Generic: auto-detects WorkBuddy install path and the newest prebuilt asar in this repo.
#
# 用法（先完全退出 WorkBuddy，含系统托盘图标）：
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
    Fail "未找到预构建的补丁包 app.chiikawa.asar。请先运行 install.ps1 生成，或用 -Patched 指定路径。"
  }
  $Patched = $candidates[0].FullName
}
if (-not (Test-Path -LiteralPath $Patched)) { Fail "找不到补丁包：$Patched" }
Write-Host "补丁包：$Patched"

# 2) Locate WorkBuddy resources
if ([string]::IsNullOrWhiteSpace($AppAsar)) { $AppAsar = Find-WorkBuddyResources }
if ([string]::IsNullOrWhiteSpace($AppAsar) -or -not (Test-Path -LiteralPath $AppAsar)) {
  Fail "未找到 WorkBuddy 的 app.asar。请用 -AppAsar 手动指定。"
}
$resources = Split-Path $AppAsar -Parent
$orig = $AppAsar

# 3) Make sure WorkBuddy is not running
$wb = Get-Process -Name 'WorkBuddy' -ErrorAction SilentlyContinue
if ($wb) {
  Write-Host 'ERROR: WorkBuddy 仍在运行，Windows 会独占锁定 app.asar。请完全退出（含托盘图标）后重试。' -ForegroundColor Red
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
  Write-Host "ERROR: 无法移动原 app.asar (Win32 error $err)。WorkBuddy 是否仍在运行？" -ForegroundColor Red
  exit 1
}
$r2 = [MV]::MoveFileEx($staged, $orig, [MV]::REPLACE_EXISTING)
if (-not $r2) {
  [MV]::MoveFileEx($old, $orig, [MV]::REPLACE_EXISTING) | Out-Null
  Write-Host 'ERROR: 替换失败；已还原原文件，未做任何改动。' -ForegroundColor Red
  exit 1
}
[MV]::MoveFileEx($old, $null, [MV]::DEL) | Out-Null

Write-Host 'DONE: Chiikawa 皮肤已安装。重新打开 WorkBuddy 即可看到效果。' -ForegroundColor Green
Write-Host "补丁源文件保留在: $Patched"

# Restore the original WorkBuddy app.asar (run AFTER fully quitting WorkBuddy).
# Generic: auto-detects WorkBuddy install path and the newest backup in ~/.workbuddy/backups.
#
# 用法（先完全退出 WorkBuddy，含系统托盘图标）：
#   powershell -ExecutionPolicy Bypass -File .\restore-chiikawa.ps1
#   powershell -ExecutionPolicy Bypass -File .\restore-chiikawa.ps1 -Backup 'D:\app.asar.orig.xxx'

[CmdletBinding()]
param(
  [string]$Backup = "",
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

# 1) Locate backup (explicit param, else newest under backup root)
$backupRoot = Join-Path $HOME '.workbuddy\backups\workbuddy-chiikawa'
if ([string]::IsNullOrWhiteSpace($Backup)) {
  if (-not (Test-Path -LiteralPath $backupRoot)) { Fail "未找到备份目录：$backupRoot" }
  $found = Get-ChildItem -LiteralPath $backupRoot -Recurse -Filter 'app.asar.orig.*' -File -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $found) { Fail "在 $backupRoot 下未找到任何备份。" }
  $Backup = $found.FullName
}
if (-not (Test-Path -LiteralPath $Backup)) { Fail "找不到备份文件：$Backup" }
Write-Host "备份：$Backup"

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
  Write-Host 'ERROR: WorkBuddy 仍在运行，Windows 会独占锁定 app.asar。请完全退出后重试。' -ForegroundColor Red
  exit 1
}

# 4) Atomic replace via MoveFileEx (with rollback on failure)
Add-Type @"
using System; using System.Runtime.InteropServices;
public class MV {
    [DllImport("kernel32.dll", SetLastError=true)]
    public static extern bool MoveFileEx(string a, string b, int f);
    public const int R = 1;
}
"@
$old = Join-Path $resources 'app.asar.old'
if (Test-Path $old) { Remove-Item $old -Force }
$r1 = [MV]::MoveFileEx($orig, $old, [MV]::R)
if (-not $r1) { Write-Host 'ERROR: 无法移动当前 app.asar（WorkBuddy 是否在运行？）。' -ForegroundColor Red; exit 1 }
$r2 = [MV]::MoveFileEx($Backup, $orig, [MV]::R)
if (-not $r2) { [MV]::MoveFileEx($old, $orig, [MV]::R) | Out-Null; Write-Host 'ERROR: 还原失败；已恢复原始文件。' -ForegroundColor Red; exit 1 }
[MV]::MoveFileEx($old, $null, [MV]::R) | Out-Null
Write-Host "DONE: 已从 $($Backup) 还原。重新打开 WorkBuddy。" -ForegroundColor Green

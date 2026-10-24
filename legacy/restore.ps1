<#
  Chiikawa 皮肤 — Windows 还原脚本

  用法（先完全退出 WorkBuddy，含系统托盘图标）：
    powershell -ExecutionPolicy Bypass -File .\restore.ps1 "<备份目录>\app.asar"

  备份位于 %USERPROFILE%\.workbuddy\backups\workbuddy-chiikawa\ 下，
  每次安装会生成一个带时间戳的子目录，内含 app.asar 与 receipt.json。
#>

[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [string]$Backup = "",
  [string]$AppAsar = ""
)

$ErrorActionPreference = 'Stop'
$RepoDir = $PSScriptRoot

function Fail([string]$message) {
  Write-Error $message
  exit 1
}

if ([string]::IsNullOrWhiteSpace($Backup)) {
  $backupRoot = Join-Path $HOME '.workbuddy\backups\workbuddy-chiikawa'
  Write-Host "用法：.\restore.ps1 '<备份目录>\app.asar'"
  if (Test-Path -LiteralPath $backupRoot) {
    Write-Host ""
    Write-Host "可用备份（$backupRoot）："
    Get-ChildItem -LiteralPath $backupRoot -Recurse -Filter 'app.asar' |
      Sort-Object LastWriteTime -Descending |
      ForEach-Object { Write-Host ("  " + $_.FullName) }
  }
  exit 1
}
if (-not (Test-Path -LiteralPath $Backup)) {
  Fail "找不到备份文件：$Backup"
}

if ([string]::IsNullOrWhiteSpace($AppAsar)) {
  $searchRoots = @(
    (Join-Path $env:LOCALAPPDATA 'Programs\WorkBuddy'),
    (Join-Path $env:ProgramFiles 'WorkBuddy'),
    (Join-Path ${env:ProgramFiles(x86)} 'WorkBuddy')
  )
  foreach ($root in $searchRoots) {
    if ([string]::IsNullOrWhiteSpace($root)) { continue }
    $candidate = Join-Path $root 'resources\app.asar'
    if (Test-Path -LiteralPath $candidate) { $AppAsar = $candidate; break }
  }
}
if ([string]::IsNullOrWhiteSpace($AppAsar) -or -not (Test-Path -LiteralPath $AppAsar)) {
  Fail "未找到 WorkBuddy 的 app.asar。请用 -AppAsar 手动指定。"
}

$running = Get-Process -Name 'WorkBuddy' -ErrorAction SilentlyContinue
if ($running) {
  Fail "WorkBuddy 正在运行，Windows 会独占锁定 app.asar。请完全退出应用（含系统托盘图标）后重试。"
}

function Get-NodeVersionMajor([string]$nodePath) {
  # PowerShell 传参给原生 exe 会吞掉内嵌双引号，因此在 PowerShell 侧切分版本号。
  try {
    $raw = (& $nodePath -p 'process.versions.node' 2>$null | Select-Object -First 1)
    if ([string]::IsNullOrWhiteSpace($raw)) { return 0 }
    return [int](($raw.ToString().Trim() -split '\.')[0])
  } catch { return 0 }
}

$NodeBin = ""
$systemNode = Get-Command node -ErrorAction SilentlyContinue
if ($systemNode -and (Get-NodeVersionMajor $systemNode.Source) -ge 22) {
  $NodeBin = $systemNode.Source
}
if ([string]::IsNullOrWhiteSpace($NodeBin)) {
  $managedRoot = Join-Path $HOME '.workbuddy\binaries\node\versions'
  if (Test-Path -LiteralPath $managedRoot) {
    $dirs = Get-ChildItem -LiteralPath $managedRoot -Directory | Sort-Object Name -Descending
    foreach ($dir in $dirs) {
      $candidate = Join-Path $dir.FullName 'node.exe'
      if ((Test-Path -LiteralPath $candidate) -and (Get-NodeVersionMajor $candidate) -ge 22) {
        $NodeBin = $candidate
        break
      }
    }
  }
}
if ([string]::IsNullOrWhiteSpace($NodeBin)) {
  Fail "未找到 Node.js 22 或更高版本。"
}

& $NodeBin (Join-Path $RepoDir 'scripts\restore-theme.mjs') --backup $Backup --target $AppAsar
if ($LASTEXITCODE -ne 0) { Fail "还原失败。" }

Write-Host ""
Write-Host "已还原为原版。重新打开 WorkBuddy 即可。"

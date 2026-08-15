<#
  Chiikawa 皮肤 — Windows 安装脚本

  用法（先完全退出 WorkBuddy，含系统托盘图标）：
    powershell -ExecutionPolicy Bypass -File .\install.ps1

  可选参数：
    -AppAsar  <path>   手动指定 app.asar 位置（默认自动探测安装目录）
    -BuildOnly         只生成补丁包，不替换正在使用的 app.asar

  与 macOS 的差异：
    1. 额外注入 theme/chiikawa-skin.win.css，隐藏被 Windows 原生标题栏遮挡的侧栏角色贴纸
    2. 安装前强制要求 WorkBuddy 已退出（Windows 会独占锁定 app.asar）
    3. 依赖安装后会执行 patch-package，修复 @electron/asar 在 Windows 上的路径分隔符问题
#>

[CmdletBinding()]
param(
  [string]$AppAsar = "",
  [switch]$BuildOnly
)

$ErrorActionPreference = 'Stop'
$RepoDir = $PSScriptRoot

function Fail([string]$message) {
  Write-Error $message
  exit 1
}

# ---------------------------------------------------------------- 定位 app.asar
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
  Fail "未找到 WorkBuddy 的 app.asar。请用 -AppAsar 手动指定，例如：`n  .\install.ps1 -AppAsar 'D:\WorkBuddy\resources\app.asar'"
}
Write-Host "WorkBuddy 资源：$AppAsar"

# ---------------------------------------------------------- 确认 WorkBuddy 已退出
$running = Get-Process -Name 'WorkBuddy' -ErrorAction SilentlyContinue
if ($running -and -not $BuildOnly) {
  Fail "WorkBuddy 正在运行，Windows 会独占锁定 app.asar。请完全退出应用（含系统托盘图标）后重新运行本脚本。"
}

# -------------------------------------------------------------------- 定位 Node
function Get-NodeVersionMajor([string]$nodePath) {
  # 注意：PowerShell 传参给原生 exe 时会吞掉内嵌的双引号，
  # 因此只取完整版本号字符串，再在 PowerShell 侧切分，避免在 JS 表达式里用引号。
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
  Fail "需要 Node.js 22.12 或更高版本。请安装 Node，或让 WorkBuddy Agent 先准备隔离 Node 运行时。"
}
Write-Host "Node：$NodeBin"

$NpmCli = Join-Path (Split-Path $NodeBin -Parent) 'node_modules\npm\bin\npm-cli.js'
if (-not (Test-Path -LiteralPath $NpmCli)) {
  Fail "未找到与 Node 配套的 npm：$NpmCli"
}

# ------------------------------------------------------ 安装依赖并应用 asar 补丁
Push-Location $RepoDir
try {
  if (-not (Test-Path -LiteralPath (Join-Path $RepoDir 'node_modules\@electron\asar'))) {
    Write-Host "安装依赖..."
    & $NodeBin $NpmCli install --ignore-scripts
    if ($LASTEXITCODE -ne 0) { Fail "npm install 失败。" }
  }

  # @electron/asar 4.2.1 在 Windows 上按 path.sep 切分 asar 内部路径，导致嵌套文件读写失败。
  # patches/ 下的补丁把切分改回 '/'，在 macOS 上是等价无副作用的改动。
  $PatchPackage = Join-Path $RepoDir 'node_modules\patch-package\index.js'
  if (Test-Path -LiteralPath $PatchPackage) {
    Write-Host "应用 @electron/asar 的 Windows 路径补丁..."
    & $NodeBin $PatchPackage
    if ($LASTEXITCODE -ne 0) { Fail "patch-package 执行失败，asar 在 Windows 上会读写失败，已中止。" }
  } else {
    Fail "缺少 patch-package。请先运行：`n  & '$NodeBin' '$NpmCli' install"
  }
}
finally {
  Pop-Location
}

# ------------------------------------------------------------------ 构建补丁包
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$RunDir = Join-Path $RepoDir ".work\run-$Stamp"
$Patched = Join-Path $RunDir 'app.chiikawa.asar'
$Extract = Join-Path $RunDir 'extract'
New-Item -ItemType Directory -Path $RunDir -Force | Out-Null

$Skin = Join-Path $RepoDir 'theme\chiikawa-skin.css'
$WinStyle = Join-Path $RepoDir 'theme\chiikawa-skin.win.css'
$AudioScript = Join-Path $RepoDir 'theme\chiikawa-audio.js'

$Assets = @(
  'theme\usagi-logo.png',
  'theme\chiikawa-group.png',
  'theme\chiichi-serious.png',
  'theme\chiichi-playful.png',
  'theme\momonga.png',
  'theme\kuri-manju.png',
  'theme\stack.png',
  'theme\chiikawa-friends.png',
  'theme\assets\Yoolooko - 乌拉呀哈呀哈乌拉.wav',
  'theme\assets\Yoolooko - 纳尼纳尼.wav',
  'theme\assets\Yoolooko - 曾曾哇嘎乃.wav',
  'theme\assets\Yoolooko - 羊粑粑.wav'
)

$PatchArgs = @(
  (Join-Path $RepoDir 'scripts\patch-theme.mjs'),
  '--source', $AppAsar,
  '--output', $Patched,
  '--skin', $Skin,
  '--style', $WinStyle,
  '--script', $AudioScript
)
foreach ($asset in $Assets) {
  $full = Join-Path $RepoDir $asset
  if (-not (Test-Path -LiteralPath $full)) { Fail "缺少资源文件：$full" }
  $PatchArgs += '--asset'
  $PatchArgs += $full
}
$PatchArgs += '--work'
$PatchArgs += $Extract

Write-Host "构建补丁包..."
& $NodeBin @PatchArgs
if ($LASTEXITCODE -ne 0) { Fail "补丁构建失败。" }

if ($BuildOnly) {
  Write-Host ""
  Write-Host "已生成补丁包（未安装）：$Patched"
  exit 0
}

# ---------------------------------------------------------------------- 安装
Write-Host "替换 app.asar..."
& $NodeBin (Join-Path $RepoDir 'scripts\install-theme.mjs') --patched $Patched --target $AppAsar
if ($LASTEXITCODE -ne 0) { Fail "安装失败。原文件已备份，未被破坏。" }

Write-Host ""
Write-Host "Chiikawa 皮肤安装完成。重新打开 WorkBuddy 即可看到效果。"
Write-Host "原版已备份到 $HOME\.workbuddy\backups\workbuddy-chiikawa\ 下。"
Write-Host "还原：powershell -ExecutionPolicy Bypass -File .\restore.ps1 '<备份目录>\app.asar'"

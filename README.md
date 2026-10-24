# WorkBuddy Chiikawa 皮肤

WorkBuddy 的 Chiikawa（吉伊卡哇）主题皮肤。米黄主色调、粉色顶栏、sidebar 三只角色装饰（栗子馒头/飞鼠/吉伊）、首页对话框右上角叠叠乐贴图。

当前已验证版本：WorkBuddy 5.8.3（Windows 实测通过；macOS 理论兼容，欢迎反馈）。

## v2 安装方式（2026-10 重写，免改 app.asar）

旧版方案直接给 `app.asar` 打补丁，在 Windows 上受版本强绑定和 `@electron/asar` 路径问题影响，多次导致 WorkBuddy 启动崩溃；且 WorkBuddy 自动更新会覆盖补丁。

**新版完全不改 `app.asar`**，改为向 WorkBuddy 原生皮肤系统预置缓存（利用其「本地缓存命中则不重新下载」的机制），因此：

- **不会导致启动崩溃**（最坏情况只是样式不生效）；
- **不会被 WorkBuddy 自动更新清除**；
- **零 npm 依赖**，一个 Node 脚本跑完。

工作原理：WorkBuddy 的主题列表由服务器目录下发（本地文件夹不会被列出），但应用主题时它**先读本地缓存 `skin.v2.css`，命中就直接用、不联网下载**。本脚本把 Chiikawa 预置进一个官方主题槽位（默认 `和平精英激战金秋`）的缓存位置——你在 设置 → 外观 里选中该主题，实际加载的就是 Chiikawa。

### 平台差异（与旧版保持一致）

| 平台 | 样式 |
| --- | --- |
| macOS | 基础样式 `chiikawa-skin.css`，侧栏顶栏显示栗子馒头 + 飞鼠 + 吉伊三只贴纸 |
| Windows | 额外合并 `chiikawa-skin.win.css`，隐藏被原生标题栏遮挡的顶栏贴纸 |

## 安装

要求：Node.js 18+（或本机装过 WorkBuddy，脚本会自动找它自带的 Node）。

**macOS：**

```bash
git clone <repo-url>
cd workbuddy-chiikawa-theme
./install.sh
```

**Windows：**

```powershell
git clone <repo-url>
cd workbuddy-chiikawa-theme
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

安装脚本会自动：

1. 定位 WorkBuddy 配置目录（`~/.workbuddy`，可用环境变量 `WORKBUDDY_CONFIG_DIR` 覆盖）；
2. 从本地主题目录缓存解析槽位主题的 `updatedAt`（即缓存目录名后缀）；
3. 按**当前平台**拼装 CSS（Windows 合并 win.css，macOS 不合并）并预置 `skin.v2.css` + 全部贴图；
4. 若 WorkBuddy 未在运行，自动把主题选择切换到该槽位并备份 `preferences.json`。

然后：

- 如果安装时 WorkBuddy 已关闭 → **重启 WorkBuddy 即生效**；
- 如果安装时 WorkBuddy 正在运行 → 重启后到 **设置 → 外观** 点一次该主题卡片。

> 注：主题列表里该卡片的封面缩略图仍是官方预览图（封面来自服务器，无法替换），选中后实际效果就是 Chiikawa。

## 卸载 / 恢复

```bash
# macOS
./uninstall.sh
```

```powershell
# Windows
powershell -ExecutionPolicy Bypass -File .\uninstall.ps1
```

会移除预置的种子目录，并把主题选择还原为安装前的状态（`preferences.json` 有自动备份）。

## 已知限制

- **交互音效依赖一次极小的注入**：皮肤本体（CSS）走原生槽位，但点击音效需要往 `app.asar.unpacked/renderer/index.html` 注入一行 `<script>` 并复制 4 个音频文件（安装脚本自动完成，`--no-audio` 可跳过）。WorkBuddy 自动更新会重置 `index.html`，音效消失后重跑安装脚本即可恢复；不恢复也不影响皮肤样式。
- **槽位依赖服务器目录的 `updatedAt`**：如果官方更新了该主题（目录名后缀变化），皮肤会失效，重新运行安装脚本即可（脚本每次运行都会解析最新的 `updatedAt`）。
- **每个槽位同一时刻只能装一套皮肤**：默认槽位 `theme-tkmw7j`。如果你自己在用「和平精英激战金秋」，可用 `--slot` 换一个不用的官方主题，例如：
  `node scripts/install-skin.mjs --slot theme-tkbe90`

## 常用参数

```
node scripts/install-skin.mjs [--slot <resourceKey>] [--ts <updatedAt>] [--no-select] [--name "<主题子文件夹名>"]
node scripts/install-skin.mjs --uninstall
```

- `--slot`：指定要占用的官方主题槽位（默认 `theme-tkmw7j`）
- `--ts`：手动指定目录名后缀（正常情况下脚本会自动解析，仅排障用）
- `--no-select`：不自动修改主题选择，装完后自己到 设置 → 外观 点选

## 旧版方案（已弃用，仅供研究）

给 `app.asar` 整包打补丁的安装/恢复脚本移到了 `legacy/` 目录，**不建议使用**：Windows 上曾多次因版本错配或重打包丢文件导致 WorkBuddy 无法启动，且会被自动更新覆盖。详见 `legacy/` 内脚本注释。

## 文件说明

- `theme/chiikawa-skin.css` — 主题基础样式（跨平台）
- `theme/chiikawa-skin.win.css` — Windows 专属覆盖样式（仅 Windows 安装时合并）
- `theme/*.png` — 贴纸素材（叠叠乐、三只角色、logo 等）
- `theme/chiikawa-audio.js` + `theme/assets/*.wav` — 交互音效（安装时注入到渲染进程加载）
- `scripts/install-skin.mjs` — v2 安装/卸载脚本（跨平台、零依赖）
- `install.sh` / `uninstall.sh` — macOS 入口
- `install.ps1` / `uninstall.ps1` — Windows 入口
- `legacy/` — 旧版 app.asar 补丁方案（已弃用）

## 使用边界

这是个人开发者制作的非官方主题。v2 方案只写 WorkBuddy 的用户数据目录（`~/.workbuddy`），不修改应用本体与代码签名。

Chiikawa（吉伊卡哇）角色形象相关权利归原作者 Nagano 所有，本仓库仅用于个人、非商业的界面定制，不代表 WorkBuddy、Chiikawa 或任何版权方的官方立场与背书。详见 `NOTICE.md`。

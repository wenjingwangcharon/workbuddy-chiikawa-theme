# WorkBuddy Chiikawa 皮肤

WorkBuddy 的 Chiikawa（吉伊卡哇）主题皮肤。米黄主色调、粉色顶栏、sidebar 三只角色装饰（栗子馒头/飞鼠/吉伊）、首页对话框右上角叠叠乐贴图。

当前已验证版本：WorkBuddy 5.3.7。

## 支持平台

| 平台 | 安装入口 | Windows 专属覆盖 |
| --- | --- | --- |
| macOS | `./install.sh` | 无（使用上游默认外观） |
| Windows | `powershell -ExecutionPolicy Bypass -File .\install.ps1` | `theme/chiikawa-skin.win.css`（仅隐藏被原生标题栏遮挡的侧栏角色贴纸） |

两个平台**共用同一套皮肤与打包脚本**：

- `theme/chiikawa-skin.css` 是跨平台基础样式（按 macOS 无边框窗口调好）。
- `scripts/patch-theme.mjs` 会按 `process.platform` 自动选择 WorkBuddy 的 `app.asar` 路径；**仅在 Windows 上**额外注入 `chiikawa-skin.win.css` 覆盖层。
- `scripts/install-theme.mjs` / `restore-theme.mjs` 的进程检测同样按平台分流（Windows 用 `tasklist`，macOS 用 `pgrep`）。

因此 Mac 用户跑 `install.sh`、Windows 用户跑 `install.ps1`，各自只做自己平台的事，**互不干扰**。

## 效果

- 主页/对话区：温暖米黄色底色
- 侧边栏/顶栏：柔和粉色调
- 首页 input 框右上角：吉伊+乌萨奇+小八叠叠乐贴图
- 侧边栏顶栏：macOS 显示栗子馒头 + 飞鼠 + 吉伊三只角色；Windows 因原生标题栏无法隐藏，该区域三只角色默认隐藏（见 `chiikawa-skin.win.css` 注释，如需显示可改 positioning 规则）

## macOS 安装

要求：

- macOS
- WorkBuddy 安装在 `/Applications/WorkBuddy.app`
- Node.js 22.12 或更高版本

```bash
git clone <repo-url>
cd workbuddy-chiikawa-theme
npm install --ignore-scripts
./install.sh
```

安装后用 **Command + Q** 完全退出 WorkBuddy，再重新打开。

## Windows 安装

要求：

- Windows 10/11
- WorkBuddy 安装在默认目录（`%LOCALAPPDATA%\Programs\WorkBuddy`，或 `C:\Program Files\WorkBuddy`）
- Node.js 22.12 或更高版本（WorkBuddy 自带的隔离 Node 也可被自动探测到）

```powershell
git clone <repo-url>
cd workbuddy-chiikawa-theme
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

`install.ps1` 会：自动探测 WorkBuddy 安装目录 → 校验已完全退出（Windows 会独占锁定 `app.asar`）→ 安装依赖并应用 `@electron/asar` 的 Windows 路径补丁 → 构建补丁包 → 备份并原子替换。

> 注意：**运行前请完全退出 WorkBuddy（含系统托盘图标）**。否则 `app.asar` 被占用，替换会失败。

### Windows 快速重装 / 还原

- 已构建过补丁包后，重装只需替换、无需重新解包：

  ```powershell
  powershell -ExecutionPolicy Bypass -File .\apply-chiikawa.ps1
  ```

  （自动寻找本仓库 `.work\` 下最新的 `app.chiikawa.asar`；也可用 `-Patched` 指定具体路径）

- 还原原版：

  ```powershell
  powershell -ExecutionPolicy Bypass -File .\restore.ps1 "<备份目录>\app.asar"
  ```

  或快捷版（自动找最新备份）：

  ```powershell
  powershell -ExecutionPolicy Bypass -File .\restore-chiikawa.ps1
  ```

## 恢复原版（macOS）

```bash
./restore.sh "$HOME/.workbuddy/backups/workbuddy-chiikawa/<时间>/app.asar"
```

## 安全与回滚

安装过程不会直接修改原包内容。它会：

1. 从当前 WorkBuddy 的 `app.asar` 构建一个补丁副本
2. 校验 chiikawa-skin.css 及所有素材图片均已写入
3. 校验当前版本包含皮肤所需的关键界面标记
4. 把当前原版备份到 `~/.workbuddy/backups/workbuddy-chiikawa/<时间>/app.asar`
5. 校验备份 SHA-256 后原子替换

## 版本更新

WorkBuddy 更新通常会覆盖 `app.asar`，皮肤会失效。不要恢复旧版本的整包备份到新版本上，重新执行安装流程即可。

## 关于 @electron/asar 补丁

`patches/@electron+asar+4.2.1.patch` 修复 `@electron/asar` 4.2.1 在 Windows 上按 `path.sep`（反斜杠）切分 asar 内部路径、导致嵌套文件读写失败的问题。该补丁在 macOS 上是等价无副作用的改动；Windows 安装脚本会在 `npm install` 后显式调用 `patch-package` 应用它，macOS 无需处理。

## 文件说明

- `theme/chiikawa-skin.css` — 主题基础样式（跨平台）
- `theme/chiikawa-skin.win.css` — Windows 专属覆盖样式（仅 Windows 安装时注入）
- `theme/chiikawa-group.png` — 首页对话框右上角叠叠乐贴图（吉伊+乌萨奇+小八）
- `theme/chiikawa-friends.png` — 新对话加载页插图
- `theme/chiichi-serious.png` / `theme/chiichi-playful.png` — sidebar 吉伊
- `theme/momonga.png` — sidebar 飞鼠
- `theme/kuri-manju.png` — sidebar 栗子馒头
- `theme/usagi-logo.png` — logo
- `theme/stack.png` — 装饰素材
- `theme/chiikawa-audio.js` + `theme/assets/*.wav` — 交互音效
- `scripts/patch-theme.mjs` — 构建补丁包（跨平台）
- `scripts/install-theme.mjs` — 备份和原子安装（跨平台）
- `scripts/restore-theme.mjs` — 从指定备份恢复（跨平台）
- `install.sh` / `restore.sh` — macOS 安装/恢复入口
- `install.ps1` / `restore.ps1` / `apply-chiikawa.ps1` / `restore-chiikawa.ps1` — Windows 入口

## 使用边界

这是个人开发者制作的非官方主题。修改应用资源可能影响代码签名，并会在版本更新后被覆盖。

Chiikawa（吉伊卡哇）角色形象相关权利归原作者 Nagano 所有，本仓库仅用于个人、非商业的界面定制，不代表 WorkBuddy、Chiikawa 或任何版权方的官方立场与背书。详见 `NOTICE.md`。

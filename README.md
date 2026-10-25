# WorkBuddy Chiikawa 皮肤

WorkBuddy 的 Chiikawa（吉伊卡哇）主题皮肤。米黄主色调、粉色顶栏、sidebar 三只角色装饰（栗子馒头/飞鼠/吉伊）、首页对话框右上角叠叠乐贴图，附任务音效。

当前已验证版本：WorkBuddy 5.8.3（Windows 实测通过；macOS 理论兼容，欢迎反馈）。

## v3 安装方式（独立皮肤目录，不占用任何官方皮肤）

**安装形式不变：AI / 用户跑一次脚本 → 重启 WorkBuddy → 生效。** 不需要在设置里选任何皮肤。

- **不占用官方皮肤槽位**（激战金秋等保持官方原样）；旧版本占用的槽位会在安装时自动恢复；
- **不改 `app.asar`**（不重打包，不会导致启动崩溃）；
- 皮肤 CSS + 贴纸图片 + 音效**全部以 data URI 内嵌**进启动 payload（实测 WorkBuddy 未注册 `local-file://` 协议，磁盘 URL 永远加载不了——这也是旧版图片/音效一直失效的原因）；
- **重启不再回落官方皮肤**：WorkBuddy 通过 `document.adoptedStyleSheets` 里的构造样式表应用主题（优先级高于任何 `<style>`），启动时还会用它自己的缓存重写一次。v3 的启动 payload 把自己的样式表也放进 `adoptedStyleSheets`，并挂钩该属性保证**永远排在最后**（级联最高优先级）——无论启动时官方样式怎么写，最终生效的都是 Chiikawa。

### 平台差异（与旧版保持一致）

| 平台 | 样式 |
| --- | --- |
| macOS | 基础样式 `chiikawa-skin.css`，侧栏顶栏显示栗子馒头 + 飞鼠 + 吉伊三只贴纸 |
| Windows | 额外合并 `chiikawa-skin.win.css`，隐藏被原生标题栏遮挡的顶栏贴纸 |

## 安装

要求：Node.js 18+。

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

脚本会自动：

1. 定位 WorkBuddy 配置目录（`~/.workbuddy`，可用 `WORKBUDDY_CONFIG_DIR` 覆盖）与安装目录（可用 `WORKBUDDY_RESOURCES_DIR` 覆盖）；
2. 把皮肤部署到独立目录 `~/.workbuddy/appearance-resources/theme-chiikawa-1792829518928/`；
3. 往 `app.asar.unpacked/renderer/index.html` 内联注入启动 payload（皮肤 CSS + data URI 素材 + 点击音效），注入后自动做语法校验，失败自动回滚（原始文件备份为 `index.html.chiikawa-bak`）；
4. 清理旧版本占用过的官方槽位种子。

然后：**完全退出 WorkBuddy（含托盘）再启动即可。**

## 开关

在 WorkBuddy 开发者控制台（Console）里执行：

```js
__CHIIKAWA_SKIN__.setEnabled(false)  // 暂时关闭皮肤样式
__CHIIKAWA_AUDIO__.setEnabled(false) // 关闭音效
```

## 卸载 / 恢复

```bash
# macOS
./uninstall.sh
```

```powershell
# Windows
powershell -ExecutionPolicy Bypass -File .\uninstall.ps1
```

会还原 `index.html`、移除独立皮肤目录，并把旧版本占用过的官方槽位恢复（官方样式会在下次使用时自动重新下载）。主题选择从未被改动，无需还原。

## 常用参数

```
node scripts/install-skin.mjs [--no-audio] [--no-inject]
node scripts/install-skin.mjs --uninstall
```

- `--no-audio`：不注入音效
- `--no-inject`：跳过启动注入（仅部署皮肤文件）

## 已知限制

- **WorkBuddy 自动更新会重置 `index.html`**，注入消失 → 皮肤回落官方样式 → 重跑安装脚本即可恢复（数据都在 `~/.workbuddy`，不受影响）。
- 皮肤是视觉层覆盖：设置 → 外观 里选择的官方主题会正常生效，但视觉上始终被 Chiikawa 覆盖（这正是"不通过选皮肤"的设计）。

## 旧版方案（已弃用，仅供研究）

给 `app.asar` 整包打补丁的安装/恢复脚本在 `legacy/` 目录，**不建议使用**：Windows 上曾多次因版本错配或重打包丢文件导致 WorkBuddy 无法启动。v2 的"槽位预置 + MutationObserver"方案也已被 v3 取代（槽位会被官方 zip 缓存在启动时覆盖；普通 `<style>` 打不赢 `adoptedStyleSheets`）。

## 文件说明

- `theme/chiikawa-skin.css` — 主题基础样式（跨平台）
- `theme/chiikawa-skin.win.css` — Windows 专属覆盖样式（仅 Windows 安装时合并）
- `theme/*.png` — 贴纸素材（叠叠乐、三只角色、logo 等，安装时内嵌为 data URI）
- `theme/assets/*.wav` — 音效素材（任务完成/失败/等待提问）
- `theme/chiikawa-boot.js` — 启动 payload 模板（安装时内联进 index.html）
- `scripts/install-skin.mjs` — v3 安装/卸载脚本（跨平台、零依赖）
- `install.sh` / `uninstall.sh` — macOS 入口
- `install.ps1` / `uninstall.ps1` — Windows 入口
- `legacy/` — 旧版 app.asar 补丁方案（已弃用）

## 使用边界

这是个人开发者制作的非官方主题。v3 方案只写 WorkBuddy 的用户数据目录（`~/.workbuddy`）和 `app.asar.unpacked` 下的一个 HTML 文件，不修改 `app.asar` 与代码签名。

Chiikawa（吉伊卡哇）角色形象相关权利归原作者 Nagano 所有，本仓库仅用于个人、非商业的界面定制，不代表 WorkBuddy、Chiikawa 或任何版权方的官方立场与背书。详见 `NOTICE.md`。

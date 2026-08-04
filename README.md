# WorkBuddy Chiikawa 皮肤

WorkBuddy 的 Chiikawa（吉伊卡哇）主题皮肤。包含米黄主色调、粉色顶栏、sidebar 三只角色装饰（栗子馒头/飞鼠/吉伊）、首页对话框右上角叠叠乐贴图。

当前已验证版本：WorkBuddy 5.3.7。

## 效果

- 主页/对话区：温暖米黄色底色
- 侧边栏/顶栏：柔和粉色调
- 首页 input 框右上角：吉伊+乌萨奇+小八叠叠乐贴图
- 侧边栏顶栏：栗子馒头 + 飞鼠 + 吉伊三只角色一字排开

## 安装

要求：

- macOS
- WorkBuddy 安装在 `/Applications/WorkBuddy.app`
- Node.js 22.12 或更高版本

```bash
git clone <repo-url>
cd workbuddy-chiikawa-theme
npm ci --ignore-scripts
./install.sh
```

安装后用 **Command + Q** 完全退出 WorkBuddy，再重新打开。

## 恢复原版

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

## 文件说明

- `theme/chiikawa-skin.css` — 主题样式
- `theme/chiikawa-group.png` — 首页对话框右上角叠叠乐贴图（吉伊+乌萨奇+小八）
- `theme/chiichi-serious.png` — sidebar 吉伊
- `theme/momonga.png` — sidebar 飞鼠
- `theme/kuri-manju.png` — sidebar 栗子馒头
- `theme/usagi-logo.png` — logo
- `theme/chiichi-playful.png` / `theme/stack.png` — 装饰素材
- `scripts/patch-theme.mjs` — 构建补丁包
- `scripts/install-theme.mjs` — 备份和原子安装
- `scripts/restore-theme.mjs` — 从指定备份恢复
- `install.sh` — macOS 安装入口
- `restore.sh` — macOS 恢复入口

## 使用边界

这是个人开发者制作的非官方主题。修改应用资源可能影响代码签名，并会在版本更新后被覆盖。

Chiikawa（吉伊卡哇）角色形象相关权利归原作者 Nagano 所有，本仓库仅用于个人、非商业的界面定制，不代表 WorkBuddy、Chiikawa 或任何版权方的官方立场与背书。详见 `NOTICE.md`。

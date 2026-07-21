# WorkBuddy QQ 2008 皮肤

面向 macOS WorkBuddy 的 QQ 2008 风格皮肤。包含玻璃蓝顶栏、立体按钮、紧凑任务列表、Tahoma 风格字体，以及聊天框右上角企鹅。

CNB 司内公开仓库：`https://cnb.woa.com/runcao/workbuddy-qq2008-theme`

当前已验证版本：WorkBuddy 5.3.1。

## 给 WorkBuddy Agent 的一句话

把下面这句话发给 WorkBuddy Agent：

> 请克隆 `https://cnb.woa.com/runcao/workbuddy-qq2008-theme.git`，先阅读 `AGENT_INSTALL.md` 并审查安装脚本，然后为当前 macOS WorkBuddy 安装 QQ 2008 皮肤，完成备份和校验后告诉我重启方式与恢复路径。

Agent 会检查系统和 WorkBuddy 版本、安装本地依赖、基于当前版本重新构建 `app.asar`、备份原版并安装皮肤。

## 手动安装

要求：

- macOS
- WorkBuddy 安装在 `/Applications/WorkBuddy.app`
- Node.js 22.12 或更高版本

执行：

```bash
git clone https://cnb.woa.com/runcao/workbuddy-qq2008-theme.git
cd workbuddy-qq2008-theme
./install.sh
```

安装后用 `Command + Q` 完全退出 WorkBuddy，再重新打开。

## 安全与回滚

安装过程不会直接修改原包内容。它会：

1. 从当前 WorkBuddy 的 `app.asar` 构建一个补丁副本。
2. 校验 HTML、CSS 和企鹅图片均已写入。
3. 把当前原版备份到 `~/.workbuddy/backups/workbuddy-qq2008/<时间>/app.asar`。
4. 校验备份 SHA-256 后，通过同目录临时文件原子替换。

恢复时先完全退出 WorkBuddy，然后运行：

```bash
./restore.sh "$HOME/.workbuddy/backups/workbuddy-qq2008/<时间>/app.asar"
```

## 版本更新

WorkBuddy 更新通常会覆盖 `app.asar`，皮肤会失效。不要恢复旧版本的整包备份到新版本上，直接让 Agent 重新执行安装流程。脚本会以当前版本原包重新构建。

如果新版本调整了关键界面选择器，Agent 应停止安装并先做兼容性检查。

## 文件说明

- `theme/qq2008-skin.css`：主题样式
- `theme/qq-penguin-user.png`：企鹅图片
- `scripts/patch-theme.mjs`：在副本上构建并校验补丁
- `scripts/install-theme.mjs`：备份和原子安装
- `scripts/restore-theme.mjs`：从指定备份恢复
- `install.sh`：macOS 安装入口
- `restore.sh`：macOS 恢复入口

## 使用边界

这是内部个人定制项目，不是 WorkBuddy 官方主题。修改应用资源可能影响代码签名，并会在版本更新后被覆盖。

企鹅图片及 QQ 相关视觉元素涉及腾讯品牌资产，本仓库仅用于腾讯内部、个人非商业界面定制，不代表官方背书。详见 `NOTICE.md`。

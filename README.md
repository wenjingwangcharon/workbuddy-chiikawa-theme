# WorkBuddy QQ 2008 皮肤

面向 macOS WorkBuddy 的 QQ 2008 风格皮肤。包含玻璃蓝顶栏、立体按钮、紧凑任务列表、Tahoma 风格字体、聊天框右上角企鹅、随 WorkBuddy 外观设置自动切换的深色模式，以及复古提示音：任务完成时播放“滴滴滴”，AI 发出选择题澄清意图时播放“咳嗽”。

CNB：`https://cnb.woa.com/runcao/workbuddy-qq2008-theme`

当前已验证版本：WorkBuddy 5.3.3。

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

## 快速切换原版皮肤

安装后，左侧顶部的 WorkBuddy 标识旁会出现一个切换按钮：

- QQ 2008 皮肤开启时，按钮显示“原版”；点击后恢复 WorkBuddy 原始样式，并同时暂停复古提示音。
- 原版样式开启时，按钮显示“QQ 2008”；点击后重新启用皮肤和提示音。

切换结果会保存在本机，通常立即生效；如果个别区域没有刷新，用 `Command + Q` 完全退出并重新打开即可。这个按钮只停用皮肤样式，不会用旧备份覆盖当前 WorkBuddy，因此比反复恢复 `app.asar` 更适合日常切换。

如需从应用中彻底移除皮肤注入，仍可使用下方的恢复脚本。

## 复古提示音

- 任务从运行中变为完成：播放“滴滴滴”。
- AI 在对话中发出待回答的选择题：播放一次“咳嗽”。
- 失败、错误或终止的任务保持安静；启动时只记录现有状态，不会为历史内容补播提示音。

如需临时关闭或调整音量，可在 WorkBuddy 开发者工具控制台执行：

```js
window.__QQ2008_TASK_SOUND__.setEnabled(false)
window.__QQ2008_TASK_SOUND__.setVolume(0.5)
```

音量范围为 `0` 到 `1`；重新启用时传入 `true`。

## 安全与回滚

安装过程不会直接修改原包内容。它会：

1. 从当前 WorkBuddy 的 `app.asar` 构建一个补丁副本。
2. 校验 HTML、CSS、提示音脚本、两段 WAV 音效和企鹅图片均已写入。
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
- `theme/qq2008-notify.js`：监听任务完成与 AI 选择题状态并播放对应提示音
- `theme/qq-message.wav`：任务成功时的“滴滴滴”
- `theme/qq-failure.wav`：AI 发出选择题澄清意图时的“咳嗽”（为兼容旧安装保留文件名）
- `scripts/patch-theme.mjs`：在副本上构建并校验补丁
- `scripts/install-theme.mjs`：备份和原子安装
- `scripts/restore-theme.mjs`：从指定备份恢复
- `scripts/verify-notify.mjs`：验证任务完成与选择题提示不会漏播或重复播放
- `install.sh`：macOS 安装入口
- `restore.sh`：macOS 恢复入口

## 使用边界

这是个人开发者制作的非官方主题。修改应用资源可能影响代码签名，并会在版本更新后被覆盖。

企鹅图片及 QQ 相关视觉元素的相关权利归其权利人所有，本仓库仅用于个人、非商业的界面定制，不代表 WorkBuddy、QQ 或腾讯的官方立场与背书。详见 `NOTICE.md`。

# Agent 安装指令

收到用户明确的安装请求后，按以下步骤执行。不要跳过备份和验证。

1. 确认系统为 macOS，WorkBuddy 位于 `/Applications/WorkBuddy.app`。
2. 读取 WorkBuddy 当前版本号和 `app.asar` SHA-256。
3. 阅读 `install.sh`、`scripts/patch-theme.mjs` 和 `scripts/install-theme.mjs`，确认没有本机用户路径或未说明的外部上传。
4. 检查新版本资源中是否仍包含以下稳定选择器：
   - `conversation-list-logo-row`
   - `user-menu-trigger--workbuddy`
   - `wb-scene-tabs`
   - `wb-home-composer__input-slot`
   - `topRightSlotStandalone`
5. 如果选择器缺失，停止安装并向用户报告兼容性风险。
6. 如果选择器兼容，执行 `./install.sh`。WorkBuddy 正在运行时允许原子替换，但必须提醒用户安装后用 `Command + Q` 完全退出并重新打开。
7. 安装后从目标 `app.asar` 验证：
   - `renderer/index.html` 包含 `qq2008-skin.css`
   - `renderer/assets/qq2008-skin.css` 存在
   - `renderer/assets/qq-penguin-user.png` 存在
8. 报告当前版本、安装后 SHA-256、原版备份完整路径和重启方式。

版本升级后，必须基于新版本原包重新构建。不要把旧版本备份覆盖到新版本。

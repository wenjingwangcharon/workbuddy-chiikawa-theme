# Agent 安装指令

收到用户明确的安装请求后，按以下步骤执行。v2 安装方式不修改 `app.asar`，无崩溃风险。

1. 确认平台（macOS / Windows）。v2 脚本跨平台，Windows 走 `install.ps1`，macOS 走 `install.sh`；两者最终都调用 `scripts/install-skin.mjs`。
2. 确认 WorkBuddy 已安装并至少启动过一次（配置目录 `~/.workbuddy` 存在）。若无 `~/.workbuddy`，提示用户先启动一次 WorkBuddy。
3. 阅读 `scripts/install-skin.mjs`，确认没有本机用户路径硬编码或未说明的外部上传。
4. 让用户打开一次 WorkBuddy 的 **设置 → 外观** 页面（使主题目录缓存生成），然后执行安装脚本。
5. 安装完成后从产物验证：
   - `~/.workbuddy/appearance-resources/<slot>-<updatedAt>/skin.v2.css` 存在，且包含 `Chiikawa skin (native slot seed)` 标记；
   - 同目录 `<主题名>/assets/custom/` 下 8 张 png 齐全；
   - Windows 上 skin.v2.css 应包含 `Windows overrides` 段；macOS 上**不应**包含（保持顶栏三只贴纸可见）；
   - skin.v2.css 内图片引用为 `local-file://local/...` 绝对路径，且指向的文件真实存在。
6. 提醒用户：
   - 安装时 WorkBuddy 若在运行，脚本会跳过自动切换主题 → 重启后到 设置 → 外观 点一次该主题卡片；
   - 安装时 WorkBuddy 已关闭 → 重启即生效；
   - 列表卡片封面仍是官方预览图，属正常。
7. 卸载用 `uninstall.ps1` / `uninstall.sh`（会还原 preferences.json 备份）。
8. 若服务器更新了槽位主题导致皮肤失效，重新运行安装脚本即可（脚本每次都会重新解析 updatedAt）。

旧版 app.asar 整包补丁方案已移至 `legacy/`，**不要使用**：Windows 上曾多次导致启动崩溃，且会被自动更新覆盖。

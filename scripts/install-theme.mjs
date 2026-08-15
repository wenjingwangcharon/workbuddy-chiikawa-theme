#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const getArg = (name, fallback = "") => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const isWindows = process.platform === "win32";
const defaultTarget = isWindows
  ? path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"), "Programs", "WorkBuddy", "resources", "app.asar")
  : "/Applications/WorkBuddy.app/Contents/Resources/app.asar";

const patched = path.resolve(getArg("--patched"));
const target = path.resolve(getArg("--target", defaultTarget));
const backupRoot = path.resolve(getArg("--backup-dir", path.join(os.homedir(), ".workbuddy", "backups", "workbuddy-chiikawa")));
const allowRunning = args.includes("--allow-running");

if (!patched || !fs.existsSync(patched)) throw new Error("请使用 --patched 指定已验证的 app.chiikawa.asar");
if (!fs.existsSync(target)) throw new Error(`找不到 WorkBuddy 资源：${target}`);

function detectRunning() {
  if (isWindows) {
    // Windows 下 app.asar 被运行中的进程独占锁定，替换必然失败，因此必须先检测。
    const check = spawnSync("tasklist", ["/FI", "IMAGENAME eq WorkBuddy.exe", "/NH"], { encoding: "utf8" });
    return (check.stdout || "").toLowerCase().includes("workbuddy.exe");
  }
  const check = spawnSync("/usr/bin/pgrep", ["-fl", "/Applications/WorkBuddy.app/Contents/Frameworks/WorkBuddy Helper"], { encoding: "utf8" });
  return Boolean((check.stdout || "").trim());
}
const isRunning = detectRunning();
if (isRunning && isWindows) {
  // Windows 无法像 macOS 那样在进程运行时原子替换被打开的文件，--allow-running 在此平台不可用。
  throw new Error("WorkBuddy 正在运行：Windows 会独占锁定 app.asar，必须先完全退出应用（含系统托盘图标）后再安装。");
}
if (isRunning && !allowRunning) throw new Error("WorkBuddy 仍在运行。请完全退出应用后再安装，或在明确承担风险后传入 --allow-running。");
if (isRunning && allowRunning) console.warn("WorkBuddy 正在运行：将原子替换资源文件，必须完全退出并重启后才会生效。");

const hash = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const stamp = new Date().toISOString().replaceAll(":", "-");
const backupDir = path.join(backupRoot, stamp);
const backup = path.join(backupDir, "app.asar");
const temp = `${target}.chiikawa-installing`;
fs.mkdirSync(backupDir, { recursive: true });
fs.copyFileSync(target, backup);
if (hash(target) !== hash(backup)) throw new Error("备份校验失败，已停止安装。");

fs.copyFileSync(patched, temp);
if (hash(patched) !== hash(temp)) {
  fs.rmSync(temp, { force: true });
  throw new Error("补丁复制校验失败，原应用未改动。");
}
try {
  fs.renameSync(temp, target);
} catch (error) {
  fs.rmSync(temp, { force: true });
  if (isWindows && (error.code === "EPERM" || error.code === "EBUSY")) {
    throw new Error(`替换失败：${target} 正被占用。请确认 WorkBuddy 已完全退出（含托盘图标）后重试。原备份保留在 ${backup}`);
  }
  throw error;
}

const receipt = {
  installedAt: new Date().toISOString(),
  target,
  backup,
  originalSha256: hash(backup),
  patchedSha256: hash(target)
};
fs.writeFileSync(path.join(backupDir, "receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify(receipt, null, 2));

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

const backup = path.resolve(getArg("--backup"));
const target = path.resolve(getArg("--target", defaultTarget));
const allowRunning = args.includes("--allow-running");
if (!backup || !fs.existsSync(backup)) throw new Error("请使用 --backup 指定备份 app.asar");
if (!fs.existsSync(target)) throw new Error(`找不到 WorkBuddy 资源：${target}`);

function detectRunning() {
  if (isWindows) {
    const check = spawnSync("tasklist", ["/FI", "IMAGENAME eq WorkBuddy.exe", "/NH"], { encoding: "utf8" });
    return (check.stdout || "").toLowerCase().includes("workbuddy.exe");
  }
  const check = spawnSync("/usr/bin/pgrep", ["-fl", "/Applications/WorkBuddy.app/Contents/Frameworks/WorkBuddy Helper"], { encoding: "utf8" });
  return Boolean((check.stdout || "").trim());
}
const isRunning = detectRunning();
if (isRunning && isWindows) throw new Error("WorkBuddy 正在运行：Windows 会独占锁定 app.asar，请先完全退出应用（含系统托盘图标）后再恢复。");
if (isRunning && !allowRunning) throw new Error("WorkBuddy 仍在运行。请完全退出应用后再恢复，或在测试副本时传入 --allow-running。");

const hash = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const temp = `${target}.chiikawa-restoring`;
fs.copyFileSync(backup, temp);
if (hash(backup) !== hash(temp)) {
  fs.rmSync(temp, { force: true });
  throw new Error("恢复文件校验失败，当前应用未改动。");
}
try {
  fs.renameSync(temp, target);
} catch (error) {
  fs.rmSync(temp, { force: true });
  if (isWindows && (error.code === "EPERM" || error.code === "EBUSY")) {
    throw new Error(`恢复失败：${target} 正被占用。请确认 WorkBuddy 已完全退出（含托盘图标）后重试。`);
  }
  throw error;
}
console.log(JSON.stringify({ restored: true, target, backup, sha256: hash(target) }, null, 2));

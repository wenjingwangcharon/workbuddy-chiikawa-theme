#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const getArg = (name, fallback = "") => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const backup = path.resolve(getArg("--backup"));
const target = path.resolve(getArg("--target", "/Applications/WorkBuddy.app/Contents/Resources/app.asar"));
const allowRunning = args.includes("--allow-running");
if (!backup || !fs.existsSync(backup)) throw new Error("请使用 --backup 指定备份 app.asar");
if (!fs.existsSync(target)) throw new Error(`找不到 WorkBuddy 资源：${target}`);

const processCheck = spawnSync("/usr/bin/pgrep", ["-fl", "/Applications/WorkBuddy.app/Contents/Frameworks/WorkBuddy Helper"], { encoding: "utf8" });
if ((processCheck.stdout || "").trim() && !allowRunning) throw new Error("WorkBuddy 仍在运行。请完全退出应用后再恢复，或在测试副本时传入 --allow-running。");

const hash = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const temp = `${target}.chiikawa-restoring`;
fs.copyFileSync(backup, temp);
if (hash(backup) !== hash(temp)) {
  fs.rmSync(temp, { force: true });
  throw new Error("恢复文件校验失败，当前应用未改动。");
}
fs.renameSync(temp, target);
console.log(JSON.stringify({ restored: true, target, backup, sha256: hash(target) }, null, 2));

#!/usr/bin/env node
/**
 * Chiikawa skin installer for WorkBuddy (v2 — native theme-slot method).
 *
 * How it works (no app.asar patching, update-safe, crash-proof):
 *   1. WorkBuddy's theme list comes from its server catalog; local folders are
 *      never listed. But when applying a theme, WorkBuddy first checks the
 *      local cache file  <configDir>/appearance-resources/<resourceKey>-<updatedAt>/skin.v2.css
 *      and only downloads the official zip when that cache misses.
 *   2. We pre-seed that cache for a slot the user does not use
 *      (default: theme-tkmw7j "和平精英激战金秋"). Selecting that slot in
 *      Settings → Appearance then loads Chiikawa.
 *   3. Platform parity with the original install: the Windows-only override
 *      (theme/chiikawa-skin.win.css, hides sidebar topbar stickers that the
 *      native title bar covers) is merged ONLY on win32; macOS keeps the
 *      base look with stickers visible.
 *
 * Usage:
 *   node scripts/install-skin.mjs [--slot theme-tkmw7j] [--ts <updatedAt>] [--no-select] [--name "Chiikawa吉伊卡哇"]
 *   node scripts/install-skin.mjs --uninstall
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const THEME_DIR = path.join(REPO_DIR, "theme");
const SLOT_DEFAULT = "theme-tkmw7j";
const THEME_NAME_DEFAULT = "Chiikawa吉伊卡哇";
const MARKER = "/* Chiikawa skin (native slot seed) */";

// ---------- args ----------
const args = process.argv.slice(2);
function argValue(name, fallback) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}
const hasFlag = (name) => args.includes(name);
if (hasFlag("--help") || hasFlag("-h")) {
  console.log(`Usage: node scripts/install-skin.mjs [--slot theme-tkmw7j] [--ts <updatedAt>] [--no-select] [--name "<name>"]
       node scripts/install-skin.mjs --uninstall [--slot theme-tkmw7j]`);
  process.exit(0);
}
const uninstall = hasFlag("--uninstall");
const slot = argValue("--slot", SLOT_DEFAULT);
const themeName = argValue("--name", THEME_NAME_DEFAULT);
const tsOverride = argValue("--ts", null);
const autoSelect = !hasFlag("--no-select");
const isWin = process.platform === "win32";
const isMac = process.platform === "darwin";

// ---------- config dir ----------
function findConfigDir() {
  const candidates = [];
  if (process.env.WORKBUDDY_CONFIG_DIR) candidates.push(process.env.WORKBUDDY_CONFIG_DIR);
  candidates.push(path.join(os.homedir(), ".workbuddy"));
  if (isMac) candidates.push(path.join(os.homedir(), "Library", "Application Support", "WorkBuddy"));
  for (const c of candidates) {
    if (fs.existsSync(c) && (fs.existsSync(path.join(c, "appearance-resources")) || fs.existsSync(path.join(c, "storage")))) {
      return c;
    }
  }
  return null;
}

// ---------- slot updatedAt from swr cache ----------
function findUpdatedAtFromCache(configDir, slot) {
  const storageDir = path.join(configDir, "storage");
  if (!fs.existsSync(storageDir)) return null;
  for (const user of fs.readdirSync(storageDir)) {
    const scoped = path.join(storageDir, user, "scoped");
    if (!fs.existsSync(scoped)) continue;
    for (const hash of fs.readdirSync(scoped)) {
      const swr = path.join(scoped, hash, "swr.json");
      if (!fs.existsSync(swr)) continue;
      try {
        const data = JSON.parse(fs.readFileSync(swr, "utf8"));
        for (const [key, val] of Object.entries(data)) {
          const keyStr = Array.isArray(key) ? JSON.stringify(key) : String(key);
          if (!keyStr.includes("appearance:catalog")) continue;
          const entries = val && val.data;
          if (Array.isArray(entries)) {
            const hit = entries.find((e) => e && e.resourceKey === slot && typeof e.updatedAt === "number");
            if (hit) return hit.updatedAt;
          }
        }
      } catch {
        /* ignore unreadable cache files */
      }
    }
  }
  return null;
}

// ---------- url scheme detection (local-file://local/ vs local-file:///) ----------
function detectUrlScheme(configDir) {
  const root = path.join(configDir, "appearance-resources");
  if (!fs.existsSync(root)) return "local-file://local/";
  const candidates = ["theme-tkboqn", "theme-tkbera", "theme-tkmw7j", "theme-tkbdx8"];
  for (const dir of fs.readdirSync(root)) {
    if (!candidates.some((c) => dir.startsWith(c))) continue;
    const v2 = path.join(root, dir, "skin.v2.css");
    if (!fs.existsSync(v2)) continue;
    const head = fs.readFileSync(v2, "utf8").slice(0, 200000);
    if (head.includes("local-file://local/")) return "local-file://local/";
    if (head.includes("local-file:///")) return "local-file:///";
  }
  return "local-file://local/";
}

function encodeSegments(absPath) {
  return absPath
    .replace(/\\/g, "/")
    .split("/")
    .filter((s) => s !== "")
    .map(encodeURIComponent)
    .join("/");
}

function rewriteUrls(css, scheme, targetDir, assetsDirName) {
  const base = `${scheme}${encodeSegments(targetDir)}/${encodeSegments(assetsDirName)}`;
  let n = 0;
  const out = css.replace(/url\(\s*(['"]?)\.?\/?([^'")]+\.png)\1\s*\)/g, (_m, _q, name) => {
    n++;
    return `url("${base}/${encodeURIComponent(name)}")`;
  });
  return { out, n };
}

// ---------- CSS assembly (platform parity) ----------
function buildCss(configDir) {
  const base = fs.readFileSync(path.join(THEME_DIR, "chiikawa-skin.css"), "utf8");
  let css = base;
  if (isWin) {
    // Windows only: hide sidebar topbar stickers (covered by native title bar).
    // macOS keeps them visible, matching the original two-variant install.
    css += "\n\n/* ===== Windows overrides (auto-applied on win32 only) ===== */\n";
    css += fs.readFileSync(path.join(THEME_DIR, "chiikawa-skin.win.css"), "utf8");
  }
  const assetsDirName = `${themeName}/assets/custom`;
  const scheme = detectUrlScheme(configDir);
  return { css, scheme, assetsDirName };
}

const IMAGES = [
  "usagi-logo.png",
  "momonga.png",
  "kuri-manju.png",
  "chiichi-serious.png",
  "chiichi-playful.png",
  "chiikawa-friends.png",
  "chiikawa-group.png",
  "stack.png",
];

// ---------- running check ----------
function workbuddyRunning() {
  try {
    if (isWin) {
      const out = execFileSync("tasklist", ["/FI", "IMAGENAME eq WorkBuddy.exe", "/NH"], { encoding: "utf8" });
      return /WorkBuddy\.exe/i.test(out);
    }
    if (isMac) {
      const out = execFileSync("pgrep", ["-f", "WorkBuddy.app/Contents/MacOS"], { encoding: "utf8" });
      return out.trim().length > 0;
    }
  } catch {
    return false; // pgrep exit code 1 = not running
  }
  return false;
}

// ---------- auto-select (preferences.json) ----------
function findPreferences(configDir) {
  const storageDir = path.join(configDir, "storage");
  if (!fs.existsSync(storageDir)) return null;
  for (const user of fs.readdirSync(storageDir)) {
    const m = user.match(/^user-(.+)-personal$/);
    const prefs = path.join(storageDir, user, "global", "preferences.json");
    if (m && fs.existsSync(prefs)) return { file: prefs, uid: m[1] };
  }
  return null;
}

function writeSelection(configDir, slot, uid) {
  const found = findPreferences(configDir);
  if (!found) return { ok: false, reason: "preferences.json not found" };
  let prefs;
  try {
    prefs = JSON.parse(fs.readFileSync(found.file, "utf8"));
  } catch (e) {
    return { ok: false, reason: `preferences.json unreadable: ${e.message}` };
  }
  const backup = found.file + ".chiikawa-bak";
  if (!fs.existsSync(backup)) fs.copyFileSync(found.file, backup);
  prefs["appearanceTheme"] = slot;
  prefs["appearance.themeSelection"] = {
    resourceKey: slot,
    uid: found.uid,
    source: "settings-select",
    revision: Date.now(),
  };
  fs.writeFileSync(found.file, JSON.stringify(prefs, null, 2), "utf8");
  return { ok: true, backup };
}

function revertSelection(configDir) {
  const found = findPreferences(configDir);
  if (!found) return false;
  const backup = found.file + ".chiikawa-bak";
  if (fs.existsSync(backup)) {
    fs.copyFileSync(backup, found.file);
    return true;
  }
  // no backup: just strip our keys
  try {
    const prefs = JSON.parse(fs.readFileSync(found.file, "utf8"));
    delete prefs["appearanceTheme"];
    delete prefs["appearance.themeSelection"];
    fs.writeFileSync(found.file, JSON.stringify(prefs, null, 2), "utf8");
    return true;
  } catch {
    return false;
  }
}

// ---------- main ----------
const configDir = findConfigDir();
if (!configDir) {
  console.error("未找到 WorkBuddy 配置目录（~/.workbuddy）。请确认 WorkBuddy 已安装并至少启动过一次。");
  process.exit(1);
}
const appearanceRoot = path.join(configDir, "appearance-resources");
fs.mkdirSync(appearanceRoot, { recursive: true });

if (uninstall) {
  let removed = false;
  for (const dir of fs.readdirSync(appearanceRoot)) {
    if (!dir.startsWith(slot + "-")) continue;
    const v2 = path.join(appearanceRoot, dir, "skin.v2.css");
    if (fs.existsSync(v2) && fs.readFileSync(v2, "utf8").startsWith(MARKER)) {
      fs.rmSync(path.join(appearanceRoot, dir), { recursive: true, force: true });
      console.log("已移除:", path.join(appearanceRoot, dir));
      removed = true;
    }
  }
  const reverted = revertSelection(configDir);
  console.log(removed ? "Chiikawa 皮肤已卸载。" : "未发现 Chiikawa 种子目录。");
  console.log(reverted ? "主题选择已还原。" : "（无需还原主题选择）");
  process.exit(0);
}

// 1. resolve slot updatedAt
let updatedAt = tsOverride ? Number(tsOverride) : findUpdatedAtFromCache(configDir, slot);
if (!updatedAt) {
  console.error(`未能从本地缓存解析出 ${slot} 的 updatedAt。`);
  console.error("请先打开一次 WorkBuddy 的 设置 → 外观 页面（让主题目录缓存生成），然后重新运行本脚本。");
  console.error("或者手动指定：node scripts/install-skin.mjs --ts <updatedAt毫秒时间戳>");
  process.exit(1);
}

// 2. write seed dir
const targetDir = path.join(appearanceRoot, `${slot}-${updatedAt}`);
const assetsTarget = path.join(targetDir, themeName, "assets", "custom");
fs.mkdirSync(assetsTarget, { recursive: true });

const { css, scheme, assetsDirName } = buildCss(configDir);
const { out: finalCss, n } = rewriteUrls(css, scheme, targetDir, assetsDirName);
fs.writeFileSync(path.join(targetDir, "skin.v2.css"), MARKER + "\n" + finalCss, "utf8");

let copied = 0;
for (const img of IMAGES) {
  const src = path.join(THEME_DIR, img);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(assetsTarget, img));
    copied++;
  } else {
    console.warn("警告: 缺少素材", img);
  }
}

console.log(`平台: ${process.platform}${isWin ? "（已合并 Windows 专属覆盖 win.css）" : "（macOS 基础样式，顶栏贴纸保留）"}`);
console.log(`槽位: ${slot}  目录: ${path.join(appearanceRoot, `${slot}-${updatedAt}`)}`);
console.log(`已写入 skin.v2.css（重写 ${n} 处图片引用），复制素材 ${copied} 张。`);

// 3. auto-select
if (autoSelect) {
  if (workbuddyRunning()) {
    console.log("");
    console.log("WorkBuddy 正在运行，跳过自动切换主题（运行中修改会被覆盖）。");
    console.log("→ 完全退出 WorkBuddy 后重新运行本脚本，或重启后在 设置 → 外观 点一次『该主题』即可。");
  } else {
    const r = writeSelection(configDir, slot);
    if (r.ok) {
      console.log("已自动将主题切换为该槽位（备份: " + r.backup + "）。重启 WorkBuddy 即生效。");
    } else {
      console.log("自动切换主题失败（" + r.reason + "）。重启后在 设置 → 外观 点一次『该主题』即可。");
    }
  }
}

console.log("");
console.log("完成。列表里该主题卡片的封面图仍是官方预览图，选中后实际加载的是 Chiikawa。");

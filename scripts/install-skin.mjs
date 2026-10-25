#!/usr/bin/env node
/**
 * Chiikawa skin installer for WorkBuddy (v3 — standalone theme, no slot hijack).
 *
 * Install form (same as the original: run once, restart WorkBuddy, done):
 *   1. Theme css + images + sounds are deployed to a STANDALONE directory
 *        <configDir>/appearance-resources/theme-chiikawa-1792829518928/
 *      No official slot (激战金秋 etc.) is touched; any slot seeded by older
 *      versions is cleaned up and returns to the official skin.
 *   2. A small payload is INLINED into the on-disk unpacked renderer's
 *      index.html. The window loads index.html via the ASAR virtual path,
 *      so relative ./assets/ URLs resolve through the ASAR header and
 *      external dropped files never load — hence inline.
 *   3. All images and sounds are embedded as data: URIs. WorkBuddy does
 *      NOT register a local-file:// protocol handler (verified), so disk
 *      URLs in css never loaded — data URIs always work.
 *   4. PERSISTENCE: WorkBuddy applies theme CSS through a constructed
 *      stylesheet inside document.adoptedStyleSheets, which beats any
 *      plain <style>. v3's payload therefore keeps its own sheet in
 *      adoptedStyleSheets and hooks the accessor so it is ALWAYS last
 *      (highest cascade priority). Whatever the theme engine writes or
 *      re-applies at startup, the skin stays Chiikawa after restart.
 *   5. WorkBuddy auto-updates reset index.html → rerun this script.
 *
 * Usage:
 *   node scripts/install-skin.mjs [--no-audio] [--no-inject]
 *   node scripts/install-skin.mjs --uninstall
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const THEME_DIR = path.join(REPO_DIR, "theme");
const STANDALONE_DIR = "theme-chiikawa-1792829518928";
const THEME_ASSETS_DIRNAME = "Chiikawa吉伊卡哇";
const MARKER = "/* Chiikawa skin (standalone theme dir) */";
// markers written by v2 and earlier slot-hijack versions — cleaned up on install
const LEGACY_SLOT_MARKERS = [
  "/* Chiikawa skin (native slot seed) */",
  "/* Chiikawa skin (slot seed) */",
];

// ---------- args ----------
const args = process.argv.slice(2);
const hasFlag = (name) => args.includes(name);
if (hasFlag("--help") || hasFlag("-h")) {
  console.log("Usage: node scripts/install-skin.mjs [--no-audio] [--no-inject]");
  console.log("       node scripts/install-skin.mjs --uninstall");
  process.exit(0);
}
const uninstall = hasFlag("--uninstall");
const noAudio = hasFlag("--no-audio");
const noInject = hasFlag("--no-inject");
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

// ---------- CSS assembly ----------
function readDataUri(relPath, mime) {
  const p = path.join(THEME_DIR, relPath);
  if (!fs.existsSync(p)) return null;
  return `data:${mime};base64,` + fs.readFileSync(p).toString("base64");
}

function buildCss() {
  let css = fs.readFileSync(path.join(THEME_DIR, "chiikawa-skin.css"), "utf8");
  if (isWin) {
    css += "\n\n/* ===== Windows overrides (auto-applied on win32 only) ===== */\n";
    css += fs.readFileSync(path.join(THEME_DIR, "chiikawa-skin.win.css"), "utf8");
  }
  // embed every url(*.png) as a data URI (no protocol handler needed)
  let n = 0;
  css = css.replace(/url\(\s*(['"]?)\.?\/?([^'")]+\.png)\1\s*\)/g, (_m, _q, name) => {
    const uri = readDataUri(name, "image/png");
    if (!uri) {
      console.warn("警告: 缺少素材", name);
      return _m;
    }
    n++;
    return `url("${uri}")`;
  });
  return { css, n };
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

const SOUNDS = [
  "Yoolooko - 乌拉呀哈呀哈乌拉.wav",
  "Yoolooko - 纳尼纳尼.wav",
  "Yoolooko - 曾曾哇嘎乃.wav",
];

const SKIN_CSS_FILES = isWin
  ? ["chiikawa-skin.css", "chiikawa-skin.win.css"]
  : ["chiikawa-skin.css"];

// ---------- install dir discovery ----------
function findResourcesDir() {
  const candidates = [];
  if (process.env.WORKBUDDY_RESOURCES_DIR) candidates.push(process.env.WORKBUDDY_RESOURCES_DIR);
  if (isWin) {
    if (process.env.LOCALAPPDATA) candidates.push(path.join(process.env.LOCALAPPDATA, "Programs", "WorkBuddy", "resources"));
    candidates.push(path.join("C:", "Program Files", "WorkBuddy", "resources"));
    try {
      const out = execFileSync(
        "powershell",
        ["-NoProfile", "-Command",
         "(Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*' -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like '*WorkBuddy*' } | Select-Object -First 1).InstallLocation"],
        { encoding: "utf8", timeout: 20000 }
      ).trim();
      if (out) candidates.push(path.join(out, "resources"));
    } catch {
      /* registry lookup failed — fall through */
    }
    // fallback: ask a running WorkBuddy process for its own exe path
    try {
      const out = execFileSync(
        "powershell",
        ["-NoProfile", "-Command", "(Get-Process WorkBuddy -ErrorAction SilentlyContinue | Select-Object -First 1).Path"],
        { encoding: "utf8", timeout: 20000 }
      ).trim();
      if (out) candidates.push(path.join(path.dirname(out), "resources"));
    } catch {
      /* process lookup failed — fall through */
    }
  } else if (isMac) {
    candidates.push("/Applications/WorkBuddy.app/Contents/Resources");
    candidates.push(path.join(os.homedir(), "Applications", "WorkBuddy.app", "Contents", "Resources"));
  }
  for (const c of candidates) {
    if (c && fs.existsSync(path.join(c, "app.asar.unpacked", "renderer", "index.html"))) return c;
  }
  return null;
}

function rendererIndex(resourcesDir) {
  return path.join(resourcesDir, "app.asar.unpacked", "renderer", "index.html");
}

// ---------- inline payload injection ----------
const BOOT_TEMPLATE = path.join(THEME_DIR, "chiikawa-boot.js");
const BOOT_MARKER = "CHIIKAWA-BOOT-INLINE";
const LEGACY_TAGS = [
  `<script defer src="./assets/chiikawa-boot.js"></script>`,
  `<script defer src="./assets/chiikawa-audio.js"></script>`,
];

function buildInlinePayload(skinCss, sounds) {
  const jsonSafe = (s) => JSON.stringify(s).replace(/<\//g, "<\\/");
  let code = fs.readFileSync(BOOT_TEMPLATE, "utf8");
  code = code
    .replaceAll("__CHIIKAWA_SKIN_CSS__", jsonSafe(skinCss))
    .replaceAll("__CHIIKAWA_SOUNDS__", sounds === null ? "null" : jsonSafe(sounds));
  if (code.includes("__CHIIKAWA_SKIN_CSS__") || code.includes("__CHIIKAWA_SOUNDS__")) {
    throw new Error("boot template placeholders not fully replaced");
  }
  return `<script>/* ${BOOT_MARKER} */\n${code}\n</script>`;
}

function extractPayloadJs(htmlPath) {
  const html = fs.readFileSync(htmlPath, "utf8");
  const start = html.indexOf(`<script>/* ${BOOT_MARKER} */`);
  if (start < 0) return null;
  const codeStart = html.indexOf("\n", start) + 1;
  const end = html.indexOf("</script>", codeStart);
  if (end < 0) return null;
  return html.slice(codeStart, end);
}

function verifyPayloadSyntax(htmlPath) {
  const js = extractPayloadJs(htmlPath);
  if (!js) return { ok: false, reason: "payload block not found" };
  const tmp = path.join(os.tmpdir(), `chiikawa-payload-check-${Date.now()}.js`);
  try {
    fs.writeFileSync(tmp, js, "utf8");
    execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: String(e?.message || e).slice(0, 300) };
  } finally {
    try { fs.rmSync(tmp, { force: true }); } catch {}
  }
}

function injectRendererPayload(resourcesDir, skinCss, sounds) {
  const htmlPath = rendererIndex(resourcesDir);
  const backupPath = htmlPath + ".chiikawa-bak";
  if (!fs.existsSync(backupPath)) fs.copyFileSync(htmlPath, backupPath);
  let html = fs.readFileSync(htmlPath, "utf8");
  let injected = false;
  // drop legacy external script tags if present
  for (const tag of LEGACY_TAGS) {
    html = html.replace(tag + "\n", "").replace(tag, "");
  }
  // replace any existing inline payload block (upgrade path), else insert
  const existing = html.indexOf(`<script>/* ${BOOT_MARKER} */`);
  if (existing >= 0) {
    const end = html.indexOf("</script>", existing);
    if (end < 0) return { ok: false, reason: "existing payload block malformed" };
    html = html.slice(0, existing) + buildInlinePayload(skinCss, sounds) + html.slice(end + "</script>".length);
  } else {
    if (!html.includes("</head>")) return { ok: false, reason: "index.html 中未找到 </head>" };
    html = html.replace("</head>", buildInlinePayload(skinCss, sounds) + "\n</head>");
    injected = true;
  }
  fs.writeFileSync(htmlPath, html, "utf8");
  const check = verifyPayloadSyntax(htmlPath);
  if (!check.ok) {
    // roll back to backup on syntax failure
    fs.copyFileSync(backupPath, htmlPath);
    return { ok: false, reason: `payload 语法校验失败，已回滚: ${check.reason}` };
  }
  return { ok: true, injected, backup: backupPath };
}

function removeRendererPayload(resourcesDir) {
  const htmlPath = rendererIndex(resourcesDir);
  const backupPath = htmlPath + ".chiikawa-bak";
  try {
    if (fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, htmlPath);
    } else if (fs.existsSync(htmlPath)) {
      let html = fs.readFileSync(htmlPath, "utf8");
      for (const tag of LEGACY_TAGS) html = html.replace(tag + "\n", "").replace(tag, "");
      const start = html.indexOf(`<script>/* ${BOOT_MARKER} */`);
      if (start >= 0) {
        const end = html.indexOf("</script>", start);
        if (end >= 0) html = html.slice(0, start) + html.slice(end + "</script>".length);
      }
      fs.writeFileSync(htmlPath, html, "utf8");
    }
  } catch {
    return false;
  }
  // clean legacy external payload files from earlier versions
  const assetsDir = path.join(resourcesDir, "app.asar.unpacked", "renderer", "assets");
  for (const f of ["chiikawa-boot.js", "chiikawa-audio.js", ...SKIN_CSS_FILES, ...IMAGES, ...SOUNDS]) {
    try { fs.rmSync(path.join(assetsDir, f), { force: true }); } catch {}
  }
  return true;
}

// ---------- restore official slots previously seeded by v2 ----------
function isOurSeedCss(cssPath) {
  try {
    const head = fs.readFileSync(cssPath, "utf8").slice(0, 200);
    return LEGACY_SLOT_MARKERS.some((m) => head.startsWith(m)) || head.startsWith(MARKER);
  } catch {
    return false;
  }
}

function restoreHijackedSlots(appearanceRoot) {
  const restored = [];
  if (!fs.existsSync(appearanceRoot)) return restored;
  for (const dir of fs.readdirSync(appearanceRoot)) {
    // official slot dirs are theme-<key>-<updatedAt>; ours is theme-chiikawa-1792829518928
    if (dir === STANDALONE_DIR) continue;
    if (!/^theme-[a-z0-9._-]+-\d+$/.test(dir)) continue;
    const dirPath = path.join(appearanceRoot, dir);
    let cleaned = false;
    for (const cssName of ["skin.v2.css", "skin.css"]) {
      const cssPath = path.join(dirPath, cssName);
      if (fs.existsSync(cssPath) && isOurSeedCss(cssPath)) {
        fs.rmSync(cssPath, { force: true });
        cleaned = true;
      }
    }
    const legacyAssets = path.join(dirPath, THEME_ASSETS_DIRNAME);
    if (fs.existsSync(legacyAssets)) {
      fs.rmSync(legacyAssets, { recursive: true, force: true });
      cleaned = true;
    }
    if (cleaned) restored.push(dir);
  }
  return restored;
}

// ---------- main ----------
const configDir = findConfigDir();
if (!configDir) {
  console.error("未找到 WorkBuddy 配置目录（~/.workbuddy）。请确认 WorkBuddy 已安装并至少启动过一次。");
  process.exit(1);
}
const appearanceRoot = path.join(configDir, "appearance-resources");
fs.mkdirSync(appearanceRoot, { recursive: true });
const standalonePath = path.join(appearanceRoot, STANDALONE_DIR);
const assetsTarget = path.join(standalonePath, THEME_ASSETS_DIRNAME, "assets", "custom");

if (uninstall) {
  const resourcesDir = findResourcesDir();
  const restoredIndex = resourcesDir ? removeRendererPayload(resourcesDir) : false;
  console.log(restoredIndex ? "启动注入已还原（index.html）。" : "未找到安装目录或注入还原失败（可手动用 index.html.chiikawa-bak 覆盖回来）。");
  const restored = restoreHijackedSlots(appearanceRoot);
  if (restored.length) console.log("已恢复官方槽位: " + restored.join(", ") + "（下次使用时自动重新下载官方样式）。");
  if (fs.existsSync(standalonePath)) {
    fs.rmSync(standalonePath, { recursive: true, force: true });
    console.log("已移除独立皮肤目录:", standalonePath);
  }
  console.log("Chiikawa 皮肤已卸载（主题选择未被改动过，无需还原）。");
  process.exit(0);
}

// 1. deploy standalone theme dir (source of truth copy, css mirrors payload)
fs.mkdirSync(assetsTarget, { recursive: true });
const { css, n } = buildCss();
fs.writeFileSync(path.join(standalonePath, "skin.css"), MARKER + "\n" + css, "utf8");

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
for (const s of SOUNDS) {
  const src = path.join(THEME_DIR, "assets", s);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(assetsTarget, s));
    copied++;
  } else {
    console.warn("警告: 缺少音效素材", s);
  }
}

console.log(`平台: ${process.platform}${isWin ? "（已合并 Windows 专属覆盖 win.css）" : "（macOS 基础样式，顶栏贴纸保留）"}`);
console.log(`皮肤目录: ${standalonePath}`);
console.log(`已写入 skin.css（图片已内嵌 data URI ×${n}），复制素材 ${copied} 个。`);

// 2. renderer payload (persistent skin + sounds via index.html inline injection)
if (noInject) {
  console.log("已按 --no-inject 跳过启动注入（皮肤将不会被应用）。");
} else {
  const resourcesDir = findResourcesDir();
  if (!resourcesDir) {
    console.warn("未定位到 WorkBuddy 安装目录，跳过启动注入。");
    console.warn("→ 可设置环境变量 WORKBUDDY_RESOURCES_DIR 指向 WorkBuddy 的 resources 目录后重跑。");
  } else {
    const sounds = noAudio ? null : {
      success: readDataUri(path.join("assets", SOUNDS[0]), "audio/wav"),
      question: readDataUri(path.join("assets", SOUNDS[1]), "audio/wav"),
      failed: readDataUri(path.join("assets", SOUNDS[2]), "audio/wav"),
    };
    const r = injectRendererPayload(resourcesDir, css, sounds);
    if (r.ok) {
      const payloadLen = extractPayloadJs(rendererIndex(resourcesDir))?.length ?? 0;
      console.log(`启动注入: ${r.injected ? "已内联注入 index.html" : "已更新 index.html 中的注入"}（payload ${(payloadLen / 1024 / 1024).toFixed(2)} MB，备份: ${r.backup}，语法校验通过）。`);
      console.log("注意: WorkBuddy 自动更新会重置 index.html，注入消失后重跑本脚本即可恢复。");
    } else {
      console.warn("启动注入失败（" + r.reason + "）。");
      process.exitCode = 1;
    }
  }
}

// 3. restore any slot we hijacked in older versions
const restored = restoreHijackedSlots(appearanceRoot);
if (restored.length) {
  console.log("已恢复官方槽位（移除旧版种子）: " + restored.join(", "));
}

console.log("");
console.log("完成。重启 WorkBuddy 即生效；无需在设置里选择任何皮肤。");
console.log("开关（WorkBuddy 控制台）: __CHIIKAWA_SKIN__.setEnabled(false) / __CHIIKAWA_AUDIO__.setEnabled(false)");

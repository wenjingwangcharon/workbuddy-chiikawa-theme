#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const getArg = (name, fallback = "") => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const getArgs = (name) => args.flatMap((arg, index) => arg === name && args[index + 1] ? [args[index + 1]] : []);

const scriptDir = path.dirname(new URL(import.meta.url).pathname);
const repoDir = path.resolve(scriptDir, "..");
const source = path.resolve(getArg("--source", "/Applications/WorkBuddy.app/Contents/Resources/app.asar"));
const output = path.resolve(getArg("--output", path.join(repoDir, ".work", "app.qq2008.asar")));
const skin = path.resolve(getArg("--skin", path.join(repoDir, "theme", "qq2008-skin.css")));
const scripts = getArgs("--script").map((script) => path.resolve(script));
const extraAssets = getArgs("--asset").map((asset) => path.resolve(asset));
const work = path.resolve(getArg("--work", path.join(os.tmpdir(), `workbuddy-qq2008-${process.pid}`)));
const sourceUnpacked = `${source}.unpacked`;

if (source === output) {
  throw new Error("为避免损坏应用，--output 不能与 --source 相同。请先生成补丁副本，再单独安装。");
}
if (!fs.existsSync(source)) throw new Error(`找不到源文件：${source}`);
if (!fs.existsSync(skin)) throw new Error(`找不到皮肤文件：${skin}`);
for (const asset of [...scripts, ...extraAssets]) {
  if (!fs.existsSync(asset)) throw new Error(`找不到附加资源：${asset}`);
}

async function loadAsar() {
  const candidates = [
    path.join(repoDir, "node_modules", "@electron", "asar", "lib", "asar.js"),
    path.join(os.homedir(), ".workbuddy", "binaries", "node", "workspace", "node_modules", "@electron", "asar", "lib", "asar.js")
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return import(pathToFileURL(candidate).href);
  }
  throw new Error("未找到 @electron/asar。请在 WorkBuddy 隔离 Node 工作区安装后重试。");
}

function enumerate(header) {
  const entries = [];
  const walk = (node, dir, inheritedUnpacked = false) => {
    for (const [name, info] of Object.entries(node.files || {})) {
      const rel = dir ? path.join(dir, name) : name;
      const unpacked = Boolean(info.unpacked) || inheritedUnpacked;
      if (info.files) {
        entries.push({ rel, type: "directory", unpacked });
        walk(info, rel, unpacked);
      } else if (info.link != null) {
        entries.push({ rel, type: "link", unpacked, link: info.link });
      } else {
        entries.push({ rel, type: "file", unpacked, executable: Boolean(info.executable) });
      }
    }
  };
  walk(header, "");
  return entries;
}

function patchHtml(html) {
  const tags = [];
  const skinMarker = path.basename(skin);
  if (!html.includes(skinMarker)) tags.push(`  <link rel="stylesheet" href="./assets/${skinMarker}">`);
  for (const script of scripts) {
    const marker = path.basename(script);
    if (!html.includes(marker)) tags.push(`  <script defer src="./assets/${marker}"></script>`);
  }
  if (tags.length === 0) return html;
  if (!html.includes("</head>")) throw new Error("renderer/index.html 中未找到 </head>");
  return html.replace("</head>", `${tags.join("\n")}\n</head>`);
}

const asar = await loadAsar();
if (fs.existsSync(work)) throw new Error(`临时目录已存在，请改用新的 --work 路径：${work}`);
if (fs.existsSync(output) || fs.existsSync(`${output}.unpacked`)) {
  throw new Error(`输出路径已存在，请改用新的 --output 路径：${output}`);
}
fs.mkdirSync(work, { recursive: true });
fs.mkdirSync(path.dirname(output), { recursive: true });

const header = asar.getRawHeader(source).header;
const entries = enumerate(header);
let skippedMissing = 0;

for (const entry of entries) {
  const destination = path.join(work, entry.rel);
  if (entry.type === "directory") {
    fs.mkdirSync(destination, { recursive: true });
    continue;
  }
  if (entry.type === "link") {
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    try { fs.symlinkSync(entry.link, destination); } catch {}
    continue;
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  if (entry.unpacked) {
    const external = path.join(sourceUnpacked, entry.rel);
    if (!fs.existsSync(external)) {
      skippedMissing += 1;
      continue;
    }
    fs.copyFileSync(external, destination);
  } else {
    fs.writeFileSync(destination, asar.extractFile(source, entry.rel));
  }
}

const htmlEntry = entries.find((entry) => entry.type === "file" && /(^|[/\\])renderer[/\\]index\.html$/.test(entry.rel));
if (!htmlEntry) throw new Error("未找到 renderer/index.html，当前版本结构可能已变化。");
const htmlPath = path.join(work, htmlEntry.rel);
fs.writeFileSync(htmlPath, patchHtml(fs.readFileSync(htmlPath, "utf8")));

const injectedAssets = [skin, ...scripts, ...extraAssets];
const injectedAssetRels = [];
for (const injectedAsset of injectedAssets) {
  const assetRel = path.join(path.dirname(htmlEntry.rel), "assets", path.basename(injectedAsset));
  const assetPath = path.join(work, assetRel);
  fs.mkdirSync(path.dirname(assetPath), { recursive: true });
  fs.copyFileSync(injectedAsset, assetPath);
  injectedAssetRels.push(assetRel);
  if (!entries.some((entry) => entry.rel === assetRel)) {
    entries.push({ rel: assetRel, type: "file", unpacked: false, executable: false });
  }
}

const streams = [];
for (const entry of entries) {
  if (entry.type === "directory") {
    streams.push({ path: entry.rel, type: "directory", unpacked: entry.unpacked });
    continue;
  }
  if (entry.type === "link") {
    streams.push({ path: entry.rel, type: "link", unpacked: entry.unpacked, symlink: entry.link, stat: { mode: 0 } });
    continue;
  }
  const file = path.join(work, entry.rel);
  if (!fs.existsSync(file)) continue;
  const stat = fs.statSync(file);
  streams.push({
    path: entry.rel,
    type: "file",
    unpacked: entry.unpacked,
    stat: { mode: stat.mode, size: stat.size },
    streamGenerator: () => fs.createReadStream(file)
  });
}

await asar.createPackageFromStreams(output, streams);

const listed = asar.listPackage(output).map((item) => item.replaceAll("\\", "/"));
for (const assetRel of injectedAssetRels) {
  const normalizedAssetRel = `/${assetRel.replaceAll("\\", "/")}`;
  if (!listed.includes(normalizedAssetRel)) throw new Error(`校验失败：补丁包中缺少 ${path.basename(assetRel)}`);
}
const patchedHtml = asar.extractFile(output, htmlEntry.rel).toString("utf8");
if (!patchedHtml.includes("qq2008-skin.css")) throw new Error("校验失败：HTML 未注入皮肤链接");
for (const script of scripts) {
  if (!patchedHtml.includes(path.basename(script))) throw new Error(`校验失败：HTML 未注入脚本 ${path.basename(script)}`);
}

console.log(JSON.stringify({
  source,
  output,
  html: htmlEntry.rel,
  entries: entries.length,
  skippedMissing,
  skinInjected: true,
  scriptsInjected: scripts.map((script) => path.basename(script)),
  assetsInjected: injectedAssetRels.map((assetRel) => path.basename(assetRel)),
  outputBytes: fs.statSync(output).size
}, null, 2));

try {
  fs.rmSync(work, { recursive: true, force: true });
} catch {
  console.warn(`补丁已验证，但安全删除策略阻止清理临时目录：${work}`);
}

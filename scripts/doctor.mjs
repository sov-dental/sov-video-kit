// 檢查這台電腦能不能跑整套流程
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ensureBrowser } from "@remotion/renderer";
import { FFMPEG, FFPROBE, KIT_DIR, MODELS_DIR, config, run, whisperExe } from "./lib.mjs";

let bad = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const no = (m, fix) => {
  bad++;
  console.log(`  ✗ ${m}\n      → ${fix}`);
};

console.log(`\n環境檢查（${os.platform()} ${os.arch()}）\n`);

const [maj, min] = process.versions.node.split(".").map(Number);
if (maj > 22 || (maj === 22 && min >= 13) || (maj === 20 && min >= 19)) ok(`Node ${process.versions.node}`);
else no(`Node ${process.versions.node} 太舊`, "安裝 Node 22 LTS 以上：https://nodejs.org");

for (const [label, bin] of [
  ["ffmpeg", FFMPEG],
  ["ffprobe", FFPROBE],
]) {
  const r = bin && fs.existsSync(bin) ? await run(bin, ["-version"]).catch(() => ({ code: 1 })) : { code: 1 };
  if (r.code === 0) ok(`${label}（隨套件附帶）`);
  else no(`${label} 無法執行`, "刪掉 node_modules 後重新 npm install");
}

const { exe } = whisperExe();
if (exe) {
  const r = await run(exe, ["--help"]).catch(() => ({ code: 1 }));
  if (r.code === 0) ok(`whisper.cpp ${config.whisper.version}`);
  else no("whisper.cpp 無法執行", os.platform() === "win32" ? "安裝 Microsoft Visual C++ 可轉散發套件（x64）後再試" : "刪掉 .cache/whisper.cpp 後重跑 npm run setup");
} else no("還沒安裝 whisper.cpp", os.platform() === "darwin" ? "brew install whisper.cpp 後再跑 npm run setup" : "npm run setup");

const modelPath = path.join(MODELS_DIR, `ggml-${config.whisper.model}.bin`);
const size = fs.existsSync(modelPath) ? fs.statSync(modelPath).size : 0;
if (size > 1_000_000_000) ok(`語音模型 ${config.whisper.model}（${(size / 1e9).toFixed(1)} GB）`);
else no(size ? "語音模型不完整（下載中斷）" : "還沒下載語音模型", "刪掉 .cache/models 裡的檔案後重跑 npm run setup");

if (fs.existsSync(path.join(KIT_DIR, "src", "assets", "NotoSansTC.ttf"))) ok("中文字型");
else no("缺少字型檔 src/assets/NotoSansTC.ttf", "重新複製整個工具包資料夾");

const skill = path.join(os.homedir(), ".claude", "skills", "sov-video-edit", "SKILL.md");
if (!fs.existsSync(skill)) no("Claude Code skill 沒安裝", "npm run setup -- --skill-only");
else if (!fs.readFileSync(skill, "utf8").includes(KIT_DIR.replaceAll("\\", "/")))
  no("Claude Code skill 指向別的資料夾（工具包搬過家）", "npm run setup -- --skill-only");
else ok("Claude Code skill");

try {
  await ensureBrowser();
  ok("渲染用瀏覽器（Chrome Headless Shell）");
} catch (e) {
  no("渲染用瀏覽器下載失敗", `確認網路後再跑一次（${e.message}）`);
}

console.log(bad ? `\n有 ${bad} 項要處理。\n` : "\n全部正常，可以開始：npm run prep -- <影片路徑>\n");
process.exit(bad ? 1 : 0);

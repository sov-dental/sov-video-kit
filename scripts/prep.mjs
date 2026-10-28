// 第一步：剪掉空白 → 轉成中文字幕草稿
// 用法：npm run prep -- <影片路徑> [--name 名稱] [--no-cut] [--threshold -35] [--min-silence 0.45] [--theme sov] [--force]
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { transcribe } from "@remotion/install-whisper-cpp";
import * as OpenCC from "opencc-js";
import {
  FFMPEG,
  FFPROBE,
  JOBS_DIR,
  KIT_DIR,
  MODELS_DIR,
  WHISPER_DIR,
  config,
  fail,
  fmtTime,
  log,
  parseArgs,
  run,
  runOk,
  whisperExe,
  writeJson,
} from "./lib.mjs";

const { positional, flags } = parseArgs(process.argv.slice(2));
const input = positional[0] && path.resolve(positional[0]);
if (!input || !fs.existsSync(input)) fail(`找不到影片：${positional[0] ?? "（沒給路徑）"}\n用法：npm run prep -- <影片路徑>`);

const fps = config.video.fps;
const S = { ...config.silence };
if (flags.threshold) S.threshold = Number(flags.threshold);
if (flags["min-silence"]) S.minSilence = Number(flags["min-silence"]);

// ---------- job 資料夾 ----------
const baseName =
  (flags.name && String(flags.name)) ||
  path
    .basename(input, path.extname(input))
    .replace(/[\\/:*?"<>|\s]+/g, "-")
    .replace(/^-+|-+$/g, "") ||
  "job";
let name = baseName;
if (!flags.force) for (let i = 2; fs.existsSync(path.join(JOBS_DIR, name)); i++) name = `${baseName}-${i}`;
const jobDir = path.join(JOBS_DIR, name);
fs.mkdirSync(jobDir, { recursive: true });
const P = (f) => path.join(jobDir, f);

// ---------- 讀影片資訊 ----------
const probe = async (file) => {
  const { stdout } = await runOk(FFPROBE, ["-v", "error", "-show_streams", "-show_format", "-of", "json", file]);
  const j = JSON.parse(stdout);
  const v = j.streams.find((s) => s.codec_type === "video");
  const a = j.streams.find((s) => s.codec_type === "audio");
  let rot = 0;
  if (v) {
    rot = Number(v.tags?.rotate ?? v.side_data_list?.find((d) => d.rotation !== undefined)?.rotation ?? 0);
  }
  const swap = Math.abs(rot) % 180 === 90;
  return {
    duration: Number(j.format.duration),
    hasAudio: Boolean(a),
    width: v ? (swap ? v.height : v.width) : 0,
    height: v ? (swap ? v.width : v.height) : 0,
  };
};

const src = await probe(input);
if (!src.width) fail("這個檔案沒有影像軌");
if (!src.hasAudio) fail("這個檔案沒有聲音軌，無法剪空白與上字幕");
log(`來源：${path.basename(input)}｜${src.width}×${src.height}｜${fmtTime(src.duration)}`);

// ---------- 偵測空白 ----------
const detectSpeech = async () => {
  let threshold = S.threshold;
  if (threshold === "auto") {
    const { stderr } = await run(FFMPEG, ["-hide_banner", "-i", input, "-vn", "-af", "volumedetect", "-f", "null", "-"]);
    const mean = Number(/mean_volume:\s*(-?[\d.]+)/.exec(stderr)?.[1] ?? -25);
    threshold = Math.round(Math.min(-28, Math.max(-50, mean - 12)));
    log(`平均音量 ${mean} dB → 靜音門檻 ${threshold} dB`);
  }
  const { stderr } = await run(FFMPEG, [
    "-hide_banner",
    "-i",
    input,
    "-vn",
    "-af",
    `silencedetect=noise=${threshold}dB:d=${S.minSilence}`,
    "-f",
    "null",
    "-",
  ]);
  const silences = [];
  let cur = null;
  for (const line of stderr.split(/\r?\n/)) {
    const s = /silence_start:\s*(-?[\d.]+)/.exec(line);
    const e = /silence_end:\s*(-?[\d.]+)/.exec(line);
    if (s) cur = Math.max(0, Number(s[1]));
    if (e && cur !== null) {
      silences.push([cur, Number(e[1])]);
      cur = null;
    }
  }
  if (cur !== null) silences.push([cur, src.duration]);

  // 取補集 = 有聲音的段落，前後留一點緩衝
  let speech = [];
  let t = 0;
  for (const [a, b] of silences) {
    if (a > t) speech.push([t, a]);
    t = b;
  }
  if (t < src.duration) speech.push([t, src.duration]);
  speech = speech
    .map(([a, b]) => [Math.max(0, a - S.padBefore), Math.min(src.duration, b + S.padAfter)])
    .filter(([a, b]) => b - a >= S.minKeep);

  // 對齊到影格，合併重疊
  const frames = [];
  for (const [a, b] of speech) {
    const fa = Math.floor(a * fps);
    const fb = Math.ceil(b * fps);
    const last = frames[frames.length - 1];
    if (last && fa <= last[1]) last[1] = Math.max(last[1], fb);
    else frames.push([fa, fb]);
  }
  return { threshold, frames };
};

let frames;
let threshold = null;
if (flags["no-cut"]) {
  frames = [[0, Math.floor(src.duration * fps)]];
} else {
  ({ frames, threshold } = await detectSpeech());
  if (!frames.length) fail("整段都被判定為靜音。試試 --threshold -45 或 --no-cut");
}
const keptFrames = frames.reduce((s, [a, b]) => s + (b - a), 0);
log(
  flags["no-cut"]
    ? "不剪空白（--no-cut）"
    : `剪掉 ${frames.length - 1} 處空白：${fmtTime(src.duration)} → ${fmtTime(keptFrames / fps)}（少了 ${Math.round((1 - keptFrames / fps / src.duration) * 100)}%）`,
);

// ---------- 輸出剪好的影片 ----------
// 影像先轉成固定 fps，聲音切成每格 1/fps 秒的小塊，兩邊用同一個「第 n 格」挑選，剪幾百刀也不會音畫不同步
const SR = 48000;
const spf = SR / fps;
const expr = frames.map(([a, b]) => `between(n\\,${a}\\,${b - 1})`).join("+");
const shortSide = Math.min(src.width, src.height);
const scale =
  shortSide > 1080 ? (src.width <= src.height ? ",scale=1080:-2:flags=lanczos" : ",scale=-2:1080:flags=lanczos") : "";
const graph =
  `[0:v]fps=${fps},select='${expr}',setpts=N/${fps}/TB${scale},format=yuv420p[v];` +
  `[0:a]aresample=${SR},asetnsamples=n=${spf}:p=1,aselect='${expr}',asetpts=N/SR/TB[a]`;
fs.writeFileSync(P("cut.filter.txt"), graph, "utf8");

log("輸出剪輯後影片…");
await runOk(FFMPEG, [
  "-hide_banner",
  "-y",
  "-i",
  input,
  "-filter_complex_script",
  P("cut.filter.txt"),
  "-map",
  "[v]",
  "-map",
  "[a]",
  "-c:v",
  "libx264",
  "-preset",
  "veryfast",
  "-crf",
  String(config.video.crf),
  "-c:a",
  "aac",
  "-b:a",
  "192k",
  "-movflags",
  "+faststart",
  P("cut.mp4"),
]);
const cut = await probe(P("cut.mp4"));

// ---------- 語音轉文字 ----------
const { exe } = whisperExe();
if (!exe) fail("還沒安裝 whisper.cpp，先跑：npm run setup");
await runOk(FFMPEG, ["-hide_banner", "-y", "-i", P("cut.mp4"), "-vn", "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", P("audio16k.wav")]);

const glossary = fs.readFileSync(path.join(KIT_DIR, "config", "glossary.md"), "utf8");
const prompt = /```prompt\s*([\s\S]*?)```/.exec(glossary)?.[1].trim() ?? "";

log(`語音辨識中（${config.whisper.model}）…這一步最久，大約是影片長度的 1–2 倍`);
let lastPct = -1;
const result = await transcribe({
  inputPath: P("audio16k.wav"),
  whisperPath: WHISPER_DIR,
  whisperCppVersion: config.whisper.version,
  model: config.whisper.model,
  modelFolder: MODELS_DIR,
  tokenLevelTimestamps: false,
  tokensPerItem: 0, // 套件預設 1 會變成一個 token 一段，中文還會切出破碼
  language: config.whisper.language,
  printOutput: false,
  onProgress: (p) => {
    const pct = Math.floor(p * 100);
    if (pct >= lastPct + 10) {
      lastPct = pct;
      process.stdout.write(`\r  ${pct}%`);
    }
  },
  additionalArgs: [
    ...(prompt ? [["--prompt", prompt]] : []),
    // whisper-cli 預設只用 4 核；0 = 自動（保留 2 核給系統，最多 12）
    ["--threads", String(config.whisper.threads || Math.min(12, Math.max(4, os.cpus().length - 2)))],
  ],
});
process.stdout.write("\r  100%\n");
fs.rmSync(P("audio16k.wav"), { force: true });
writeJson(P("transcript.raw.json"), result.transcription);

// ---------- 整理成字幕行 ----------
const toTW = OpenCC.Converter({ from: "cn", to: "tw" });
const vertical = cut.height > cut.width;
const maxChars = vertical ? config.subtitles.maxCharsVertical : config.subtitles.maxCharsHorizontal;
const visLen = (s) => [...s.replace(/[，。、！？,.!?\s]/g, "")].reduce((n, ch) => n + (/[\x00-\x7f]/.test(ch) ? 0.5 : 1), 0);

/** 一段太長就切開：先找標點，再硬切；時間依字數比例分配 */
const splitText = (text) => {
  const parts = text
    .split(/(?<=[，。！？、；,!?;])/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out = [];
  let buf = "";
  for (const p of parts) {
    if (visLen(buf + p) <= maxChars) buf += p;
    else {
      if (buf) out.push(buf);
      if (visLen(p) <= maxChars) buf = p;
      else {
        const chars = [...p];
        const n = Math.ceil(visLen(p) / maxChars);
        const size = Math.ceil(chars.length / n);
        for (let i = 0; i < chars.length; i += size) out.push(chars.slice(i, i + size).join(""));
        buf = "";
      }
    }
  }
  if (buf) out.push(buf);
  return out;
};

const lines = [];
for (const seg of result.transcription) {
  const text = toTW(seg.text.trim())
    .replace(/,\s*/g, "，")
    .replace(/\?/g, "？")
    .replace(/!/g, "！");
  if (!text || /^[\[(（].*[\])）]$/.test(text)) continue; // 跳過 [音樂] 之類
  const start = seg.offsets.from / 1000;
  const end = seg.offsets.to / 1000;
  const chunks = splitText(text);
  const total = chunks.reduce((n, c) => n + Math.max(1, visLen(c)), 0);
  let t = start;
  for (const c of chunks) {
    const d = ((end - start) * Math.max(1, visLen(c))) / total;
    lines.push({ start: +t.toFixed(2), end: +(t + d).toFixed(2), zh: c, en: "" });
    t += d;
  }
}

const durationInFrames = Math.round(cut.duration * fps);
writeJson(P("job.json"), {
  name,
  source: input,
  createdAt: new Date().toISOString(),
  fps,
  width: cut.width,
  height: cut.height,
  durationInFrames,
  orientation: vertical ? "vertical" : cut.width === cut.height ? "square" : "horizontal",
  theme: flags.theme ? String(flags.theme) : config.theme,
  showEnglish: true,
  cut: {
    originalSeconds: +src.duration.toFixed(2),
    keptSeconds: +cut.duration.toFixed(2),
    cuts: frames.length - 1,
    thresholdDb: threshold,
  },
  status: "prepped",
});
writeJson(P("subtitles.json"), { lines });
if (!fs.existsSync(P("cards.json"))) writeJson(P("cards.json"), { cards: [] });
fs.mkdirSync(P("assets"), { recursive: true }); // 圖片卡的透明 PNG 放這裡
fs.writeFileSync(
  P("transcript.txt"),
  lines.map((l, i) => `${String(i).padStart(3, "0")}  ${fmtTime(l.start)}–${fmtTime(l.end)}  ${l.zh}`).join("\n") + "\n",
  "utf8",
);

log(`完成：${lines.length} 行字幕草稿`);
console.log(`
job：${name}
資料夾：${jobDir}

下一步（在 Claude Code 裡說「幫我處理影片 ${name}」即可自動完成）：
  1. 校對 subtitles.json 的中文、補上英文
  2. 在 cards.json 規劃圖卡
  3. npm run studio -- ${name}   預覽
  4. npm run render -- ${name}   輸出
`);

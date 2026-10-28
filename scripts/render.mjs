// 輸出成品影片＋雙語 SRT
// 用法：npm run render -- [job 名稱] [--draft]（--draft 半解析度、快速檢查用）
import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { KIT_DIR, fail, log, parseArgs, readJson, resolveJob, writeJson } from "./lib.mjs";

const { positional, flags } = parseArgs(process.argv.slice(2));
const jobDir = resolveJob(positional[0]);
const job = readJson(path.join(jobDir, "job.json"));
const draft = Boolean(flags.draft);

const srtTime = (s) => {
  const ms = Math.round(s * 1000);
  const h = String(Math.floor(ms / 3600000)).padStart(2, "0");
  const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, "0");
  const sec = String(Math.floor((ms % 60000) / 1000)).padStart(2, "0");
  return `${h}:${m}:${sec},${String(ms % 1000).padStart(3, "0")}`;
};

const writeSrt = (outBase) => {
  const { lines } = readJson(path.join(jobDir, "subtitles.json"));
  const clean = (s) => s.replace(/\*\*/g, "");
  const srt = lines
    .map((l, i) => `${i + 1}\n${srtTime(l.start)} --> ${srtTime(l.end)}\n${clean(l.zh)}${l.en ? `\n${clean(l.en)}` : ""}\n`)
    .join("\n");
  fs.writeFileSync(`${outBase}.srt`, srt, "utf8");
};

try {
  const outDir = path.join(jobDir, "output");
  fs.mkdirSync(outDir, { recursive: true });
  const outBase = path.join(outDir, draft ? `${job.name}-draft` : job.name);

  log("打包畫面程式…");
  const serveUrl = await bundle({
    entryPoint: path.join(KIT_DIR, "src", "index.ts"),
    publicDir: jobDir,
  });
  const composition = await selectComposition({ serveUrl, id: "Edit", inputProps: {} });

  log(`輸出 ${draft ? "草稿（半解析度）" : "成品"}：${composition.width}×${composition.height}，${(composition.durationInFrames / composition.fps).toFixed(1)} 秒`);
  let last = -1;
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation: `${outBase}.mp4`,
    inputProps: {},
    scale: draft ? 0.5 : 1,
    crf: draft ? 28 : 18,
    onProgress: ({ progress }) => {
      const pct = Math.floor(progress * 100);
      if (pct >= last + 5) {
        last = pct;
        process.stdout.write(`\r  ${pct}%`);
      }
    },
  });
  process.stdout.write("\n");
  writeSrt(outBase);
  if (!draft) writeJson(path.join(jobDir, "job.json"), { ...job, status: "rendered", renderedAt: new Date().toISOString() });
  log(`完成：\n  ${outBase}.mp4\n  ${outBase}.srt`);
} catch (e) {
  fail(e.stack ?? e.message);
}

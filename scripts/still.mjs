// 截幾張畫面檢查字幕與圖卡位置（給 Claude 看圖用）
// 用法：npm run still -- [job 名稱] [秒數 秒數 …]  （不給秒數就截每張圖卡出現後 1 秒）
import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { KIT_DIR, fail, log, readJson, resolveJob } from "./lib.mjs";

const args = process.argv.slice(2);
const isNum = (s) => /^\d+(\.\d+)?$/.test(s);
const jobArg = args.find((a) => !isNum(a));
const jobDir = resolveJob(jobArg);
let times = args.filter(isNum).map(Number);

if (!times.length) {
  const { cards } = readJson(path.join(jobDir, "cards.json"));
  times = cards.map((c) => c.at + 1);
  if (!times.length) {
    const { lines } = readJson(path.join(jobDir, "subtitles.json"));
    times = lines.filter((_, i) => i % Math.max(1, Math.floor(lines.length / 4)) === 0).map((l) => (l.start + l.end) / 2);
  }
}

try {
  const outDir = path.join(jobDir, "stills");
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const serveUrl = await bundle({ entryPoint: path.join(KIT_DIR, "src", "index.ts"), publicDir: jobDir });
  const composition = await selectComposition({ serveUrl, id: "Edit", inputProps: {} });
  for (const t of times) {
    const frame = Math.min(composition.durationInFrames - 1, Math.round(t * composition.fps));
    const out = path.join(outDir, `t${t.toFixed(1).padStart(6, "0")}.png`);
    await renderStill({ composition, serveUrl, frame, output: out, inputProps: {}, scale: 0.5 });
    log(out);
  }
} catch (e) {
  fail(e.stack ?? e.message);
}

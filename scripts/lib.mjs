// 共用設定與工具：路徑、ffmpeg/ffprobe/whisper 位置、執行子程序
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export const KIT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const JOBS_DIR = path.join(KIT_DIR, "jobs");
export const CACHE_DIR = path.join(KIT_DIR, ".cache");
export const WHISPER_DIR = path.join(CACHE_DIR, "whisper.cpp");
export const MODELS_DIR = path.join(CACHE_DIR, "models");

export const config = JSON.parse(fs.readFileSync(path.join(KIT_DIR, "config", "settings.json"), "utf8"));

export const FFMPEG = require("ffmpeg-static");
export const FFPROBE = require("ffprobe-static").path;

export const log = (...a) => console.log("›", ...a);
export const fail = (msg) => {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
};

/** 執行外部程式，回傳 { code, stdout, stderr }；不經過 shell，路徑有空格或中文都安全 */
export const run = (bin, args, { quiet = true, cwd } = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd, windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => {
      stdout += d;
      if (!quiet) process.stdout.write(d);
    });
    child.stderr.on("data", (d) => {
      stderr += d;
      if (!quiet) process.stderr.write(d);
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });

export const runOk = async (bin, args, opts) => {
  const r = await run(bin, args, opts);
  if (r.code !== 0) {
    throw new Error(`${path.basename(bin)} 失敗（exit ${r.code}）\n${r.stderr.slice(-2000)}`);
  }
  return r;
};

/** 讀 --key value / --flag 形式的參數 */
export const parseArgs = (argv) => {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) flags[key] = true;
      else {
        flags[key] = next;
        i++;
      }
    } else positional.push(a);
  }
  return { positional, flags };
};

/** 由 job 名稱或路徑找到 job 資料夾 */
export const resolveJob = (nameOrPath) => {
  if (!nameOrPath) {
    const jobs = fs.existsSync(JOBS_DIR)
      ? fs
          .readdirSync(JOBS_DIR)
          .filter((d) => fs.existsSync(path.join(JOBS_DIR, d, "job.json")))
          .map((d) => ({ d, t: fs.statSync(path.join(JOBS_DIR, d, "job.json")).mtimeMs }))
          .sort((a, b) => b.t - a.t)
      : [];
    if (!jobs.length) fail("還沒有任何 job，先跑：npm run prep -- <影片路徑>");
    return path.join(JOBS_DIR, jobs[0].d);
  }
  const direct = path.resolve(nameOrPath);
  if (fs.existsSync(path.join(direct, "job.json"))) return direct;
  const inJobs = path.join(JOBS_DIR, nameOrPath);
  if (fs.existsSync(path.join(inJobs, "job.json"))) return inJobs;
  fail(`找不到 job：${nameOrPath}（jobs 資料夾裡沒有這個名稱）`);
};

export const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
export const writeJson = (p, data) => fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n", "utf8");

export const whisperExe = () => {
  const v = config.whisper.version;
  const name = os.platform() === "win32" ? "whisper-cli.exe" : "whisper-cli";
  // 轉錄函式（@remotion/install-whisper-cpp）固定找 build/bin/whisper-cli
  const candidates = [path.join(WHISPER_DIR, "build", "bin", name)];
  return { version: v, exe: candidates.find((c) => fs.existsSync(c)) ?? null, candidates };
};

/** Remotion CLI 的 JS 進入點（避開 Windows 的 .cmd 與引號問題） */
export const remotionCli = () => path.join(path.dirname(require.resolve("@remotion/cli/package.json")), "remotion-cli.js");

export const fmtTime = (s) => {
  const m = Math.floor(s / 60);
  const r = (s - m * 60).toFixed(1).padStart(4, "0");
  return `${m}:${r}`;
};

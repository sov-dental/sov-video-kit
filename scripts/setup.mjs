// 一次性安裝：whisper.cpp、語音模型、Claude Code skill
// 用法：npm run setup            （全部）
//       npm run setup -- --skill-only
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { installWhisperCpp, downloadWhisperModel } from "@remotion/install-whisper-cpp";
import { CACHE_DIR, KIT_DIR, MODELS_DIR, WHISPER_DIR, config, fail, log, parseArgs, run, whisperExe } from "./lib.mjs";

const { flags } = parseArgs(process.argv.slice(2));

const installSkill = () => {
  const src = path.join(KIT_DIR, "skill", "SKILL.md");
  const destDir = path.join(os.homedir(), ".claude", "skills", "sov-video-edit");
  fs.mkdirSync(destDir, { recursive: true });
  // 把這台電腦上的 kit 路徑寫進 skill，Claude 才知道去哪裡跑指令
  const body = fs.readFileSync(src, "utf8").replaceAll("{{KIT_DIR}}", KIT_DIR.replaceAll("\\", "/"));
  fs.writeFileSync(path.join(destDir, "SKILL.md"), body, "utf8");
  log(`Claude Code skill 已安裝：${destDir}`);
};

const installWhisper = async () => {
  if (whisperExe().exe) {
    log("whisper.cpp 已存在，略過");
    return;
  }
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  if (os.platform() !== "win32") {
    // macOS / Linux 需要從原始碼編譯
    for (const [bin, hint] of [
      ["git", "請先安裝 git"],
      ["cmake", os.platform() === "darwin" ? "請先執行：xcode-select --install，再 brew install cmake" : "請先安裝 cmake 與 build-essential"],
    ]) {
      const r = await run(bin, ["--version"]).catch(() => ({ code: 1 }));
      if (r.code !== 0) fail(`找不到 ${bin}。${hint}`);
    }
  }
  if (fs.existsSync(WHISPER_DIR)) fs.rmSync(WHISPER_DIR, { recursive: true, force: true });
  log(`安裝 whisper.cpp ${config.whisper.version}…`);
  const prevCwd = process.cwd();
  process.chdir(CACHE_DIR); // 套件會把 zip 暫存在 cwd
  try {
    await installWhisperCpp({ version: config.whisper.version, to: WHISPER_DIR, printOutput: true });
  } catch (e) {
    // Windows 新版 zip 的資料夾結構跟套件預期不同，套件會報「找不到執行檔」但檔案其實已解壓
    if (!whisperExe().exe) throw e;
  } finally {
    process.chdir(prevCwd);
  }
  // Windows 的 zip 解出來是 Release\，但轉錄函式找 build\bin\，搬過去
  const rel = path.join(WHISPER_DIR, "Release");
  const bin = path.join(WHISPER_DIR, "build", "bin");
  if (fs.existsSync(path.join(rel, "whisper-cli.exe")) && !fs.existsSync(bin)) {
    fs.mkdirSync(path.dirname(bin), { recursive: true });
    fs.renameSync(rel, bin);
  }
  const { exe, candidates } = whisperExe();
  if (!exe) fail(`whisper.cpp 安裝後找不到執行檔，預期在：\n  ${candidates.join("\n  ")}`);
  log(`whisper.cpp OK：${exe}`);
};

const installModel = async () => {
  fs.mkdirSync(MODELS_DIR, { recursive: true });
  log(`下載語音模型 ${config.whisper.model}（約 1.6GB，只需一次）…`);
  let last = -1;
  const { alreadyExisted } = await downloadWhisperModel({
    model: config.whisper.model,
    folder: MODELS_DIR,
    printOutput: false,
    onProgress: (downloaded, total) => {
      const pct = Math.floor((downloaded / total) * 100);
      if (pct !== last && pct % 5 === 0) {
        last = pct;
        process.stdout.write(`\r  ${pct}%`);
      }
    },
  });
  process.stdout.write("\n");
  log(alreadyExisted ? "模型已存在，略過" : "模型下載完成");
};

try {
  installSkill();
  if (!flags["skill-only"]) {
    await installWhisper();
    await installModel();
  }
  log("安裝完成。檢查環境：npm run doctor");
} catch (e) {
  fail(e.message);
}

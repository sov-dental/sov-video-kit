// 更新到最新版：拉程式 → 補套件 → 更新 Whisper／模型／skill（已有的會略過）→ 環境檢查
// 用法：npm run update
import { spawnSync } from "node:child_process";
import os from "node:os";
import { KIT_DIR, fail, log } from "./lib.mjs";

const step = (label, cmd, args) => {
  log(label);
  const r = spawnSync(cmd, args, { cwd: KIT_DIR, stdio: "inherit", shell: os.platform() === "win32" && cmd === "npm" });
  if (r.status !== 0) fail(`${label}失敗`);
};

step("拉最新版", "git", ["pull", "--ff-only"]);
step("補安裝套件", "npm", ["install", "--no-audit", "--no-fund"]);
step("更新 Whisper、模型與 skill", process.execPath, ["scripts/setup.mjs"]);
step("環境檢查", process.execPath, ["scripts/doctor.mjs"]);

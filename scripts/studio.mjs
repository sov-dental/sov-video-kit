// 開預覽（Remotion Studio）
// 用法：npm run studio -- [job 名稱]
import path from "node:path";
import { spawn } from "node:child_process";
import { KIT_DIR, parseArgs, remotionCli, resolveJob } from "./lib.mjs";

const { positional } = parseArgs(process.argv.slice(2));
const jobDir = resolveJob(positional[0]);
console.log(`› 預覽 ${path.basename(jobDir)}（改了 subtitles.json / cards.json 後，在瀏覽器按重新整理）`);
spawn(process.execPath, [remotionCli(), "studio", "src/index.ts", "--public-dir", jobDir], {
  cwd: KIT_DIR,
  stdio: "inherit",
}).on("close", (code) => process.exit(code ?? 0));

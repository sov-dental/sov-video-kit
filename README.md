# SOV 影片自動剪輯工具包

丟一支口播影片進來，自動完成：

1. **剪掉空白**（講話中間的停頓）
2. **中英雙語字幕**（本機語音辨識＋Claude 校對與翻譯）
3. **動態圖卡**（開場標題、重點、數字、術語解釋、結尾邀約）

輸出 MP4 和雙語 SRT。配色有 SOV、日不落兩組。

## 需要什麼

| | Windows | Mac |
|---|---|---|
| Node.js 22 LTS 以上 | [nodejs.org](https://nodejs.org) | 同左 |
| Claude Code | 桌面 App 或 CLI | 同左 |
| 編譯工具 | 不用 | `xcode-select --install`，再 `brew install cmake` |
| 硬碟空間 | 約 3GB（語音模型 1.6GB） | 同左 |

不需要另外安裝 ffmpeg、Whisper、字型，都由工具包自己帶或自己下載。

## 第一次安裝（每台電腦做一次）

把整個資料夾放到這台電腦上（位置隨意），在資料夾裡開終端機：

```bash
npm install
```

```bash
npm run setup
```

```bash
npm run doctor
```

`setup` 會下載 Whisper 和語音模型（5–20 分鐘），並把 Claude Code 的 skill 裝到 `~/.claude/skills/sov-video-edit`。`doctor` 全部打勾就完成了。

> 工具包搬到別的位置後，要再跑一次 `npm run setup -- --skill-only`，skill 才會指到新位置。

## 怎麼用

**最簡單**：在 Claude Code 裡說「幫我剪這支影片：`D:\影片\衛教01.mp4`」。Claude 會自動跑完全部步驟，最後給你成品路徑。

**手動**：

| 指令 | 做什麼 |
|---|---|
| `npm run prep -- "影片路徑" --name ep01` | 剪空白＋語音辨識，產生字幕草稿 |
| （編輯 `jobs/ep01/subtitles.json`、`cards.json`） | 校字、翻譯、規劃圖卡（Claude 做） |
| `npm run still -- ep01` | 截圖檢查圖卡位置 |
| `npm run studio -- ep01` | 開瀏覽器預覽 |
| `npm run render -- ep01` | 輸出 `jobs/ep01/output/ep01.mp4`＋`.srt` |

`prep` 的選項：`--theme sunlight`（日不落配色）、`--no-cut`（不剪空白）、`--min-silence 0.7`（只剪更長的停頓）、`--threshold -45`（收音小聲時用）、`--force`（覆蓋同名 job）。

## 資料夾

```
config/settings.json   剪空白靈敏度、模型、字幕每行字數
config/glossary.md     專有名詞表（給 Whisper 提示＋給 Claude 校對）
src/                   畫面（字幕、圖卡、配色）
scripts/               各步驟的指令
skill/SKILL.md         Claude Code skill 原稿
jobs/                  每支影片的工作資料夾（不進版控）
.cache/                Whisper 與模型（不進版控，setup 會下載）
```

## 疑難排解

- **字被剪掉一半**：`--min-silence 0.7` 重跑，或在 `config/settings.json` 調大 `padBefore`／`padAfter`。
- **名詞一直辨識錯**：加進 `config/glossary.md`。
- **Windows 跑 whisper 失敗**：安裝「Microsoft Visual C++ 可轉散發套件 x64」。
- **辨識很慢**：一般 CPU 約為影片長度的 1–2 倍；`config/settings.json` 把 `model` 改成 `medium` 會快一些，但準確度較低（改完要重跑 `npm run setup`）。

## 授權

- Remotion：3 人以上的公司商用需購買公司授權（[remotion.pro/license](https://www.remotion.pro/license)）。
- Noto Sans TC 字型：SIL Open Font License（`src/assets/OFL.txt`）。

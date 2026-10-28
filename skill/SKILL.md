---
name: sov-video-edit
description: 把口播／衛教原始影片自動剪好：剪掉空白、上中英雙語字幕、加動態圖卡，輸出 MP4＋SRT。當使用者提到「剪影片」「剪空白」「上字幕」「雙語字幕」「加圖卡」「口播影片」「Reels／短影音後製」「Remote Editor Kit」，或丟一個影片檔要處理時使用。也涵蓋只想重新輸出、改字幕或改圖卡的情況。
---

# SOV 影片自動剪輯

工具包位置：`{{KIT_DIR}}`（以下指令都在這個資料夾執行）

流程分三段：**腳本**做機械工作（剪空白、語音辨識、渲染），**你（Claude）**做需要判斷的工作（校字、翻譯、規劃圖卡、看截圖檢查）。

## 0. 這台電腦第一次用

```bash
cd "{{KIT_DIR}}" && npm run doctor
```

有 ✗ 就照提示修：通常是 `npm install` 再 `npm run setup`（會下載約 1.6GB 語音模型，要 5–20 分鐘，用背景執行）。全部 ✓ 才往下。

使用者說「更新影片工具包」：執行 `npm run update`（拉最新版、補套件、更新 skill、跑環境檢查）。

Mac 缺 Homebrew 或要輸入密碼的步驟，你無法代為執行：請使用者在「終端機」貼上 README「第一次安裝 → Mac」那一行，自己完成。

## 1. 剪空白＋語音辨識

```bash
npm run prep -- "<影片完整路徑>" --name <英文短名> [--theme sov|sunlight|neutral]
```

- 品牌：日不落的影片用 `--theme sunlight`，其他預設 `sov`。看不出來就問。
- 這步最久（辨識約影片長度 1–2 倍，3 分鐘影片約 5 分鐘），超過 2 分鐘的影片用背景執行。
- 產出在 `jobs/<名稱>/`：`cut.mp4`（剪好的影片）、`subtitles.json`（字幕草稿）、`transcript.txt`（方便讀的逐字稿）、`cards.json`（空的）。
- 剪太兇（字被切掉）：加 `--min-silence 0.7` 或 `--threshold -45` 重跑；完全不剪：`--no-cut`。重跑同名要加 `--force`。

## 2. 校對字幕＋翻英文（你來做）

先讀 `config/glossary.md`，再讀 `jobs/<名稱>/subtitles.json`。逐行處理後**整份寫回** `subtitles.json`：

- `zh`：只修辨識錯誤（照名詞表的「常見誤聽」改）、錯字、簡體殘留。**不改講者的意思、不潤飾成書面語**。口頭禪可刪。
- 每行中文直式不超過 14 字、橫式不超過 20 字（`job.json` 的 `orientation`）。太長就拆成兩行，時間依字數比例切；太短且相鄰可合併。`start`/`end` 不可重疊、不可超出影片長度。
- 重點詞可用 `**詞**` 標成強調色，**每 3 行最多 1 個**，只標真正的關鍵（療程名、數字、結論）。
- `en`：自然、簡短的英文意譯，不要逐字直譯；專有名詞照名詞表的英文欄。院所名不翻。
- 遇到聽不出來、名詞表也沒有的詞，**保留原樣並在最後回報**，不要猜。

## 3. 規劃動態圖卡（你來做）

讀完字幕後，在 `jobs/<名稱>/cards.json` 寫 `{ "cards": [...] }`。時間用秒（剪輯後時間軸），對齊講者**說到那句的 `start`**。

| type | 用在 | 欄位 |
|---|---|---|
| `title` | 開場主題（`at` 約 0.2） | `title`（≤12 字）、`kicker`（小標，選填）、`en` |
| `point` | 「第一、第二…」的重點 | `number`、`title`、`en` |
| `list` | 列舉 2–4 項 | `title`、`items`（每項 ≤10 字） |
| `stat` | 數字（療程月數、時數、價格） | `value`（如「22 小時」）、`label`、`en` |
| `term` | 專業術語解釋 | `term`、`en`、`definition`（≤30 字，取自講者說法） |
| `cta` | 結尾行動呼籲 | `title`、`sub` |

共用選填：`duration`（秒，預設 3.5，建議 2.5–5）、`position`（`top`／`middle`／`bottom`，預設 `top`）、`align`（`left`／`center`／`right`）。

原則：
- 每 10–15 秒最多一張，**時間不可重疊**；講者沒講的內容不要加，不要加療效保證類字眼。
- 圖卡文字是「摘要」不是字幕複本，越短越好。
- 結尾有邀約才放 `cta`。

## 4. 截圖檢查（你來做）

```bash
npm run still -- <名稱>
```

會在 `jobs/<名稱>/stills/` 截每張圖卡出現後 1 秒的畫面（也可指定秒數：`npm run still -- <名稱> 3.5 12`）。**用 Read 看每張圖**：圖卡有沒有擋到臉、跟字幕有沒有疊在一起、字有沒有超出畫面。有問題就改 `position`／`align` 或縮短文字，再截一次。

## 5. 輸出

```bash
npm run render -- <名稱>
```

產出 `jobs/<名稱>/output/<名稱>.mp4` 和雙語 `.srt`。想先快速看效果用 `--draft`（半解析度）。使用者想自己預覽或微調時，請他執行 `npm run studio -- <名稱>`（會開瀏覽器）。

## 回報給使用者

- 剪輯前後長度（`job.json` 的 `cut`）
- 改了哪些辨識錯誤（列出重要的幾個）、有哪些詞不確定
- 圖卡清單（時間＋內容）
- 成品路徑

## 常見問題

- `npm run doctor` 說 skill 指向別的資料夾：工具包被搬過，跑 `npm run setup -- --skill-only`。
- 名詞一直辨識錯：把正確寫法加進 `config/glossary.md` 的 prompt 區塊與表格。
- 想換配色：`src/themes.ts` 加一組，`job.json` 的 `theme` 改成那個名字。
- 不要英文：`job.json` 的 `showEnglish` 改 `false`。

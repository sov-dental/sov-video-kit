#!/bin/bash
# SOV 影片剪輯工具包：Mac 一鍵安裝（也可以重跑來更新）
# 會安裝：Homebrew、Node.js、Git、GitHub CLI、whisper.cpp，下載工具包到 ~/sov-video-kit，再下載語音模型
set -euo pipefail

REPO="sov-dental/sov-video-kit"
DEST="$HOME/sov-video-kit"

say() { printf "\n\033[1;35m▶ %s\033[0m\n" "$1"; }
pause() { read -r -p "按 Enter 關閉這個視窗…" _ </dev/tty || true; }
die() {
  printf "\n\033[1;31m✗ %s\033[0m\n" "$1"
  pause
  exit 1
}
trap 'die "安裝在第 $LINENO 行中斷。把這個視窗截圖給 Claude 看。"' ERR

[[ "$(uname)" == "Darwin" ]] || die "這個安裝檔只適用 Mac"

load_brew() {
  for p in /opt/homebrew/bin/brew /usr/local/bin/brew; do
    if [[ -x "$p" ]]; then eval "$("$p" shellenv)"; return 0; fi
  done
  return 1
}

# 1. Homebrew（Mac 的套件管理工具，會順便裝好 Apple 的開發工具）
if ! command -v brew >/dev/null 2>&1 && ! load_brew; then
  say "安裝 Homebrew：等一下會要你輸入「Mac 開機密碼」，輸入時畫面不會出現字，打完按 Enter"
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" </dev/tty
  load_brew || die "Homebrew 安裝失敗"
  if ! grep -q "brew shellenv" "$HOME/.zprofile" 2>/dev/null; then
    echo "eval \"\$($(command -v brew) shellenv)\"" >>"$HOME/.zprofile"
  fi
fi

# 2. 需要的工具（已經裝過的會自動略過）
say "安裝 Node.js、Git、GitHub CLI、Whisper"
brew install node git gh whisper.cpp

# 3. 下載或更新工具包
if [[ -d "$DEST/.git" ]]; then
  say "更新工具包（$DEST）"
  git -C "$DEST" pull --ff-only
else
  say "下載工具包到 $DEST"
  if ! GIT_TERMINAL_PROMPT=0 git clone -q "https://github.com/$REPO.git" "$DEST" 2>/dev/null; then
    say "需要登入 GitHub：會開瀏覽器，照畫面輸入代碼並按授權"
    gh auth status >/dev/null 2>&1 || gh auth login --web --hostname github.com --git-protocol https </dev/tty
    gh auth setup-git
    git clone -q "https://github.com/$REPO.git" "$DEST"
  fi
fi

# 4. 套件、語音模型、Claude Code skill
cd "$DEST"
say "安裝套件"
npm install --no-audit --no-fund
say "下載語音模型（約 1.6GB，視網路 5–20 分鐘，請不要關視窗）"
npm run setup
npm run doctor || die "環境檢查沒過，把上面的 ✗ 截圖給 Claude 看"

say "完成！打開 Claude Code，說「幫我剪這支影片：」再把影片檔拖進對話框就可以開始。"
pause

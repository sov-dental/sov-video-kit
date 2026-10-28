# SOV 影片剪輯工具包：Windows 一鍵安裝（也可以重跑來更新）
# 會安裝：Node.js、Git、GitHub CLI、VC++ 執行環境，下載工具包到 桌面\sov-video-kit，再下載語音模型
$ErrorActionPreference = 'Stop'
$Repo = 'sov-dental/sov-video-kit'
$Dest = Join-Path ([Environment]::GetFolderPath('Desktop')) 'sov-video-kit'

function Step($m) { Write-Host "`n> $m" -ForegroundColor Magenta }
function Has($c) { [bool](Get-Command $c -ErrorAction SilentlyContinue) }
function RefreshPath {
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
}
function Done($code) { Read-Host '按 Enter 關閉這個視窗' | Out-Null; exit $code }

try {
  if (-not (Has winget)) { throw '找不到 winget。請先到 Microsoft Store 安裝「應用程式安裝程式」(App Installer)。' }

  # 1. 需要的工具（已經裝過的略過；Node 太舊會升級）
  $nodeOld = $false
  if (Has node) { $nodeOld = [int]((node -v).TrimStart('v').Split('.')[0]) -lt 22 }
  $pkgs = @(
    @{ cmd = 'node'; id = 'OpenJS.NodeJS.LTS'; force = $nodeOld },
    @{ cmd = 'git'; id = 'Git.Git'; force = $false },
    @{ cmd = 'gh'; id = 'GitHub.cli'; force = $false }
  )
  foreach ($p in $pkgs) {
    if (-not (Has $p.cmd) -or $p.force) {
      Step "安裝 $($p.id)"
      winget install --id $p.id -e --silent --accept-source-agreements --accept-package-agreements
      RefreshPath
    }
  }
  # whisper.cpp 需要 VC++ 執行環境；已經有就不要重裝（重裝會跳系統管理員確認視窗）
  $vc = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64' -ErrorAction SilentlyContinue
  if (-not ($vc -and $vc.Installed -eq 1)) {
    Step '安裝 VC++ 執行環境（若跳出「是否允許變更」請按「是」）'
    winget install --id Microsoft.VCRedist.2015+.x64 -e --silent --accept-source-agreements --accept-package-agreements
  }

  # 2. 下載或更新工具包
  if (Test-Path (Join-Path $Dest '.git')) {
    Step "更新工具包（$Dest）"
    git -C $Dest pull --ff-only
  } else {
    Step "下載工具包到 $Dest"
    $env:GIT_TERMINAL_PROMPT = '0'
    git clone -q "https://github.com/$Repo.git" $Dest 2>$null
    if ($LASTEXITCODE -ne 0) {
      Step '需要登入 GitHub：會開瀏覽器，照畫面輸入代碼並按授權'
      gh auth status 2>$null | Out-Null
      if ($LASTEXITCODE -ne 0) { gh auth login --web --hostname github.com --git-protocol https }
      gh auth setup-git
      Remove-Item Env:GIT_TERMINAL_PROMPT
      git clone -q "https://github.com/$Repo.git" $Dest
      if ($LASTEXITCODE -ne 0) { throw '下載工具包失敗' }
    }
  }

  # 3. 套件、Whisper、語音模型、Claude Code skill
  Set-Location $Dest
  Step '安裝套件'
  npm install --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw 'npm install 失敗' }
  Step '下載 Whisper 與語音模型（約 1.6GB，視網路 5–20 分鐘，請不要關視窗）'
  npm run setup
  if ($LASTEXITCODE -ne 0) { throw 'setup 失敗' }
  npm run doctor
  if ($LASTEXITCODE -ne 0) { throw '環境檢查沒過，把上面的 ✗ 截圖給 Claude 看' }

  Step '完成！打開 Claude Code，說「幫我剪這支影片：」再把影片檔拖進對話框就可以開始。'
  Done 0
} catch {
  Write-Host "`n安裝中斷：$($_.Exception.Message)" -ForegroundColor Red
  Done 1
}

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$EnvPath = Join-Path $ProjectRoot '.env'

if (Test-Path -LiteralPath $EnvPath) {
  throw '.env 파일이 이미 있습니다. 기존 설정을 보존하기 위해 중단했습니다.'
}

function Read-RequiredText([string]$Prompt, [string]$DefaultValue = '') {
  $Value = Read-Host "$Prompt$(if ($DefaultValue) { " [$DefaultValue]" })"
  if (-not $Value) { $Value = $DefaultValue }
  if (-not $Value) { throw "$Prompt 값이 필요합니다." }
  if ($Value.Contains("`n") -or $Value.Contains("`r")) { throw '줄바꿈은 사용할 수 없습니다.' }
  return $Value
}

function Read-PlainPassword([string]$Prompt) {
  $SecureValue = Read-Host $Prompt -AsSecureString
  $Pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
  try {
    $PlainValue = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($Pointer)
    if ($PlainValue.Length -lt 8) { throw '비밀번호는 8자 이상이어야 합니다.' }
    return $PlainValue
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Pointer)
  }
}

function Read-OptionalSecret([string]$Prompt) {
  $SecureValue = Read-Host $Prompt -AsSecureString
  $Pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($Pointer)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Pointer)
  }
}

function Quote-Env([string]$Value) {
  return '"' + $Value.Replace('\', '\\').Replace('"', '\"') + '"'
}

function Show-TelegramCandidates([string]$Token) {
  if (-not $Token) { return }
  try {
    $Response = Invoke-RestMethod -Method Get -Uri ("https://api.telegram.org/bot{0}/getUpdates" -f $Token) -TimeoutSec 15
    $Candidates = @($Response.result |
      ForEach-Object { if ($_.message -and $_.message.from) { $_.message.from } elseif ($_.my_chat_member -and $_.my_chat_member.from) { $_.my_chat_member.from } } |
      Where-Object { $_ -and $_.id } |
      Sort-Object id -Unique)
    if ($Candidates.Count -eq 0) {
      Write-Host '아직 Telegram 사용자를 찾지 못했습니다. 두 분 모두 봇 개인 채팅에서 /start를 보낸 뒤 ID를 입력하세요.' -ForegroundColor Yellow
      return
    }
    Write-Host '발견한 Telegram 사용자:' -ForegroundColor Cyan
    foreach ($Candidate in $Candidates) {
      $Name = (@($Candidate.first_name, $Candidate.last_name) | Where-Object { $_ }) -join ' '
      $Username = if ($Candidate.username) { "@$($Candidate.username)" } else { 'username 없음' }
      Write-Host "  ID $($Candidate.id) · $Name · $Username"
    }
  } catch {
    Write-Warning 'Telegram 사용자 자동 조회에 실패했습니다. 토큰과 /start 전송 여부를 확인한 뒤 ID를 직접 입력하세요.'
  }
}

$OwnerName = Read-RequiredText '본인 표시 이름' '나'
$OwnerPassword = Read-PlainPassword '본인 비밀번호 (8자 이상)'
$PartnerName = Read-RequiredText '배우자 표시 이름' '배우자'
$PartnerPassword = Read-PlainPassword '배우자 비밀번호 (8자 이상)'
$PublicWebUrl = Read-RequiredText 'GitHub Pages URL' 'https://ian939.github.io/interior-decision-board/'
$GitHubRepository = Read-RequiredText 'GitHub 저장소' 'ian939/interior-decision-board'
$TelegramToken = Read-OptionalSecret 'Telegram bot token (화면에 표시되지 않음, 나중에 설정하려면 Enter)'
Show-TelegramCandidates $TelegramToken
$TelegramOwnerId = Read-Host '본인 Telegram numeric user ID (나중에 설정하려면 Enter)'
$TelegramPartnerId = Read-Host '배우자 Telegram numeric user ID (나중에 설정하려면 Enter)'
$SecretBytes = New-Object byte[] 48
$Random = [Security.Cryptography.RandomNumberGenerator]::Create()
try {
  $Random.GetBytes($SecretBytes)
} finally {
  $Random.Dispose()
}
$SessionSecret = [Convert]::ToBase64String($SecretBytes)
$PublicWebUri = [Uri]$PublicWebUrl
$PublicWebOrigin = "$($PublicWebUri.Scheme)://$($PublicWebUri.Authority)"
$Origins = "http://localhost:5173,http://127.0.0.1:5173,$PublicWebOrigin"

$Lines = @(
  'HOST=127.0.0.1'
  'PORT=8787'
  "APP_ORIGINS=$(Quote-Env $Origins)"
  "PUBLIC_WEB_URL=$(Quote-Env $PublicWebUrl)"
  'DATA_DIR=./data'
  'UPLOAD_DIR=./uploads'
  'BACKUP_DIR=./backups'
  'BACKUP_RETENTION=14'
  'MAX_UPLOAD_MB=20'
  "OWNER_NAME=$(Quote-Env $OwnerName)"
  "OWNER_PASSWORD=$(Quote-Env $OwnerPassword)"
  "PARTNER_NAME=$(Quote-Env $PartnerName)"
  "PARTNER_PASSWORD=$(Quote-Env $PartnerPassword)"
  "SESSION_SECRET=$(Quote-Env $SessionSecret)"
  'CLAUDE_COMMAND=claude'
  'CLAUDE_TIMEOUT_MS=60000'
  'YT_DLP_COMMAND=yt-dlp'
  'YT_DLP_TIMEOUT_MS=45000'
  "TELEGRAM_BOT_TOKEN=$(Quote-Env $TelegramToken)"
  "TELEGRAM_OWNER_ID=$(Quote-Env $TelegramOwnerId)"
  "TELEGRAM_PARTNER_ID=$(Quote-Env $TelegramPartnerId)"
  'INTERIOR_TUNNEL_MODE=quick'
  'INTERIOR_TUNNEL_NAME='
  "GITHUB_REPOSITORY=$(Quote-Env $GitHubRepository)"
  'VITE_API_BASE_URL=http://127.0.0.1:8787/api'
  'VITE_BASE_PATH=/'
)

[IO.File]::WriteAllLines($EnvPath, $Lines, [Text.UTF8Encoding]::new($false))
Write-Output "초기 설정을 저장했습니다: $EnvPath"
Write-Output '다음 명령: npm run build; powershell -ExecutionPolicy Bypass -File scripts/install-startup.ps1'

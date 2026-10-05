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

function Quote-Env([string]$Value) {
  return '"' + $Value.Replace('\', '\\').Replace('"', '\"') + '"'
}

$OwnerName = Read-RequiredText '본인 표시 이름' '나'
$OwnerPassword = Read-PlainPassword '본인 비밀번호 (8자 이상)'
$PartnerName = Read-RequiredText '배우자 표시 이름' '배우자'
$PartnerPassword = Read-PlainPassword '배우자 비밀번호 (8자 이상)'
$PublicWebUrl = Read-RequiredText '최종 GitHub Pages URL (아직 없으면 로컬 주소)' 'http://localhost:5173'
$ApiOrigin = Read-RequiredText '로컬 API의 공개 HTTPS Origin (아직 없으면 로컬 주소)' 'http://127.0.0.1:8787'
$TelegramToken = Read-Host 'Telegram bot token (나중에 설정하려면 Enter)'
$TelegramOwnerId = Read-Host '본인 Telegram numeric user ID (나중에 설정하려면 Enter)'
$TelegramPartnerId = Read-Host '배우자 Telegram numeric user ID (나중에 설정하려면 Enter)'
$TunnelName = Read-Host 'Cloudflare named tunnel 이름 (나중에 설정하려면 Enter)'
$SecretBytes = New-Object byte[] 48
$Random = [Security.Cryptography.RandomNumberGenerator]::Create()
try {
  $Random.GetBytes($SecretBytes)
} finally {
  $Random.Dispose()
}
$SessionSecret = [Convert]::ToBase64String($SecretBytes)
$Origins = "http://localhost:5173,http://127.0.0.1:5173,$PublicWebUrl"

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
  "TELEGRAM_BOT_TOKEN=$(Quote-Env $TelegramToken)"
  "TELEGRAM_OWNER_ID=$(Quote-Env $TelegramOwnerId)"
  "TELEGRAM_PARTNER_ID=$(Quote-Env $TelegramPartnerId)"
  "INTERIOR_TUNNEL_NAME=$(Quote-Env $TunnelName)"
  "VITE_API_BASE_URL=$(Quote-Env ($ApiOrigin.TrimEnd('/') + '/api'))"
  'VITE_BASE_PATH=/'
)

[IO.File]::WriteAllLines($EnvPath, $Lines, [Text.UTF8Encoding]::new($false))
Write-Output "초기 설정을 저장했습니다: $EnvPath"
Write-Output '다음 명령: npm run build; npm run dev'

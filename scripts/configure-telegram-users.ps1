param(
  [string]$OwnerId,
  [string]$PartnerId
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$EnvPath = Join-Path $ProjectRoot '.env'
if (-not (Test-Path -LiteralPath $EnvPath)) { throw '.env 파일이 없습니다.' }

$SecureToken = Read-Host 'BotFather에서 재발급한 Telegram bot token' -AsSecureString
$Pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureToken)
try { $Token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($Pointer) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Pointer) }
if (-not $Token) { throw 'Telegram bot token이 필요합니다.' }

try {
  $Bot = Invoke-RestMethod -Method Get -Uri ("https://api.telegram.org/bot{0}/getMe" -f $Token) -TimeoutSec 15
  if (-not $Bot.ok) { throw 'invalid bot' }
  Write-Host "연결할 봇: @$($Bot.result.username)" -ForegroundColor Cyan
  $Updates = Invoke-RestMethod -Method Get -Uri ("https://api.telegram.org/bot{0}/getUpdates" -f $Token) -TimeoutSec 15
  $Candidates = @($Updates.result |
    ForEach-Object { if ($_.message -and $_.message.from) { $_.message.from } elseif ($_.my_chat_member -and $_.my_chat_member.from) { $_.my_chat_member.from } } |
    Where-Object { $_ -and $_.id } |
    Sort-Object id -Unique)
} catch {
  throw 'Telegram 연결에 실패했습니다. 새 토큰을 확인하세요.'
}
if ($Candidates.Count -lt 2) { throw '두 분 모두 새 봇의 개인 채팅에서 /start를 보낸 뒤 다시 실행하세요.' }
Write-Host '발견한 Telegram 사용자:' -ForegroundColor Cyan
foreach ($Candidate in $Candidates) {
  $Name = (@($Candidate.first_name, $Candidate.last_name) | Where-Object { $_ }) -join ' '
  $Username = if ($Candidate.username) { "@$($Candidate.username)" } else { 'username 없음' }
  Write-Host "  ID $($Candidate.id) · $Name · $Username"
}

if (-not $OwnerId) { $OwnerId = Read-Host '본인 Telegram numeric ID' }
if (-not $PartnerId) { $PartnerId = Read-Host '배우자 Telegram numeric ID' }
if ($OwnerId -notmatch '^\d+$' -or $PartnerId -notmatch '^\d+$') { throw 'Telegram ID는 숫자만 입력하세요.' }
if ($OwnerId -eq $PartnerId) { throw '두 사용자 ID는 서로 달라야 합니다.' }
$CandidateIds = @($Candidates | ForEach-Object { [string]$_.id })
if ($OwnerId -notin $CandidateIds -or $PartnerId -notin $CandidateIds) { throw '발견된 사용자 목록의 ID를 입력하세요.' }

$Lines = Get-Content -LiteralPath $EnvPath -Encoding UTF8
$FoundToken = $false
$FoundOwner = $false
$FoundPartner = $false
$Updated = foreach ($Line in $Lines) {
  if ($Line -match '^TELEGRAM_BOT_TOKEN=') { $FoundToken = $true; "TELEGRAM_BOT_TOKEN=`"$Token`"" }
  elseif ($Line -match '^TELEGRAM_OWNER_ID=') { $FoundOwner = $true; "TELEGRAM_OWNER_ID=`"$OwnerId`"" }
  elseif ($Line -match '^TELEGRAM_PARTNER_ID=') { $FoundPartner = $true; "TELEGRAM_PARTNER_ID=`"$PartnerId`"" }
  else { $Line }
}
if (-not $FoundToken) { $Updated += "TELEGRAM_BOT_TOKEN=`"$Token`"" }
if (-not $FoundOwner) { $Updated += "TELEGRAM_OWNER_ID=`"$OwnerId`"" }
if (-not $FoundPartner) { $Updated += "TELEGRAM_PARTNER_ID=`"$PartnerId`"" }
[IO.File]::WriteAllLines($EnvPath, $Updated, [Text.UTF8Encoding]::new($false))

& (Join-Path $PSScriptRoot 'uninstall-startup.ps1')
Start-Sleep -Seconds 2
& (Join-Path $PSScriptRoot 'install-startup.ps1')
Write-Output '새 Telegram 토큰과 두 사용자 연결을 저장하고 서비스를 재시작했습니다.'

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$RuntimeDir = Join-Path $ProjectRoot '.runtime'
$PidPath = Join-Path $RuntimeDir 'supervisor.pid'
$WrapperLog = Join-Path $RuntimeDir 'supervisor-wrapper.log'
$Launcher = Join-Path $PSScriptRoot 'start-local.ps1'

New-Item -ItemType Directory -Path $RuntimeDir -Force | Out-Null
Set-Content -LiteralPath $PidPath -Value $PID -Encoding ASCII

function Write-WrapperLog([string]$Message) {
  $Timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
  Add-Content -LiteralPath $WrapperLog -Value "[$Timestamp] $Message" -Encoding UTF8
}

try {
  while ($true) {
    try {
      & $Launcher
      Write-WrapperLog '로컬 실행기가 종료되어 10초 후 다시 시작합니다.'
    } catch {
      $SafeMessage = $_.Exception.Message -replace '[\r\n]+', ' '
      Write-WrapperLog "로컬 실행기 오류: $SafeMessage"
    }
    Start-Sleep -Seconds 10
  }
} finally {
  if (Test-Path -LiteralPath $PidPath) {
    $RecordedPid = (Get-Content -Raw -LiteralPath $PidPath -ErrorAction SilentlyContinue).Trim()
    if ($RecordedPid -eq [string]$PID) {
      Remove-Item -LiteralPath $PidPath -Force -ErrorAction SilentlyContinue
    }
  }
}

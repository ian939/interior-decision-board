param(
  [string]$TaskName = 'InteriorDecisionBoard',
  [string]$BackupTaskName = 'InteriorDecisionBoardBackup'
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$StatePath = Join-Path $ProjectRoot '.runtime\processes.json'

foreach ($Name in @($TaskName, $BackupTaskName)) {
  if (Get-ScheduledTask -TaskName $Name -ErrorAction SilentlyContinue) {
    Stop-ScheduledTask -TaskName $Name -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $Name -Confirm:$false
  }
}

if (Test-Path -LiteralPath $StatePath) {
  $State = Get-Content -Raw -LiteralPath $StatePath | ConvertFrom-Json
  foreach ($ProcessId in @($State.tunnelPid, $State.serverPid)) {
    if ($ProcessId) { Stop-Process -Id ([int]$ProcessId) -Force -ErrorAction SilentlyContinue }
  }
}

Write-Output '자동 시작과 일일 백업 예약을 제거했습니다. 데이터와 첨부파일은 삭제하지 않았습니다.'

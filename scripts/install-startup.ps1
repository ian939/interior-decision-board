param(
  [string]$TaskName = 'InteriorDecisionBoard',
  [string]$BackupTaskName = 'InteriorDecisionBoardBackup',
  [datetime]$BackupAt = '03:00'
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Launcher = Join-Path $PSScriptRoot 'start-local.ps1'

if (-not (Test-Path -LiteralPath $Launcher)) {
  throw "시작 스크립트를 찾을 수 없습니다: $Launcher"
}

$Action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$Launcher`"" -WorkingDirectory $ProjectRoot
$Trigger = New-ScheduledTaskTrigger -AtLogOn
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Description '인테리어 공동 의사결정 로컬 서버 및 터널 자동 시작'

$Node = (Get-Command 'node.exe' -ErrorAction Stop).Source
$BackupScript = Join-Path $PSScriptRoot 'backup.mjs'
if (-not (Test-Path -LiteralPath $BackupScript)) {
  throw "백업 스크립트를 찾을 수 없습니다: $BackupScript"
}
$BackupAction = New-ScheduledTaskAction -Execute $Node -Argument "`"$BackupScript`"" -WorkingDirectory $ProjectRoot
$BackupTrigger = New-ScheduledTaskTrigger -Daily -At $BackupAt
$BackupSettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 2)
Register-ScheduledTask -TaskName $BackupTaskName -Action $BackupAction -Trigger $BackupTrigger -Settings $BackupSettings -Description '인테리어 공동 의사결정 데이터 및 첨부파일 일일 백업'

Write-Output "예약 작업 '$TaskName'과 일일 백업 '$BackupTaskName'을 등록했습니다."

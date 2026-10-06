param(
  [string]$ShortcutName = 'InteriorDecisionBoard.lnk',
  [string]$LegacyTaskName = 'InteriorDecisionBoard',
  [string]$LegacyBackupTaskName = 'InteriorDecisionBoardBackup'
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$RuntimeDir = Join-Path $ProjectRoot '.runtime'
$ShortcutPath = Join-Path ([Environment]::GetFolderPath('Startup')) $ShortcutName
$SupervisorPidPath = Join-Path $RuntimeDir 'supervisor.pid'
$StatePath = Join-Path $RuntimeDir 'processes.json'

if (Test-Path -LiteralPath $ShortcutPath) {
  Remove-Item -LiteralPath $ShortcutPath -Force
}

if (Test-Path -LiteralPath $SupervisorPidPath) {
  $SupervisorPid = 0
  if ([int]::TryParse((Get-Content -Raw -LiteralPath $SupervisorPidPath).Trim(), [ref]$SupervisorPid)) {
    Stop-Process -Id $SupervisorPid -Force -ErrorAction SilentlyContinue
  }
  Remove-Item -LiteralPath $SupervisorPidPath -Force -ErrorAction SilentlyContinue
}

if (Test-Path -LiteralPath $StatePath) {
  $State = Get-Content -Raw -LiteralPath $StatePath | ConvertFrom-Json
  foreach ($ProcessId in @($State.tunnelPid, $State.serverPid)) {
    if ($ProcessId) { Stop-Process -Id ([int]$ProcessId) -Force -ErrorAction SilentlyContinue }
  }
}

foreach ($Name in @($LegacyTaskName, $LegacyBackupTaskName)) {
  try {
    if (Get-ScheduledTask -TaskName $Name -ErrorAction SilentlyContinue) {
      Stop-ScheduledTask -TaskName $Name -ErrorAction SilentlyContinue
      Unregister-ScheduledTask -TaskName $Name -Confirm:$false -ErrorAction SilentlyContinue
    }
  } catch {
    # 기존 관리자 권한 예약 작업이 있더라도 사용자 시작프로그램 제거는 계속 완료합니다.
  }
}

Write-Output '사용자 자동 시작과 실행 프로세스를 제거했습니다. 데이터, 첨부파일, 백업은 삭제하지 않았습니다.'

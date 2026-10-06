param(
  [string]$ShortcutName = 'InteriorDecisionBoard.lnk'
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Supervisor = Join-Path $PSScriptRoot 'supervise-local.ps1'
$EnvPath = Join-Path $ProjectRoot '.env'
$ServerEntry = Join-Path $ProjectRoot 'apps\server\dist\index.js'
$RuntimeDir = Join-Path $ProjectRoot '.runtime'
$SupervisorPidPath = Join-Path $RuntimeDir 'supervisor.pid'
$StartupDir = [Environment]::GetFolderPath('Startup')
$ShortcutPath = Join-Path $StartupDir $ShortcutName

foreach ($RequiredPath in @($Supervisor, $EnvPath, $ServerEntry)) {
  if (-not (Test-Path -LiteralPath $RequiredPath)) {
    throw "필수 파일을 찾을 수 없습니다: $RequiredPath"
  }
}

New-Item -ItemType Directory -Path $RuntimeDir -Force | Out-Null

$Shell = New-Object -ComObject WScript.Shell
$Shortcut = $Shell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = (Get-Command 'powershell.exe' -ErrorAction Stop).Source
$Shortcut.Arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$Supervisor`""
$Shortcut.WorkingDirectory = $ProjectRoot
$Shortcut.Description = '인테리어 공동 의사결정 서버 및 무료 Quick Tunnel 자동 시작'
$Shortcut.Save()

$AlreadyRunning = $false
if (Test-Path -LiteralPath $SupervisorPidPath) {
  $ExistingPid = 0
  if ([int]::TryParse((Get-Content -Raw -LiteralPath $SupervisorPidPath).Trim(), [ref]$ExistingPid)) {
    $AlreadyRunning = [bool](Get-Process -Id $ExistingPid -ErrorAction SilentlyContinue)
  }
}

if (-not $AlreadyRunning) {
  Start-Process -FilePath 'powershell.exe' `
    -ArgumentList @('-NoProfile', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass', '-File', "`"$Supervisor`"") `
    -WorkingDirectory $ProjectRoot `
    -WindowStyle Hidden
}

Write-Output "사용자 시작프로그램에 자동 실행을 등록했습니다: $ShortcutPath"
Write-Output '서버 감시와 오전 3시 이후 일일 백업을 시작했습니다.'

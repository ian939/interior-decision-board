$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $ProjectRoot

if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot '.env'))) {
  & (Join-Path $PSScriptRoot 'setup.ps1')
}

& npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw '프로덕션 빌드에 실패했습니다.' }

& (Join-Path $PSScriptRoot 'install-startup.ps1')
Write-Output '활성화가 완료됐습니다. Quick Tunnel 주소가 GitHub Pages에 반영되기까지 약 1분 걸릴 수 있습니다.'
Write-Output '웹 주소: https://ian939.github.io/interior-decision-board/'

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $ProjectRoot

if (-not (Test-Path -LiteralPath '.env')) {
  throw '.env 파일이 없습니다. .env.example을 참고해 먼저 설정하세요.'
}

$Server = Start-Process -FilePath 'npm.cmd' -ArgumentList @('run', 'start', '-w', '@interior/server') -WorkingDirectory $ProjectRoot -WindowStyle Hidden -PassThru

$TunnelLine = Get-Content -LiteralPath '.env' | Where-Object { $_ -match '^INTERIOR_TUNNEL_NAME=' } | Select-Object -First 1
$TunnelName = if ($TunnelLine) { ($TunnelLine -replace '^INTERIOR_TUNNEL_NAME=', '').Trim().Trim('"') } else { '' }

if ($TunnelName) {
  $Tunnel = Start-Process -FilePath 'cloudflared.exe' -ArgumentList @('tunnel', 'run', $TunnelName) -WorkingDirectory $ProjectRoot -WindowStyle Hidden -PassThru
  Write-Output "Server PID: $($Server.Id), Tunnel PID: $($Tunnel.Id)"
} else {
  Write-Output "Server PID: $($Server.Id). .env에 INTERIOR_TUNNEL_NAME이 없어 터널은 시작하지 않았습니다."
}

param(
  [string]$EnvFile = '.env',
  [switch]$Probe,
  [switch]$SkipPagesUpdate
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ResolvedEnvFile = if ([IO.Path]::IsPathRooted($EnvFile)) { $EnvFile } else { Join-Path $ProjectRoot $EnvFile }
$RuntimeDir = Join-Path $ProjectRoot '.runtime'
$ServerEntry = Join-Path $ProjectRoot 'apps\server\dist\index.js'

Set-Location -LiteralPath $ProjectRoot
if (-not (Test-Path -LiteralPath $ResolvedEnvFile)) {
  throw "환경 설정 파일이 없습니다: $ResolvedEnvFile"
}
if (-not (Test-Path -LiteralPath $ServerEntry)) {
  throw '서버 빌드가 없습니다. 먼저 npm run build를 실행하세요.'
}
New-Item -ItemType Directory -Path $RuntimeDir -Force | Out-Null

function Get-EnvValue([string]$Name, [string]$DefaultValue = '') {
  $Line = Get-Content -LiteralPath $ResolvedEnvFile -Encoding UTF8 |
    Where-Object { $_ -match "^$([regex]::Escape($Name))=" } |
    Select-Object -First 1
  if (-not $Line) { return $DefaultValue }
  $Value = $Line.Substring($Line.IndexOf('=') + 1).Trim()
  if ($Value.Length -ge 2 -and $Value.StartsWith('"') -and $Value.EndsWith('"')) {
    $Value = $Value.Substring(1, $Value.Length - 2)
  }
  return $Value
}

function Write-SupervisorLog([string]$Message) {
  $Timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
  Add-Content -LiteralPath (Join-Path $RuntimeDir 'supervisor.log') -Value "[$Timestamp] $Message" -Encoding UTF8
}

function Start-InteriorServer {
  $Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $Node = (Get-Command 'node.exe' -ErrorAction Stop).Source
  $ServerDir = Join-Path $ProjectRoot 'apps\server'
  $OutLog = Join-Path $RuntimeDir "server-$Stamp.out.log"
  $ErrorLog = Join-Path $RuntimeDir "server-$Stamp.err.log"
  $Arguments = @("--env-file=`"$ResolvedEnvFile`"", 'dist/index.js')
  return Start-Process -FilePath $Node -ArgumentList $Arguments -WorkingDirectory $ServerDir -WindowStyle Hidden -RedirectStandardOutput $OutLog -RedirectStandardError $ErrorLog -PassThru
}

function Wait-ForApi([Diagnostics.Process]$Process, [int]$Port) {
  $Deadline = (Get-Date).AddSeconds(45)
  while ((Get-Date) -lt $Deadline) {
    if ($Process.HasExited) { throw "로컬 API가 시작 중 종료됐습니다. 종료 코드: $($Process.ExitCode)" }
    try {
      $Response = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/health" -TimeoutSec 3
      if ($Response.ok) { return }
    } catch {
      Start-Sleep -Milliseconds 750
    }
  }
  throw '45초 안에 로컬 API가 준비되지 않았습니다.'
}

function Wait-ForRemoteApi([Diagnostics.Process]$Process, [string]$TunnelUrl) {
  $Deadline = (Get-Date).AddSeconds(45)
  while ((Get-Date) -lt $Deadline) {
    if ($Process.HasExited) { throw '원격 API 확인 중 Quick Tunnel이 종료됐습니다.' }
    try {
      $Response = Invoke-RestMethod -Uri "$TunnelUrl/api/health" -TimeoutSec 5
      if ($Response.ok) { return $Response }
    } catch {
      Start-Sleep -Seconds 2
    }
  }
  throw '45초 안에 Quick Tunnel 원격 API를 확인하지 못했습니다.'
}

function Start-QuickTunnel([int]$Port) {
  $Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $OutLog = Join-Path $RuntimeDir "tunnel-$Stamp.out.log"
  $ErrorLog = Join-Path $RuntimeDir "tunnel-$Stamp.err.log"
  $Process = Start-Process -FilePath 'cloudflared.exe' -ArgumentList @('tunnel', '--no-autoupdate', '--url', "http://127.0.0.1:$Port") -WorkingDirectory $ProjectRoot -WindowStyle Hidden -RedirectStandardOutput $OutLog -RedirectStandardError $ErrorLog -PassThru
  $Deadline = (Get-Date).AddSeconds(60)
  $DiscoveredUrl = $null
  while ((Get-Date) -lt $Deadline) {
    if ($Process.HasExited) { throw "Quick Tunnel이 시작 중 종료됐습니다. 종료 코드: $($Process.ExitCode)" }
    $Text = ''
    if (Test-Path -LiteralPath $OutLog) { $Text += Get-Content -Raw -LiteralPath $OutLog -ErrorAction SilentlyContinue }
    if (Test-Path -LiteralPath $ErrorLog) { $Text += Get-Content -Raw -LiteralPath $ErrorLog -ErrorAction SilentlyContinue }
    $Match = [regex]::Match($Text, 'https://[a-z0-9-]+\.trycloudflare\.com', 'IgnoreCase')
    if ($Match.Success) { $DiscoveredUrl = $Match.Value.ToLowerInvariant() }
    if ($DiscoveredUrl -and $Text.Contains('Registered tunnel connection')) {
      Start-Sleep -Seconds 2
      return [pscustomobject]@{ Process = $Process; Url = $DiscoveredUrl }
    }
    Start-Sleep -Milliseconds 750
  }
  Stop-Process -Id $Process.Id -Force -ErrorAction SilentlyContinue
  throw '60초 안에 Quick Tunnel 주소를 받지 못했습니다.'
}

function Publish-ApiUrl([string]$TunnelUrl, [string]$Repository) {
  if ($SkipPagesUpdate -or -not $Repository) { return }
  $ApiBaseUrl = "$($TunnelUrl.TrimEnd('/'))/api"
  & gh variable set API_BASE_URL --repo $Repository --body $ApiBaseUrl
  if ($LASTEXITCODE -ne 0) { throw 'GitHub API_BASE_URL 변수 갱신에 실패했습니다.' }
  & gh workflow run pages.yml --repo $Repository --ref main
  if ($LASTEXITCODE -ne 0) { throw 'GitHub Pages 재배포 요청에 실패했습니다.' }
  Write-SupervisorLog "GitHub Pages API 주소 갱신: $ApiBaseUrl"
}

function Save-ProcessState([Diagnostics.Process]$Server, [Diagnostics.Process]$Tunnel, [string]$TunnelUrl) {
  [pscustomobject]@{
    serverPid = $Server.Id
    tunnelPid = $Tunnel.Id
    tunnelUrl = $TunnelUrl
    updatedAt = (Get-Date).ToUniversalTime().ToString('o')
  } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $RuntimeDir 'processes.json') -Encoding UTF8
  Set-Content -LiteralPath (Join-Path $RuntimeDir 'quick-tunnel-url.txt') -Value $TunnelUrl -Encoding UTF8
}

$Port = [int](Get-EnvValue 'PORT' '8787')
$TunnelMode = (Get-EnvValue 'INTERIOR_TUNNEL_MODE' 'quick').ToLowerInvariant()
$Repository = Get-EnvValue 'GITHUB_REPOSITORY' 'ian939/interior-decision-board'
$TunnelName = Get-EnvValue 'INTERIOR_TUNNEL_NAME'
$Server = $null
$Tunnel = $null

try {
  $Server = Start-InteriorServer
  Wait-ForApi $Server $Port
  Write-SupervisorLog "로컬 API 시작: PID $($Server.Id)"

  if ($TunnelMode -eq 'named') {
    if (-not $TunnelName) { throw 'named 모드에는 INTERIOR_TUNNEL_NAME이 필요합니다.' }
    $Tunnel = Start-Process -FilePath 'cloudflared.exe' -ArgumentList @('tunnel', '--no-autoupdate', 'run', $TunnelName) -WorkingDirectory $ProjectRoot -WindowStyle Hidden -PassThru
    Write-SupervisorLog "Named Tunnel 시작: $TunnelName, PID $($Tunnel.Id)"
    Wait-Process -Id $Tunnel.Id
    throw 'Named Tunnel이 종료됐습니다.'
  }

  if ($TunnelMode -ne 'quick') { throw "지원하지 않는 터널 모드입니다: $TunnelMode" }
  while (-not $Server.HasExited) {
    try {
      $Quick = Start-QuickTunnel $Port
      $Tunnel = $Quick.Process
      Save-ProcessState $Server $Tunnel $Quick.Url
      Write-SupervisorLog "Quick Tunnel 시작: $($Quick.Url), PID $($Tunnel.Id)"

      if (-not $Probe) {
        $Published = $false
        for ($Attempt = 1; $Attempt -le 5 -and -not $Published; $Attempt += 1) {
          try {
            Publish-ApiUrl $Quick.Url $Repository
            $Published = $true
          } catch {
            Write-SupervisorLog "Pages 주소 갱신 $Attempt 회 실패: $($_.Exception.Message)"
            if ($Attempt -lt 5) { Start-Sleep -Seconds 10 }
          }
        }
        if (-not $Published) { throw 'Quick Tunnel 주소를 GitHub Pages에 반영하지 못했습니다.' }
      }

      if ($Probe) {
        $Health = Wait-ForRemoteApi $Tunnel $Quick.Url
        [pscustomobject]@{ ok = [bool]$Health.ok; tunnelUrl = $Quick.Url; serverPid = $Server.Id; tunnelPid = $Tunnel.Id } | ConvertTo-Json
        break
      }

      while (-not $Server.HasExited -and -not $Tunnel.HasExited) { Start-Sleep -Seconds 5 }
      if (-not $Server.HasExited) {
        Write-SupervisorLog 'Quick Tunnel이 종료되어 5초 후 새 주소로 다시 연결합니다.'
        Start-Sleep -Seconds 5
      }
    } catch {
      Write-SupervisorLog "Quick Tunnel 오류: $($_.Exception.Message)"
      if ($Probe) { throw }
      if (-not $Server.HasExited) { Start-Sleep -Seconds 10 }
    } finally {
      if ($Tunnel -and -not $Tunnel.HasExited) { Stop-Process -Id $Tunnel.Id -Force -ErrorAction SilentlyContinue }
      $Tunnel = $null
    }
  }
  if (-not $Probe) { throw '로컬 API가 종료됐습니다.' }
} finally {
  if ($Probe) {
    if ($Tunnel -and -not $Tunnel.HasExited) { Stop-Process -Id $Tunnel.Id -Force -ErrorAction SilentlyContinue }
    if ($Server -and -not $Server.HasExited) { Stop-Process -Id $Server.Id -Force -ErrorAction SilentlyContinue }
  }
}

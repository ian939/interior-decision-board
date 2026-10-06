param(
  [string]$ProposalUrl = 'https://ian939.github.io/proposal_apt/',
  [string]$BriefPath = 'input\이런스타일 수전, 수전 뽑아서 쓸 수 있고 밑에 폭포수 모드 있는.pptx'
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$AssetRoot = Join-Path $ProjectRoot 'apps\web\public\project-assets'
$PlanRoot = Join-Path $AssetRoot 'plans'
$ConceptRoot = Join-Path $AssetRoot 'concepts'
$BriefRoot = Join-Path $AssetRoot 'brief'
$ResolvedBrief = if ([IO.Path]::IsPathRooted($BriefPath)) { $BriefPath } else { Join-Path $ProjectRoot $BriefPath }

foreach ($Directory in @($PlanRoot, $ConceptRoot, $BriefRoot)) {
  New-Item -ItemType Directory -Path $Directory -Force | Out-Null
}

$Html = (Invoke-WebRequest -UseBasicParsing -Uri $ProposalUrl -TimeoutSec 60).Content
$Images = @([regex]::Matches($Html, '<img\s+[^>]*src="(data:image/([^;]+);base64,([^"]+))"[^>]*alt="([^"]*)"[^>]*>', 'IgnoreCase'))
$Targets = @(
  @{ Index = 0; Directory = $PlanRoot; Name = 'floorplan-base' },
  @{ Index = 1; Directory = $PlanRoot; Name = 'floorplan-points' },
  @{ Index = 2; Directory = $ConceptRoot; Name = 'entry-bath' },
  @{ Index = 3; Directory = $ConceptRoot; Name = 'bedroom-dressing' },
  @{ Index = 4; Directory = $ConceptRoot; Name = 'kitchen-floor' },
  @{ Index = 5; Directory = $ConceptRoot; Name = 'balcony-door' }
)

if ($Images.Count -lt $Targets.Count) { throw "제안 페이지에서 필요한 이미지를 찾지 못했습니다: $($Images.Count)개" }
foreach ($Target in $Targets) {
  $Match = $Images[$Target.Index]
  $MimeSubtype = $Match.Groups[2].Value.ToLowerInvariant()
  $Extension = switch -Regex ($MimeSubtype) {
    'jpeg|jpg' { 'jpg'; break }
    'png' { 'png'; break }
    'webp' { 'webp'; break }
    default { throw "지원하지 않는 이미지 형식입니다: $MimeSubtype" }
  }
  $OutputPath = Join-Path $Target.Directory "$($Target.Name).$Extension"
  [IO.File]::WriteAllBytes($OutputPath, [Convert]::FromBase64String($Match.Groups[3].Value))
  Write-Output "가져옴: $($Match.Groups[4].Value) -> $OutputPath"
}

if (-not (Test-Path -LiteralPath $ResolvedBrief)) { throw "PPTX를 찾을 수 없습니다: $ResolvedBrief" }
$PowerPoint = New-Object -ComObject PowerPoint.Application
try {
  $Presentation = $PowerPoint.Presentations.Open($ResolvedBrief, $true, $true, $false)
  try {
    for ($Index = 1; $Index -le $Presentation.Slides.Count; $Index += 1) {
      $OutputPath = Join-Path $BriefRoot ("slide-{0:D2}.jpg" -f $Index)
      $Presentation.Slides.Item($Index).Export($OutputPath, 'JPG', 1600, 900)
      Write-Output "슬라이드 내보냄: $Index/$($Presentation.Slides.Count)"
    }
  } finally {
    $Presentation.Close()
  }
} finally {
  $PowerPoint.Quit()
  [Runtime.InteropServices.Marshal]::FinalReleaseComObject($PowerPoint) | Out-Null
}

Write-Output '프로젝트 도면과 아이디어 자료 가져오기를 완료했습니다.'

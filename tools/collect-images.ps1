# Poll already-submitted image jobs until they resolve, download them,
# then submit + collect the 5 course cards that hit the concurrency cap.
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
$out  = Join-Path $root 'public\assets\img'
$gen  = Join-Path $root '.gen'
New-Item -ItemType Directory -Force -Path $out, $gen | Out-Null

function Wait-Job1 ($name, $id) {
  for ($i = 0; $i -lt 120; $i++) {
    $raw = & higgsfield generate get $id --json 2>&1 | Out-String
    try { $o = $raw | ConvertFrom-Json } catch { Start-Sleep 8; continue }
    if ($o.status -eq 'completed' -and $o.result_url) {
      $dest = Join-Path $out "$name.png"
      try {
        Invoke-WebRequest -Uri $o.result_url -OutFile $dest -UseBasicParsing
        Write-Host "  OK   $name  ($([math]::Round((Get-Item $dest).Length/1KB)) KB)"
        return $true
      } catch { Write-Host "  DLFAIL $name : $_"; return $false }
    }
    if ($o.status -in @('failed','canceled','error')) { Write-Host "  FAIL $name -> $($o.status)"; return $false }
    Start-Sleep 8
  }
  Write-Host "  TIMEOUT $name"; return $false
}

function Submit1 ($name, $ar, $prompt) {
  for ($try = 0; $try -lt 40; $try++) {
    $raw = & higgsfield generate create gpt_image_2 --prompt $prompt --aspect_ratio $ar --resolution 2k --quality high --json 2>&1 | Out-String
    if ($raw -match 'rate_limit_reached') { Start-Sleep 20; continue }
    $id = ([regex]'[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}').Match($raw).Value
    if ($id) { Write-Host "  submitted $name -> $id"; return $id }
    Write-Host "  submit error $name : $raw"; Start-Sleep 15
  }
  return $null
}

# ---- Phase 1: collect the 7 already in flight ----
Write-Host "== collecting in-flight jobs =="
$pending = Get-Content (Join-Path $gen 'image-jobs.json') -Raw | ConvertFrom-Json
foreach ($p in $pending) { Wait-Job1 $p.n $p.id | Out-Null }

# ---- Phase 2: the 5 course cards that were rate-limited ----
$warm = 'Warm color grade of cream, terracotta, deep cocoa brown and muted gold. No text, no letters, no writing, no logos, no watermarks, no signage.'
$rest = @(
  @{ n='course-02-tea';        a='3:2'; p="Editorial still life - a small glass cup of tea with visible steam beside an open blank notebook on a linen cloth, warm morning window light, soft shadows. Shallow depth of field, premium magazine photography. $warm" }
  @{ n='course-03-headphones'; a='3:2'; p="Editorial still life - a pair of tan leather over-ear headphones resting on a folded linen surface beside a small brass lamp, warm pooled lamplight, deep soft shadows. Shallow depth of field, premium magazine photography. $warm" }
  @{ n='course-04-notebook';   a='3:2'; p="Editorial still life - an open blank notebook with a dark fountain pen laid diagonally across it, warm raking afternoon light revealing the paper texture, completely blank pages with no writing whatsoever. Shallow depth of field, premium magazine photography. $warm" }
  @{ n='course-05-bokeh';      a='3:2'; p='Abstract warm lantern bokeh - large soft out-of-focus amber and terracotta orbs of light floating on a deep dark cocoa brown background, entirely defocused with no recognizable objects, gentle falloff toward the edges. Anamorphic bokeh, cinematic. No text, no logos.' }
  @{ n='course-06-desk';       a='3:2'; p="Editorial overhead flat lay looking straight down at a warm wooden desk - a blank open notebook, three pencils, a glass of tea, and a small trailing green plant arranged with generous negative space. Soft diffuse daylight. Premium magazine photography, no writing on the paper. $warm" }
)

Write-Host "== submitting remaining course cards =="
$batch2 = @()
foreach ($r in $rest) {
  $id = Submit1 $r.n $r.a $r.p
  if ($id) { $batch2 += @{ n=$r.n; id=$id } }
}
Write-Host "== collecting course cards =="
foreach ($b in $batch2) { Wait-Job1 $b.n $b.id | Out-Null }

Write-Host "ALL-IMAGES-DONE"
Get-ChildItem $out | Select-Object Name, @{n='KB';e={[math]::Round($_.Length/1KB)}} | Format-Table -AutoSize

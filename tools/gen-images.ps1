# Batch-generate every GLOW still via Higgsfield GPT Image 2.
# Submits all jobs first (so they render concurrently server-side), then waits and downloads.
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
$out  = Join-Path $root 'public\assets\img'
$gen  = Join-Path $root '.gen'
New-Item -ItemType Directory -Force -Path $out, $gen | Out-Null

$warm = 'Warm color grade of cream, terracotta, deep cocoa brown and muted gold. No text, no letters, no writing, no logos, no watermarks, no signage.'

$jobs = @(
  @{ n='hero-backplate'; a='3:2'; p="Soft-focus evening courtyard in Hoi An old town, dozens of silk lanterns glowing warm amber, heavy creamy bokeh, extremely low contrast, hazy and dreamlike like a faded film print. The composition is deliberately empty and uncluttered through the entire center-right third of the frame. No people in focus, only vague warm shapes. Shot on 85mm at f1.4, very shallow depth of field, gentle haze. $warm" }

  @{ n='chapter-01-study'; a='3:4'; p="Warm candid photograph of one person studying at a wooden desk beside a window in golden evening light, photographed from behind and over the shoulder so the face is never visible. Open notebook, pencil, a glass cup of tea, soft paper textures, warm lamp glow. Anonymous - only the back of the head and one hand. 35mm film grain, shallow depth of field. $warm" }

  @{ n='chapter-02-community'; a='3:4'; p="Small group of four people gathered around a low wooden table under warm hanging lantern light, photographed from behind and slightly above so no faces are visible at all - only backs, shoulders and gesturing hands. Notebooks and cups scattered on the table. Intimate, warm, unposed community feeling. 35mm film grain, shallow depth of field. $warm" }

  @{ n='chapter-03-celebration'; a='3:4'; p="Celebration moment - figures raising their hands and paper lanterns against a glowing warm evening sky, strongly backlit so every figure reads as a pure anonymous silhouette with no visible faces. Floating specks of warm light like drifting embers. Cinematic backlight, lens flare, 35mm film grain. $warm" }

  @{ n='texture-paper'; a='1:1'; p='Seamless tileable macro texture of handmade mulberry paper, subtle visible plant fibers and flecks, very fine grain, perfectly uniform flat lighting with no shadows, no vignette and no hotspots, edge-to-edge repeating pattern. Warm cream color. Extremely subtle, very low contrast, flat scan. No text, no logos, no objects.' }

  @{ n='texture-grain'; a='1:1'; p='Seamless tileable fine film grain texture, monochrome neutral gray analog noise on a flat mid-gray field, perfectly uniform density edge to edge, no vignette, no visible pattern, no banding, no clumping. Push-processed 35mm grain, flat scan. No text, no logos, no objects.' }

  @{ n='course-01-books'; a='3:2'; p="Editorial still life - a leaning stack of worn cloth-bound books on a warm wooden table, raking side light from a window, dust in the air. Blank covers and spines with absolutely no lettering. Shallow depth of field, premium magazine photography. $warm" }

  @{ n='course-02-tea'; a='3:2'; p="Editorial still life - a small glass cup of tea with visible steam beside an open blank notebook on a linen cloth, warm morning window light, soft shadows. Shallow depth of field, premium magazine photography. $warm" }

  @{ n='course-03-headphones'; a='3:2'; p="Editorial still life - a pair of tan leather over-ear headphones resting on a folded linen surface beside a small brass lamp, warm pooled lamplight, deep soft shadows. Shallow depth of field, premium magazine photography. $warm" }

  @{ n='course-04-notebook'; a='3:2'; p="Editorial still life - an open blank notebook with a dark fountain pen laid diagonally across it, warm raking afternoon light revealing the paper texture, completely blank pages with no writing whatsoever. Shallow depth of field, premium magazine photography. $warm" }

  @{ n='course-05-bokeh'; a='3:2'; p='Abstract warm lantern bokeh - large soft out-of-focus amber and terracotta orbs of light floating on a deep dark cocoa brown background, entirely defocused with no recognizable objects, gentle falloff toward the edges. Anamorphic bokeh, cinematic. No text, no logos.' }

  @{ n='course-06-desk'; a='3:2'; p="Editorial overhead flat lay looking straight down at a warm wooden desk - a blank open notebook, three pencils, a glass of tea, and a small trailing green plant arranged with generous negative space. Soft diffuse daylight. Premium magazine photography, no writing on the paper. $warm" }
)

# ---- Phase 1: submit everything ----
$submitted = @()
foreach ($j in $jobs) {
  Write-Host "submit $($j.n) ..."
  $raw = & higgsfield generate create gpt_image_2 --prompt $j.p --aspect_ratio $j.a --resolution 2k --quality high --json 2>&1 | Out-String
  $id = ([regex]'[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}').Match($raw).Value
  if ($id) { $submitted += @{ n=$j.n; id=$id }; Write-Host "   -> $id" }
  else { Write-Host "   !! no job id for $($j.n): $raw" }
}
$submitted | ConvertTo-Json | Out-File (Join-Path $gen 'image-jobs.json') -Encoding utf8

# ---- Phase 2: wait + download ----
foreach ($s in $submitted) {
  Write-Host "wait $($s.n) ..."
  & higgsfield generate wait $s.id --wait-timeout 20m 2>&1 | Out-Null
  $res = & higgsfield generate get $s.id --json 2>&1 | Out-String
  $url = ([regex]'https://[^"\s]+?\.(?:png|jpg|jpeg|webp)').Matches($res) | Select-Object -Last 1 -ExpandProperty Value
  if ($url) {
    $dest = Join-Path $out "$($s.n).png"
    Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing
    Write-Host "   saved $dest ($([math]::Round((Get-Item $dest).Length/1KB)) KB)"
  } else {
    Write-Host "   !! no image url for $($s.n)"
    $res | Out-File (Join-Path $gen "fail-$($s.n).json") -Encoding utf8
  }
}
Write-Host "DONE-IMAGES"

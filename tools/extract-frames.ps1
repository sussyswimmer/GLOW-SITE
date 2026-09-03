# Turn a turntable take into the 120-frame WebP sequence the canvas scrubs.
# Usage: .\extract-frames.ps1 -Video ".gen\lantern-turntable.mp4" [-Count 120] [-Size 1000] [-Quality 70]
param(
  [string]$Video   = ".gen\lantern-turntable.mp4",
  [int]$Count      = 120,
  [int]$Size       = 1000,
  [int]$Quality    = 70,
  [switch]$KeyWhite          # cut a white backdrop to alpha
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$src = Join-Path $root $Video
if (-not (Test-Path $src)) { throw "no video at $src" }

$tmp = Join-Path $root '.gen\allframes'
$out = Join-Path $root 'public\assets\seq\prism'
Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $out '*.webp') -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $tmp, $out | Out-Null

# 1. every source frame, scaled down once with a good filter
Write-Host "extracting source frames ..."
& ffmpeg -y -v error -i $src -vf "scale=${Size}:${Size}:flags=lanczos" -start_number 0 (Join-Path $tmp '%04d.png')

$all = Get-ChildItem $tmp -Filter '*.png' | Sort-Object Name
Write-Host "  got $($all.Count) source frames"
if ($all.Count -lt $Count) { throw "only $($all.Count) frames, need $Count" }

# 2. pick $Count of them, evenly spaced across the take
Write-Host "resampling to $Count frames ..."
$picked = for ($i = 0; $i -lt $Count; $i++) {
  $idx = [math]::Round($i * ($all.Count - 1) / ($Count - 1))
  $all[$idx].FullName
}

# 3. renumber the picks into a clean sequence, then one ffmpeg pass -> WebP
$pick = Join-Path $root '.gen\pick'
Remove-Item $pick -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $pick | Out-Null
for ($i = 0; $i -lt $picked.Count; $i++) {
  Copy-Item $picked[$i] (Join-Path $pick ("{0:D4}.png" -f ($i + 1))) -Force
}

# Alpha from distance-to-white. The plate sits at a flat 247 and the lantern's
# darkest channel at 29, so the separation is enormous — but video compression
# plus the Lanczos downscale ring the backdrop down to ~240 in places, and any
# residual alpha shows as a pale square over the darker chapter photos. The
# tolerance is set to swallow that ringing outright; at 20 it is still 200+
# levels clear of anything belonging to the lantern.
$vf = if ($KeyWhite) {
  # Measured: the light plate sits at ~235 with a soft vignette, and the amber
  # glass bottoms out near 120. Clear anything at or above 228, ramp to solid
  # by 196 — wide enough to swallow the vignette without eating the glass.
  "format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='clip((228-min(r(X,Y),min(g(X,Y),b(X,Y))))*8,0,255)'"
} else { "null" }

& ffmpeg -y -v error -i (Join-Path $pick '%04d.png') -vf $vf `
  -c:v libwebp -quality $Quality -compression_level 6 -preset picture `
  -start_number 1 (Join-Path $out 'frame_%04d.webp')

Remove-Item $pick -Recurse -Force -ErrorAction SilentlyContinue

$made = Get-ChildItem $out -Filter '*.webp'
$mb = [math]::Round((($made | Measure-Object Length -Sum).Sum) / 1MB, 2)
Write-Host "wrote $($made.Count) frames, $mb MB total"

# a still for reduced-motion / fallback
Copy-Item (Join-Path $out 'frame_0001.webp') (Join-Path $root 'public\assets\img\prism-still.webp') -Force

Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "FRAMES-DONE"

# PNG -> WebP at sensible delivery sizes. Keeps the PNGs in .gen as masters.
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
$img  = Join-Path $root 'public\assets\img'
$mast = Join-Path $root '.gen\masters'
New-Item -ItemType Directory -Force -Path $mast | Out-Null

# name -> max width, quality
$spec = @{
  'hero-backplate'         = @(2400, 72)
  'chapter-01-study'       = @(1400, 78)
  'chapter-02-community'   = @(1400, 78)
  'chapter-03-celebration' = @(1400, 78)
  'texture-paper'          = @(1024, 80)
  'texture-grain'          = @( 512, 82)
  'course-01-books'        = @( 900, 78)
  'course-02-tea'          = @( 900, 78)
  'course-03-headphones'   = @( 900, 78)
  'course-04-notebook'     = @( 900, 78)
  'course-05-bokeh'        = @( 900, 78)
  'course-06-desk'         = @( 900, 78)
}

foreach ($png in Get-ChildItem $img -Filter '*.png') {
  $name = [IO.Path]::GetFileNameWithoutExtension($png.Name)
  $s = $spec[$name]
  if (-not $s) { $s = @(1200, 78) }
  $w = $s[0]; $qy = $s[1]
  $dest = Join-Path $img "$name.webp"

  & ffmpeg -y -v error -i $png.FullName `
    -vf "scale='min($w,iw)':-2:flags=lanczos" `
    -c:v libwebp -quality $qy -compression_level 6 -preset picture $dest

  if (Test-Path $dest) {
    Move-Item $png.FullName (Join-Path $mast $png.Name) -Force
    Write-Host ("  {0,-24} {1,5} KB -> {2,5} KB" -f $name, [math]::Round($png.Length/1KB), [math]::Round((Get-Item $dest).Length/1KB))
  } else {
    Write-Host "  FAILED $name"
  }
}

$tot = (Get-ChildItem $img -Filter '*.webp' | Measure-Object Length -Sum).Sum
Write-Host ("img total: {0} MB" -f [math]::Round($tot/1MB,2))
$seq = (Get-ChildItem (Join-Path $root 'public\assets\seq\lantern') -Filter '*.webp' | Measure-Object Length -Sum).Sum
Write-Host ("seq total: {0} MB" -f [math]::Round($seq/1MB,2))
Write-Host "OPTIMIZE-DONE"

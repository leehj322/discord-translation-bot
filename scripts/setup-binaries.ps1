$ErrorActionPreference = 'Stop'

function Ensure-Tls12 {
  try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}
}

$Root = (Resolve-Path "$PSScriptRoot/..\").Path
$Bin = Join-Path $Root 'bin'
New-Item -ItemType Directory -Force -Path $Bin | Out-Null

Ensure-Tls12

# deno (Windows zip)
$DenoExe = Join-Path $Bin 'deno.exe'
if (-not (Test-Path $DenoExe)) {
  Write-Host 'Downloading deno (windows x86_64) ...'
  $zip = Join-Path $env:TEMP 'deno.zip'
  Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/denoland/deno/releases/latest/download/deno-x86_64-pc-windows-msvc.zip' -OutFile $zip
  Expand-Archive -Path $zip -DestinationPath $Bin -Force
  Remove-Item $zip -Force
}

# yt-dlp (Windows exe)
$Yt = Join-Path $Bin 'yt-dlp.exe'
if (-not (Test-Path $Yt)) {
  Write-Host 'Downloading yt-dlp.exe ...'
  Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe' -OutFile $Yt
}

Write-Host "Binaries ready at $Bin"



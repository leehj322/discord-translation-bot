$ErrorActionPreference = 'Stop'

$Root = (Resolve-Path "$PSScriptRoot/..\").Path
$Bin = Join-Path $Root 'bin'
$env:Path = "$Bin;$env:Path"

node "$Root/dist/bot.js"



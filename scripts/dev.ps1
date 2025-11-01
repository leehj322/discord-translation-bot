$ErrorActionPreference = 'Stop'

$Root = (Resolve-Path "$PSScriptRoot/..\").Path
$Bin = Join-Path $Root 'bin'
$env:Path = "$Bin;$env:Path"

npx --yes tsx "$Root/src/bot.ts"



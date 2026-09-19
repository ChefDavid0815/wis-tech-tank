$ErrorActionPreference = 'Stop'
$strideRoot = Split-Path -Parent $PSScriptRoot
$strideReleaseRoot = Join-Path $strideRoot 'release'
$stridePackage = Join-Path $strideReleaseRoot 'STRIDE-0.2-Windows'
New-Item -ItemType Directory -Path $stridePackage -Force | Out-Null
foreach ($strideFolder in @('dist', 'runtime', 'licenses', 'src')) {
    Copy-Item -LiteralPath (Join-Path $strideRoot $strideFolder) -Destination $stridePackage -Recurse -Force
}
New-Item -ItemType Directory -Path (Join-Path $stridePackage 'scripts') -Force | Out-Null
foreach ($strideScript in @('start.ps1', 'server.mjs')) {
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot $strideScript) -Destination (Join-Path $stridePackage 'scripts') -Force
}
foreach ($strideFile in @('启动完整演示.cmd', '打开演示.html', 'README.md', '演示讲稿.md', 'THIRD-PARTY.md', 'VERIFICATION.md')) {
    Copy-Item -LiteralPath (Join-Path $strideRoot $strideFile) -Destination $stridePackage -Force
}
New-Item -ItemType Directory -Path (Join-Path $stridePackage 'verification') -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $strideRoot 'artifacts\browser-check.json') -Destination (Join-Path $stridePackage 'verification\browser-check.json') -Force
@'
This is the prebuilt Windows x64 presentation package.
Run the launcher without installing dependencies.
The src folder is included for explaining the prototype code during the presentation.
For development, use the complete workspace with package.json, tests, scripts and public assets.
'@ | Set-Content -LiteralPath (Join-Path $stridePackage 'PACKAGE-NOTES.txt') -Encoding UTF8
$strideZip = Join-Path $strideReleaseRoot 'STRIDE-0.2-Windows.zip'
Compress-Archive -LiteralPath $stridePackage -DestinationPath $strideZip -CompressionLevel Optimal -Force
$strideHash = Get-FileHash -LiteralPath $strideZip -Algorithm SHA256
($strideHash.Hash.ToLower() + '  STRIDE-0.2-Windows.zip') | Set-Content -LiteralPath (Join-Path $strideReleaseRoot 'SHA256SUMS.txt') -Encoding ASCII
Get-Item -LiteralPath $strideZip | Select-Object FullName, Length
$strideHash | Select-Object Algorithm, Hash

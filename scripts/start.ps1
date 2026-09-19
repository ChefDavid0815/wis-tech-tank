$ErrorActionPreference = 'Stop'
$strideRoot = Split-Path -Parent $PSScriptRoot
$strideRuntime = Join-Path $strideRoot 'runtime\node.exe'
if (-not (Test-Path -LiteralPath $strideRuntime)) {
    $strideCommand = Get-Command node -ErrorAction SilentlyContinue
    if (-not $strideCommand) { throw 'Node.js was not found. Use the portable STRIDE package, or install Node.js 22+.' }
    $strideRuntime = $strideCommand.Source
}
$stridePort = if ($env:STRIDE_PORT) { [int]$env:STRIDE_PORT } else { 4173 }
try { $strideHealth = Invoke-RestMethod -Uri "http://127.0.0.1:$stridePort/health" -TimeoutSec 2 } catch { $strideHealth = $null }
if ($strideHealth.app -ne 'stride-local') {
    $strideLog = Join-Path $strideRoot 'artifacts'
    New-Item -ItemType Directory -Path $strideLog -Force | Out-Null
    $strideServer = Join-Path $PSScriptRoot 'server.mjs'
    $strideProcess = Start-Process -FilePath $strideRuntime -ArgumentList @('"' + $strideServer + '"') -WorkingDirectory $strideRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $strideLog 'server.log') -RedirectStandardError (Join-Path $strideLog 'server-error.log') -PassThru
    $strideReady = $false
    for ($strideAttempt=0; $strideAttempt -lt 20; $strideAttempt++) {
        Start-Sleep -Milliseconds 300
        try { $strideHealth = Invoke-RestMethod -Uri "http://127.0.0.1:$stridePort/health" -TimeoutSec 1; if ($strideHealth.app -eq 'stride-local') { $strideReady=$true; break } } catch {}
        if ($strideProcess.HasExited) { break }
    }
    if (-not $strideReady) { throw "Cannot start STRIDE. Port $stridePort may be in use. See artifacts/server-error.log." }
}
Start-Process "http://127.0.0.1:$stridePort"

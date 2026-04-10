#Requires -Version 5.1
<#
.SYNOPSIS
  Retained procfs snapshot demo: collector (retained loop + fixture) + bridge + authenticated GET.
  Provisional TCP F-IPC; not live WS deltas. See docs/DEMO_RETAINED_SNAPSHOT.md
#>
$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Resolve-Path (Join-Path $ScriptDir '..\..')
Set-Location $RepoRoot

if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    throw 'demo.ps1: cargo not on PATH (install Rust from https://rustup.rs). See docs/DEMO_RETAINED_SNAPSHOT.md.'
}

$Fixture = Join-Path $ScriptDir 'raw_observations_demo.json'
if (-not (Test-Path $Fixture)) { throw "Missing fixture: $Fixture" }

$ipcSecret = if ($env:IPC_SECRET) { $env:IPC_SECRET } else { 'retained-demo-fipc' }
$httpToken = if ($env:HTTP_TOKEN) { $env:HTTP_TOKEN } else { 'retained-demo-http' }

function Get-FreePort {
    $l = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
    $l.Start()
    $p = $l.LocalEndpoint.Port
    $l.Stop()
    return $p
}

$ipcPort = if ($env:IPC_PORT) { [int]$env:IPC_PORT } else { Get-FreePort }
$bridgePort = if ($env:BRIDGE_PORT) { [int]$env:BRIDGE_PORT } else { Get-FreePort }

Write-Host 'Building glass-collector + glass_bridge (if needed)...'
& cargo build -q -p glass_collector -p glass_bridge
if ($LASTEXITCODE -ne 0) { throw 'cargo build failed' }

$targetDir = Join-Path $RepoRoot 'target\debug'
$collectorExe = Join-Path $targetDir 'glass-collector.exe'
$bridgeExe = Join-Path $targetDir 'glass_bridge.exe'
if (-not (Test-Path $collectorExe)) { throw "Missing $collectorExe" }
if (-not (Test-Path $bridgeExe)) { throw "Missing $bridgeExe" }

$collectorArgs = @(
    'ipc-serve',
    '--listen', "127.0.0.1:$ipcPort",
    '--shared-secret', $ipcSecret,
    '--procfs-retained-session', 'demo_retained_sess',
    '--procfs-from-raw-json', $Fixture,
    '--procfs-retained-interval-ms', '250',
    '--procfs-retained-max-events', '64'
)
$bridgeArgs = @(
    '--listen', "127.0.0.1:$bridgePort",
    '--token', $httpToken,
    '--collector-ipc-endpoint', "127.0.0.1:$ipcPort",
    '--collector-ipc-secret', $ipcSecret
)

Write-Host "Starting collector on 127.0.0.1:$ipcPort ..."
$collectorProc = Start-Process -FilePath $collectorExe -ArgumentList $collectorArgs -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 0.6

Write-Host "Starting bridge on 127.0.0.1:$bridgePort ..."
$bridgeProc = Start-Process -FilePath $bridgeExe -ArgumentList $bridgeArgs -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 0.5

try {
    $url = "http://127.0.0.1:$bridgePort/sessions/demo_retained_sess/snapshot"
    Write-Host "GET $url"
    $headers = @{ Authorization = "Bearer $httpToken" }
    $resp = Invoke-RestMethod -Uri $url -Headers $headers -Method Get

    if ($resp.session_id -ne 'demo_retained_sess') { throw 'unexpected session_id' }
    if ($resp.live_session_ingest -ne $false) { throw 'live_session_ingest must be false' }
    if ($null -eq $resp.retained_snapshot_unix_ms) { throw 'retained_snapshot_unix_ms should be set' }
    if ($resp.events.Count -lt 1) { throw 'expected at least one event' }
    if ($resp.snapshot_cursor -notmatch '^v0:') { throw 'unexpected snapshot_cursor' }

    $resp | ConvertTo-Json -Depth 12
    Write-Host 'OK: demo assertions passed.'
}
finally {
    if ($bridgeProc -and -not $bridgeProc.HasExited) { Stop-Process -Id $bridgeProc.Id -Force -ErrorAction SilentlyContinue }
    if ($collectorProc -and -not $collectorProc.HasExited) { Stop-Process -Id $collectorProc.Id -Force -ErrorAction SilentlyContinue }
}

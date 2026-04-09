$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "== Glass bootstrap check =="
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) { throw "cargo missing" }

cargo fmt --all -- --check
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
cargo clippy --workspace --all-targets -- -D warnings
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
cargo test --workspace
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if (Get-Command npm -ErrorAction SilentlyContinue) {
    Set-Location (Join-Path $Root "viewer")
    if (Test-Path "package-lock.json") { npm ci } else { npm install }
    npm run build
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    npm test
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    npm run lint
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    Set-Location $Root
} else {
    Write-Warning "npm not found; skip viewer build/test"
}

Write-Host "OK"

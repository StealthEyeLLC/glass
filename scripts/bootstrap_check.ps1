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
    if (Test-Path "package-lock.json") {
        npm ci
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "npm ci failed; retrying with npm install (common on Windows when local file locks block a clean reinstall)"
            npm install
        }
    } else {
        npm install
    }
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    npm run build
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    npm test
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    npm run lint
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    npm run verify:vertical-slice-fixture
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    npm run verify:canonical-scenarios-v15
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    Set-Location $Root
} else {
    Write-Warning "npm not found; skip viewer build/test"
}

Write-Host "OK"

#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== Glass bootstrap check =="
command -v cargo >/dev/null || { echo "cargo missing"; exit 1; }

cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace

if command -v npm >/dev/null; then
  cd viewer
  if [[ -f package-lock.json ]]; then
    if ! npm ci; then
      echo "WARN: npm ci failed; retrying with npm install (common on Windows when local file locks block a clean reinstall)"
      npm install
    fi
  else
    npm install
  fi
  npm run build
  npm test
  npm run lint
  npm run verify:vertical-slice-fixture
  npm run verify:canonical-scenarios-v15
  cd "$ROOT"
else
  echo "WARN: npm not found; skip viewer build/test"
fi

echo "OK"

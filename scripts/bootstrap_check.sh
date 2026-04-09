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
    npm ci
  else
    npm install
  fi
  npm run build
  npm test
  npm run lint
  cd "$ROOT"
else
  echo "WARN: npm not found; skip viewer build/test"
fi

echo "OK"

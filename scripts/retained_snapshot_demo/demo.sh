#!/usr/bin/env bash
# Retained procfs snapshot demo: collector (retained loop + fixture) + bridge + authenticated GET.
# Provisional TCP F-IPC; not live WS deltas. See docs/DEMO_RETAINED_SNAPSHOT.md
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

FIXTURE="$SCRIPT_DIR/raw_observations_demo.json"
IPC_SECRET="${IPC_SECRET:-retained-demo-fipc}"
HTTP_TOKEN="${HTTP_TOKEN:-retained-demo-http}"

pick_port() {
  python3 -c "import socket; s=socket.socket(); s.bind(('127.0.0.1',0)); print(s.getsockname()[1]); s.close()"
}

IPC_PORT="${IPC_PORT:-$(pick_port)}"
BRIDGE_PORT="${BRIDGE_PORT:-$(pick_port)}"

echo "Building glass-collector + glass_bridge (if needed)..."
cargo build -q -p glass_collector -p glass_bridge

COLLECTOR_BIN="$REPO_ROOT/target/debug/glass-collector"
BRIDGE_BIN="$REPO_ROOT/target/debug/glass_bridge"
if [[ ! -x "$COLLECTOR_BIN" ]]; then
  echo "Missing $COLLECTOR_BIN"
  exit 1
fi
if [[ ! -x "$BRIDGE_BIN" ]]; then
  echo "Missing $BRIDGE_BIN"
  exit 1
fi

cleanup() {
  [[ -n "${BRIDGE_PID:-}" ]] && kill "$BRIDGE_PID" 2>/dev/null || true
  [[ -n "${COLLECTOR_PID:-}" ]] && kill "$COLLECTOR_PID" 2>/dev/null || true
}
trap cleanup EXIT

echo "Starting collector ipc-serve on 127.0.0.1:$IPC_PORT (retained + fixture)..."
"$COLLECTOR_BIN" ipc-serve \
  --listen "127.0.0.1:$IPC_PORT" \
  --shared-secret "$IPC_SECRET" \
  --procfs-retained-session demo_retained_sess \
  --procfs-from-raw-json "$FIXTURE" \
  --procfs-retained-interval-ms 250 \
  --procfs-retained-max-events 64 &
COLLECTOR_PID=$!

echo "Waiting for first retained poll..."
sleep 0.6

echo "Starting bridge on 127.0.0.1:$BRIDGE_PORT..."
"$BRIDGE_BIN" \
  --listen "127.0.0.1:$BRIDGE_PORT" \
  --token "$HTTP_TOKEN" \
  --collector-ipc-endpoint "127.0.0.1:$IPC_PORT" \
  --collector-ipc-secret "$IPC_SECRET" &
BRIDGE_PID=$!

sleep 0.5

URL="http://127.0.0.1:$BRIDGE_PORT/sessions/demo_retained_sess/snapshot"
echo "GET $URL"
curl -sS -f \
  -H "Authorization: Bearer $HTTP_TOKEN" \
  "$URL" | tee /tmp/glass_retained_demo_snapshot.json
echo ""

python3 - <<'PY'
import json, os, sys
path = "/tmp/glass_retained_demo_snapshot.json"
if not os.path.exists(path):
    print("missing output file", file=sys.stderr)
    sys.exit(1)
j = json.load(open(path))
assert j.get("session_id") == "demo_retained_sess"
assert j.get("live_session_ingest") is False
assert j.get("retained_snapshot_unix_ms") is not None
assert len(j.get("events") or []) >= 1
assert j.get("snapshot_cursor", "").startswith("v0:")
print("OK: non-empty snapshot, retained_snapshot_unix_ms set, live_session_ingest false")
PY

echo "Demo finished successfully."

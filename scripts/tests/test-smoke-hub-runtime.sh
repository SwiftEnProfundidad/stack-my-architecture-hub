#!/usr/bin/env bash

set -euo pipefail

export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SMOKE_SCRIPT="$HUB_ROOT/scripts/smoke-hub-runtime.sh"

TMP_DIR="$(mktemp -d)"
FAKE_BRIDGE_DIR="$TMP_DIR/fake-bridge"
LOG_FILE="$TMP_DIR/smoke-runtime.out"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

mkdir -p "$FAKE_BRIDGE_DIR"

cat >"$FAKE_BRIDGE_DIR/fake-server.py" <<'EOF'
#!/usr/bin/env python3
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ["PORT"])


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        body = ""
        content_type = "text/html; charset=utf-8"

        if self.path == "/health":
            content_type = "application/json"
            body = json.dumps({"ok": True, "service": "assistant-bridge", "query_path": "/assistant/query"}, separators=(",", ":"))
        elif self.path == "/config":
            content_type = "application/json"
            body = json.dumps({"ok": True, "query_path": "/assistant/query"}, separators=(",", ":"))
        elif self.path == "/index.html":
            body = "<html><body>Stack My Architecture · Cursos</body></html>"
        elif self.path == "/ios/index.html":
            body = "<html><body><meta name=\"course-id\" content=\"stack-my-architecture-ios\"></body></html>"
        elif self.path == "/android/index.html":
            body = "<html><body><meta name=\"course-id\" content=\"stack-my-architecture-android\"></body></html>"
        elif self.path == "/sdd/index.html":
            body = "<html><body><meta name=\"course-id\" content=\"stack-my-architecture-sdd\"></body></html>"
        elif self.path == "/ios/assets/study-ux.js":
            content_type = "application/javascript"
            body = "(function () { console.log('ios'); })();"
        elif self.path in ("/ios/assets/assistant-panel.js", "/android/assets/assistant-panel.js"):
            content_type = "application/javascript"
            body = "const KEY_PROVIDER = 'provider';"
        elif self.path == "/sdd/assets/assistant-panel.js":
            content_type = "application/javascript"
            body = "const KEY_DAILY_BUDGET = 'budget';"
        else:
            self.send_response(404)
            self.end_headers()
            return

        encoded = body.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def log_message(self, format, *args):
        return


ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
EOF

chmod +x "$FAKE_BRIDGE_DIR/fake-server.py"

if ! SMA_RUNTIME_SMOKE_BRIDGE_DIR="$FAKE_BRIDGE_DIR" \
  SMA_RUNTIME_SMOKE_SERVER_CMD="python3 \"$FAKE_BRIDGE_DIR/fake-server.py\"" \
  SMA_RUNTIME_SMOKE_SKIP_INSTALL=1 \
  "$SMOKE_SCRIPT" >"$LOG_FILE" 2>&1; then
  cat "$LOG_FILE"
  exit 1
fi

grep -q "\[OK\] Runtime smoke test passed" "$LOG_FILE"

echo "[PASS] smoke-hub-runtime tests"

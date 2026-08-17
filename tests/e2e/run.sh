#!/usr/bin/env bash
# ============================================================
#  รัน E2E test ทั้งชุด
#  ใช้แค่ python3 (เปิดเว็บเซิร์ฟเวอร์) + Google Chrome (headless)
#  ไม่ต้องติดตั้ง node หรือแพ็กเกจใด ๆ
#
#    ./tests/e2e/run.sh
#    PORT=8200 ./tests/e2e/run.sh
#    CHROME="/path/to/chrome" ./tests/e2e/run.sh
# ============================================================
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PORT="${PORT:-8123}"
TIMEOUT_MS="${TIMEOUT_MS:-180000}"

find_chrome() {
  if [ -n "${CHROME:-}" ]; then echo "$CHROME"; return; fi
  for c in \
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    "/Applications/Chromium.app/Contents/MacOS/Chromium" \
    "$(command -v google-chrome 2>/dev/null)" \
    "$(command -v chromium 2>/dev/null)" \
    "$(command -v chromium-browser 2>/dev/null)"; do
    [ -n "$c" ] && [ -x "$c" ] && { echo "$c"; return; }
  done
}

CHROME_BIN="$(find_chrome)"
if [ -z "$CHROME_BIN" ]; then
  echo "ไม่พบ Google Chrome — ระบุเองด้วย CHROME=/path/to/chrome ./tests/e2e/run.sh" >&2
  exit 127
fi

python3 -m http.server "$PORT" --directory "$ROOT" >/dev/null 2>&1 &
SERVER_PID=$!
cleanup() { kill "$SERVER_PID" 2>/dev/null || true; }
trap cleanup EXIT

# รอให้เซิร์ฟเวอร์พร้อม
for _ in $(seq 1 40); do
  if curl -sf "http://localhost:$PORT/index.html" >/dev/null 2>&1; then break; fi
  sleep 0.25
done

echo "▶ รัน E2E ที่ http://localhost:$PORT/tests/e2e/runner.html"

DOM="$("$CHROME_BIN" \
  --headless=new --disable-gpu --no-sandbox --no-first-run \
  --hide-scrollbars --window-size=1600,1000 \
  --virtual-time-budget="$TIMEOUT_MS" \
  --dump-dom "http://localhost:$PORT/tests/e2e/runner.html" 2>/dev/null)"

printf '%s' "$DOM" | python3 "$ROOT/tests/e2e/report.py"

#!/usr/bin/env bash
# Start LanguageTool in the background, then FastAPI in the foreground.
# When FastAPI exits, kill LanguageTool and propagate the exit code.

set -euo pipefail

echo "[entrypoint] Starting LanguageTool server on :8010…"
java -Xms256m -Xmx1g -cp /opt/languagetool/languagetool-server.jar \
  org.languagetool.server.HTTPServer \
  --port 8010 --allow-origin "*" \
  > /var/log/languagetool.log 2>&1 &
LT_PID=$!

cleanup() {
  echo "[entrypoint] Shutting down LanguageTool (pid $LT_PID)…"
  kill "$LT_PID" 2>/dev/null || true
  wait "$LT_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Wait for LanguageTool to be reachable (up to ~60s).
echo "[entrypoint] Waiting for LanguageTool to warm up…"
for i in {1..30}; do
  if curl -fsS "http://localhost:8010/v2/languages" > /dev/null 2>&1; then
    echo "[entrypoint] LanguageTool ready."
    break
  fi
  sleep 2
done

echo "[entrypoint] Starting FastAPI on :${PORT:-7860}…"
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-7860}"

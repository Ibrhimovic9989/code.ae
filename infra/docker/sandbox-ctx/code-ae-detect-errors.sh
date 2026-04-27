#!/usr/bin/env bash
# code-ae-detect-errors — stack-aware preview probe + log scrape.
#
# Single command the API's DetectErrorsUseCase invokes; emits a stable
# marker-tagged stdout the use case parses. Avoids the previous
# inline-bash-from-the-API approach where the script lived in two places.
#
# Stack detection: .code-ae/stack.json takes priority; falls back to
# sniffing package.json deps so projects without the marker still work.

set +e

cd /home/workspace/project 2>/dev/null || {
  echo "CAE_STATUS=000"
  echo "CAE_STACK=no-workspace"
  echo "CAE_BODY_START"
  echo "CAE_BODY_END"
  echo "CAE_LOG_START"
  echo "CAE_LOG_END"
  exit 0
}

# ── Stack ──────────────────────────────────────────────────────────────────
STACK="unknown"
if [ -f .code-ae/stack.json ]; then
  STACK=$(grep -oE '"stack"[[:space:]]*:[[:space:]]*"[^"]+"' .code-ae/stack.json \
          | head -1 | sed -E 's/.*"([^"]+)"$/\1/')
fi
if [ "$STACK" = "unknown" ] && [ -f package.json ]; then
  if grep -qE '"next"[[:space:]]*:' package.json 2>/dev/null; then STACK="next"
  elif grep -qE '"vite"[[:space:]]*:' package.json 2>/dev/null; then STACK="vite-react"
  fi
fi

# ── Probe ──────────────────────────────────────────────────────────────────
STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:3000 2>/dev/null || echo "000")
BODY=$(curl -s --max-time 3 http://localhost:3000 2>/dev/null)

# Cap body so the API's stdout buffer (1 MB ring) never drops the markers.
BODY_SAMPLE=$(echo "$BODY" | head -c 4000)

# ── dev.log tail ───────────────────────────────────────────────────────────
LOG_TAIL=$(tail -c 16000 /tmp/dev.log 2>/dev/null)

echo "CAE_STATUS=$STATUS"
echo "CAE_STACK=$STACK"
echo "CAE_BODY_START"
echo "$BODY_SAMPLE"
echo "CAE_BODY_END"
echo "CAE_LOG_START"
echo "$LOG_TAIL"
echo "CAE_LOG_END"

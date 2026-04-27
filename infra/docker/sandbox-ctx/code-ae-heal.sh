#!/usr/bin/env bash
# code-ae-heal — stack-aware dev-server heal recipe baked into the sandbox.
#
# Reads .code-ae/stack.json to dispatch to the right cache + restart logic.
# Vite, Next, and unknown stacks all share the same port-3000 kill + warm-up;
# only the cache-clear step differs (rm -rf .next vs node_modules/.vite vs
# nothing).
#
# Exit semantics: always exit 0; the LAST stdout line is a single
# CAE_RESULT=<verdict> marker the API's HealPreviewUseCase parses.

set +e

cd /home/workspace/project 2>/dev/null || { echo "CAE_RESULT=no-workspace"; exit 0; }
[ -f package.json ] || { echo "CAE_RESULT=no-package-json"; exit 0; }

# ── Stack detection ────────────────────────────────────────────────────────
STACK="unknown"
if [ -f .code-ae/stack.json ]; then
  STACK=$(grep -oE '"stack"[[:space:]]*:[[:space:]]*"[^"]+"' .code-ae/stack.json \
          | head -1 | sed -E 's/.*"([^"]+)"$/\1/')
fi
# Fallback: sniff package.json scripts/deps when the marker is absent.
if [ "$STACK" = "unknown" ]; then
  if grep -qE '"(next)"[[:space:]]*:' package.json 2>/dev/null; then STACK="next"
  elif grep -qE '"(vite)"[[:space:]]*:' package.json 2>/dev/null; then STACK="vite-react"
  fi
fi

# Per-stack cache directory + healthy-body markers we want to AVOID seeing.
case "$STACK" in
  next)
    CACHE_DIR=".next"
    BAD_PATTERNS="Module not found|Failed to compile|Internal Server Error|ENOENT|Build Error"
    ;;
  vite-react)
    CACHE_DIR="node_modules/.vite"
    BAD_PATTERNS="\\[vite\\] Internal server error|Failed to resolve import|Transform failed"
    ;;
  *)
    CACHE_DIR=""
    BAD_PATTERNS="Internal Server Error|Application error"
    ;;
esac

# ── Fast path ───────────────────────────────────────────────────────────────
# Already serving a clean 200? Don't touch the running dev server.
STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:3000 2>/dev/null)
if [ "$STATUS" = "200" ]; then
  BODY=$(curl -s --max-time 3 http://localhost:3000 2>/dev/null)
  if ! echo "$BODY" | grep -qE "$BAD_PATTERNS"; then
    echo "CAE_RESULT=healed in 0s (already-healthy, stack=${STACK})"
    exit 0
  fi
fi

# ── Deps ────────────────────────────────────────────────────────────────────
if [ ! -d node_modules ]; then
  bun install --no-summary >/dev/null 2>&1 || { echo "CAE_RESULT=install-failed"; exit 0; }
fi

# ── Kill anything on port 3000 via /proc (no pkill needed) ──────────────────
find_port_pids() {
  local inodes
  inodes=$(awk '$2 ~ /:0BB8$/ && $4 == "0A" {print $10}' /proc/net/tcp 2>/dev/null
           awk '$2 ~ /:0BB8$/ && $4 == "0A" {print $10}' /proc/net/tcp6 2>/dev/null)
  [ -z "$inodes" ] && return
  for p in /proc/[0-9]*; do
    for i in $inodes; do
      if ls -l "$p/fd" 2>/dev/null | grep -q "socket:\\[$i\\]"; then
        basename "$p"
      fi
    done
  done | sort -u
}

for pid in $(find_port_pids); do
  kill -9 "$pid" 2>/dev/null
done

# Belt-and-suspenders against orphaned dev processes.
command -v pkill >/dev/null 2>&1 && {
  case "$STACK" in
    next) pkill -9 -f "next" 2>/dev/null ;;
    vite-react) pkill -9 -f "vite" 2>/dev/null ;;
  esac
  pkill -9 -f "bun.*dev" 2>/dev/null
  pkill -9 -f "node.*dev" 2>/dev/null
}

sleep 2

STILL=$(find_port_pids)
if [ -n "$STILL" ]; then
  echo "CAE_RESULT=port-stuck"
  exit 0
fi

# ── Clean stack-specific cache; relaunch dev detached ──────────────────────
[ -n "$CACHE_DIR" ] && rm -rf "$CACHE_DIR"
> /tmp/dev.log

setsid nohup bash -c 'HOSTNAME=0.0.0.0 HOST=0.0.0.0 PORT=3000 exec bun run dev' \
  > /tmp/dev.log 2>&1 < /dev/null &

# ── Warm-up. Vite boots in 1-3s, Next in 15-60s — share the loop, both
#    fall well under the 120s ceiling.
HEALED=""
for i in $(seq 1 120); do
  sleep 1
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:3000 2>/dev/null)
  if [ "$STATUS" = "200" ]; then
    BODY=$(curl -s --max-time 3 http://localhost:3000 2>/dev/null)
    if ! echo "$BODY" | grep -qE "$BAD_PATTERNS"; then
      HEALED="$i"
      break
    fi
  fi
done

if [ -n "$HEALED" ]; then
  echo "CAE_RESULT=healed in ${HEALED}s (stack=${STACK})"
else
  echo "CAE_RESULT=timeout"
fi

#!/usr/bin/env bash
# code-ae-heal — the canonical dev-server heal recipe baked into the sandbox.
#
# Why this exists:
#   The chat agent kept inventing its own heal recipes (with pkill, etc.)
#   that raced Next.js's first compile and produced an infinite
#   "missing routes-manifest.json" loop. This script is the one true heal
#   path: called by HealPreviewUseCase, never by the agent. Uses /proc-based
#   port kill so it doesn't depend on pkill / lsof / ss / fuser.
#
# Exit semantics:
#   Always exit 0; emit exactly one CAE_RESULT=… marker as the last line of
#   stdout. The API's heal usecase parses the LAST marker to decide verdict.

set +e

cd /home/workspace/project 2>/dev/null || { echo "CAE_RESULT=no-workspace"; exit 0; }
[ -f package.json ] || { echo "CAE_RESULT=no-package-json"; exit 0; }

# ── Fast path ───────────────────────────────────────────────────────────────
# Already serving a clean 200? Don't touch the running dev server.
STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:3000 2>/dev/null)
if [ "$STATUS" = "200" ]; then
  BODY=$(curl -s --max-time 3 http://localhost:3000 2>/dev/null)
  if ! echo "$BODY" | grep -qE "Module not found|Failed to compile|Internal Server Error|ENOENT|Build Error"; then
    echo "CAE_RESULT=healed in 0s (already-healthy)"
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

# pkill is in procps now (fresh sandbox image); fall back gracefully if not.
command -v pkill >/dev/null 2>&1 && {
  pkill -9 -f "next" 2>/dev/null
  pkill -9 -f "bun.*dev" 2>/dev/null
  pkill -9 -f "node.*next" 2>/dev/null
}

sleep 2

STILL=$(find_port_pids)
if [ -n "$STILL" ]; then
  echo "CAE_RESULT=port-stuck"
  exit 0
fi

# ── Clean .next cache; relaunch dev detached ────────────────────────────────
rm -rf .next
> /tmp/dev.log

setsid nohup bash -c 'HOSTNAME=0.0.0.0 HOST=0.0.0.0 PORT=3000 exec bun run dev' \
  > /tmp/dev.log 2>&1 < /dev/null &

# ── Warm-up ────────────────────────────────────────────────────────────────
HEALED=""
for i in $(seq 1 120); do
  sleep 1
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:3000 2>/dev/null)
  if [ "$STATUS" = "200" ]; then
    BODY=$(curl -s --max-time 3 http://localhost:3000 2>/dev/null)
    if ! echo "$BODY" | grep -qE "Module not found|Failed to compile|Internal Server Error|ENOENT|Build Error"; then
      HEALED="$i"
      break
    fi
  fi
done

if [ -n "$HEALED" ]; then
  echo "CAE_RESULT=healed in ${HEALED}s"
else
  echo "CAE_RESULT=timeout"
fi

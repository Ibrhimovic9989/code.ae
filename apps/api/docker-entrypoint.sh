#!/bin/sh
# Container entrypoint: apply Prisma migrations, then start the API.
#
# Handles P3005 (DB has tables but no `_prisma_migrations` table) by dropping
# the public schema and re-applying. Safe for this project pre-launch; do NOT
# keep this behavior after the first real user data lands — see the guard.
set -e

cd /app/apps/api

if [ "${ALLOW_DB_RESET:-0}" = "1" ]; then
  echo "[entrypoint] ALLOW_DB_RESET=1 — will reset schema on P3005"
else
  echo "[entrypoint] ALLOW_DB_RESET=0 — P3005 will abort (set =1 for first-run reset)"
fi

OUT=$(pnpm prisma migrate deploy 2>&1) && RC=0 || RC=$?
echo "$OUT"

if [ $RC -ne 0 ] && echo "$OUT" | grep -q "P3005" && [ "${ALLOW_DB_RESET:-0}" = "1" ]; then
  echo "[entrypoint] P3005 detected — dropping public schema and re-applying migrations"
  printf "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;\n" | \
    pnpm prisma db execute --stdin --schema=prisma/schema.prisma
  pnpm prisma migrate deploy
elif [ $RC -ne 0 ]; then
  echo "[entrypoint] migrate deploy failed with code $RC — aborting"
  exit $RC
fi

echo "[entrypoint] starting Nest"
exec node dist/main.js

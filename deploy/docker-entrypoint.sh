#!/bin/sh
# Starts AYA: optionally brings the database schema up to date first (never destructive: no --accept-data-loss).
set -e
if [ "${AUTO_DB_PUSH:-true}" = "true" ]; then
  echo "[aya] syncing database schema…"
  i=0
  until npx prisma db push --skip-generate >/tmp/dbpush.log 2>&1; do
    i=$((i + 1))
    if [ "$i" -ge 30 ]; then cat /tmp/dbpush.log; echo "[aya] database not reachable or schema change refused"; exit 1; fi
    sleep 2
  done
  echo "[aya] schema ok"
fi
exec "$@"

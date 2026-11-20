#!/bin/sh
# Restores a backup made by backup.sh into the running docker compose stack.
#   ./deploy/restore.sh backups/db-20260101-033000.sql.gz [backups/files-20260101-033000.tar.gz]
# The database content is REPLACED. Stop the web container first:  docker compose stop web
set -eu
DB_DUMP="${1:?usage: restore.sh <db dump .sql.gz> [files archive .tar.gz]}"
printf 'This replaces the whole database with %s. Type RESTORE to continue: ' "$DB_DUMP"
read -r answer
[ "$answer" = "RESTORE" ] || { echo "cancelled"; exit 1; }
gunzip -c "$DB_DUMP" | docker compose exec -T db sh -c 'exec mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" aya'
if [ "${2:-}" ]; then
  docker compose run --rm --no-deps -T web tar -C /app -xzf - < "$2"
fi
echo "restored. Start the site again:  docker compose start web"

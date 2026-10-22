#!/bin/sh
# Nightly backup of the database and the uploaded / recorded files, keeping the last 14 days.
#   BACKUP_DIR=/var/backups/aya ./deploy/backup.sh          (crontab: 30 3 * * * /opt/aya/deploy/backup.sh)
# With docker compose the database is dumped from the "db" container; otherwise set DATABASE_URL / MYSQL_* yourself.
set -eu
BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

if command -v docker >/dev/null 2>&1 && docker compose ps db >/dev/null 2>&1; then
  docker compose exec -T db sh -c 'exec mariadb-dump -uroot -p"$MARIADB_ROOT_PASSWORD" --single-transaction --routines aya' | gzip > "$BACKUP_DIR/db-$STAMP.sql.gz"
  # files live on docker volumes: copy them out through the web container
  docker compose exec -T web tar -C /app -czf - public/uploads storage > "$BACKUP_DIR/files-$STAMP.tar.gz"
else
  : "${MYSQL_HOST:=127.0.0.1}" "${MYSQL_USER:=aya}" "${MYSQL_DATABASE:=aya}"
  MYSQL_PWD="${MYSQL_PASSWORD:?set MYSQL_PASSWORD}" mysqldump -h"$MYSQL_HOST" -u"$MYSQL_USER" --single-transaction --routines "$MYSQL_DATABASE" | gzip > "$BACKUP_DIR/db-$STAMP.sql.gz"
  tar -czf "$BACKUP_DIR/files-$STAMP.tar.gz" public/uploads storage 2>/dev/null || true
fi

find "$BACKUP_DIR" -name 'db-*.sql.gz' -mtime +"$KEEP_DAYS" -delete
find "$BACKUP_DIR" -name 'files-*.tar.gz' -mtime +"$KEEP_DAYS" -delete
echo "backup written to $BACKUP_DIR ($STAMP)"

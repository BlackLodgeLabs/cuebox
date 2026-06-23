#!/usr/bin/env sh
set -eu

BACKUP_CRON="${BACKUP_CRON:-0 3 * * *}"

echo "${BACKUP_CRON} /usr/local/bin/backup-db.sh" > /etc/backup-crontab
exec /usr/local/bin/supercronic /etc/backup-crontab

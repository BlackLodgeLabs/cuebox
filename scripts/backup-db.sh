#!/usr/bin/env bash
# Full logical backup of the Cuebox Postgres database with retention pruning.
set -euo pipefail

prune_old_backups() {
  local retention="${BACKUP_RETENTION_DAYS:-2}"
  mkdir -p "$BACKUP_DIR"

  mapfile -t sorted < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'cuebox-*.dump' | sort)
  local count="${#sorted[@]}"
  if (( count <= retention )); then
    return 0
  fi

  local to_delete=$((count - retention))
  local i
  for (( i = 0; i < to_delete; i++ )); do
    rm -f "${sorted[i]}"
    echo "Deleted old backup: ${sorted[i]}"
  done
}

_run_backup() {
  local date_stamp dump_tmp dump_final
  date_stamp="$(date -u +%Y-%m-%d)"
  dump_tmp="${BACKUP_DIR}/cuebox-${date_stamp}.dump.tmp"
  dump_final="${BACKUP_DIR}/cuebox-${date_stamp}.dump"

  mkdir -p "$BACKUP_DIR"
  echo "Starting backup of ${POSTGRES_DB}@${PGHOST} to ${dump_final}"

  if ! pg_dump -Fc -h "$PGHOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "$dump_tmp"; then
    rm -f "$dump_tmp"
    echo "Backup failed" >&2
    return 1
  fi

  mv "$dump_tmp" "$dump_final"
  echo "Backup complete: ${dump_final} ($(du -h "$dump_final" | cut -f1))"

  prune_old_backups
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  if [[ -z "${CUEBOX_IN_BACKUP_CONTAINER:-}" ]]; then
    ROOT="$(cd "$(dirname "$0")/.." && pwd)"
    cd "$ROOT"
    exec docker compose run --rm backup /usr/local/bin/backup-db.sh "$@"
  fi

  BACKUP_DIR="${BACKUP_DIR:-/backups}"
  BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-2}"
  PGHOST="${PGHOST:-postgres}"
  POSTGRES_USER="${POSTGRES_USER:-cuebox}"
  POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-cuebox}"
  POSTGRES_DB="${POSTGRES_DB:-cuebox}"
  export PGPASSWORD="$POSTGRES_PASSWORD"

  if [[ "${BACKUP_RETENTION_ONLY:-}" == "1" ]]; then
    prune_old_backups
    exit 0
  fi

  _run_backup
fi

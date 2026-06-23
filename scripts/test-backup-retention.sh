#!/usr/bin/env bash
# Verify backup retention keeps only the N newest cuebox-*.dump files.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

touch "$TMP/cuebox-2026-01-01.dump"
touch "$TMP/cuebox-2026-01-02.dump"
touch "$TMP/cuebox-2026-01-03.dump"

export BACKUP_DIR="$TMP"
export BACKUP_RETENTION_DAYS=2
export CUEBOX_IN_BACKUP_CONTAINER=1

# shellcheck source=scripts/backup-db.sh
source "$ROOT/scripts/backup-db.sh"
prune_old_backups

remaining=()
mapfile -t remaining < <(find "$TMP" -maxdepth 1 -type f -name 'cuebox-*.dump' -printf '%f\n' | sort)

if [[ "${#remaining[@]}" -ne 2 ]]; then
  echo "FAIL: expected 2 backup files, found ${#remaining[@]}: ${remaining[*]:-none}" >&2
  exit 1
fi

if [[ "${remaining[0]}" != "cuebox-2026-01-02.dump" || "${remaining[1]}" != "cuebox-2026-01-03.dump" ]]; then
  echo "FAIL: expected cuebox-2026-01-02.dump and cuebox-2026-01-03.dump, got: ${remaining[*]}" >&2
  exit 1
fi

echo "PASS: retention keeps the two newest daily backups"

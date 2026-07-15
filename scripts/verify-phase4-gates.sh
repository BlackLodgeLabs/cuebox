#!/usr/bin/env bash
# Phase 4 verification gates — watchlist synchronisation.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

CONTAINER_NAME="${PHASE4_PG_CONTAINER:-${PHASE3_PG_CONTAINER:-phase25-pg}}"
DB_URL="${DATABASE_URL:-postgresql+psycopg://cuebox:cuebox@localhost:5432/cuebox}"

pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; exit 1; }

start_postgres() {
  running_pg=$(docker ps --filter publish=5432 --format '{{.Names}}' | head -n1 || true)
  if [[ -n "$running_pg" ]]; then
    CONTAINER_NAME="$running_pg"
  elif ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
    docker rm -f "$CONTAINER_NAME" 2>/dev/null || true
    docker run -d --name "$CONTAINER_NAME" \
      -e POSTGRES_USER=cuebox \
      -e POSTGRES_PASSWORD=cuebox \
      -e POSTGRES_DB=cuebox \
      -p 5432:5432 \
      pgvector/pgvector:pg16
  fi
  until docker exec "$CONTAINER_NAME" pg_isready -U cuebox -d cuebox -q; do sleep 1; done
  export DATABASE_URL="$DB_URL"
  export TEST_DATABASE_URL="${TEST_DATABASE_URL:-$DB_URL}"
  (cd api && alembic upgrade head)
}

echo "=== Gate 1: Unit tests (no DB) ==="
unset DATABASE_URL TEST_DATABASE_URL
(
  cd api
  pytest tests/test_csv_sync_diff.py tests/test_rss_parser.py tests/test_sync_username_validation.py -v
)
pass "Unit tests"

echo "=== Gate 2: CSV sync integration ==="
start_postgres
(
  cd api
  pytest tests/test_integration_csv_sync.py -v
)
pass "CSV sync integration"

echo "=== Gate 3: RSS sync integration ==="
start_postgres
(
  cd api
  pytest tests/test_integration_rss_sync.py -v
)
pass "RSS sync integration"

echo "=== Gate 4: Archived films retain metadata ==="
start_postgres
(
  cd api
  pytest tests/test_integration_csv_sync.py::test_csv_sync_existing_archived_unchanged -v
)
pass "Archived metadata retained"

echo "=== Gate 5: Watched excluded from candidates ==="
start_postgres
(
  cd api
  pytest tests/test_watched_excluded_from_candidates.py -v
)
pass "Watched exclusion"

echo "=== Gate 6: RSS status endpoint ==="
start_postgres
(
  cd api
  pytest tests/test_integration_rss_sync.py::test_rss_status_after_configure -v
)
pass "RSS status"

echo "=== Gate 7: Ruff ==="
(cd api && ruff check app tests)
pass "Ruff"

echo "=== Gate 8: Regression test names ==="
required_tests=(
  "test_import_pipeline_reaches_ready"
  "test_csv_sync_additive_adds_new_uri"
  "test_rss_poll_idempotent"
)
collected=$(cd api && pytest tests/ --collect-only -q)
for test_name in "${required_tests[@]}"; do
  echo "$collected" | grep -q "$test_name" || fail "Missing regression test: $test_name"
done
pass "Regression names"

echo "=== All Phase 4 gates passed ==="

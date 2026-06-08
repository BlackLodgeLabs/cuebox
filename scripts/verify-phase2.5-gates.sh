#!/usr/bin/env bash
# Phase 2.5 verification gates — local CI simulation (no live TMDB/OMDb keys).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

CONTAINER_NAME="${PHASE25_PG_CONTAINER:-phase25-pg}"
export DATABASE_URL="${DATABASE_URL:-postgresql+psycopg://cuebox:cuebox@localhost:5432/cuebox}"
export TEST_DATABASE_URL="${TEST_DATABASE_URL:-$DATABASE_URL}"

pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; exit 1; }

echo "=== Gate 1: Local CI simulation ==="
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
(
  cd api
  alembic upgrade head
  pytest tests/ -v
  ruff check app tests
)
pass "Local CI simulation"

echo "=== Gate 2: Regression coverage matrix ==="
required_tests=(
  "test_retry_updates_old_job_counters"
  "test_parse_retry_after_http_date"
  "test_runtime_zero_maps_to_none"
  "test_vote_average_zero_is_preserved"
  "test_reject_non_review_required_returns_409"
  "test_per_film_crash_does_not_halt_job"
  "test_all_candidate_fetches_fail_reports_provider_error"
)
collected=$(cd api && pytest tests/ --collect-only -q)
for test_name in "${required_tests[@]}"; do
  echo "$collected" | grep -q "$test_name" || fail "Missing regression test: $test_name"
done
pass "Regression coverage matrix"

echo "=== Gate 3: No live API keys ==="
! grep -qE 'TMDB_API_KEY|OMDB_API_KEY' .github/workflows/api-ci.yml
unset TMDB_API_KEY OMDB_API_KEY
(cd api && pytest tests/ -v)
pass "Tests pass without provider API keys in environment"

echo "=== Gate 4: Full regression count ==="
count=$(cd api && pytest tests/ --collect-only -q | tail -n1 | grep -oE '[0-9]+ (tests collected|selected)' | awk '{print $1}')
[[ "${count:-0}" -ge 45 ]] || fail "Expected at least 45 tests, found ${count:-0}"
pass "Collected $count tests"

echo "=== All Phase 2.5 gates passed ==="

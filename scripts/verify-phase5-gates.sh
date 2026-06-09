#!/usr/bin/env bash
# Phase 5 verification gates — recommendation engine.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

CONTAINER_NAME="${PHASE5_PG_CONTAINER:-${PHASE3_PG_CONTAINER:-phase25-pg}}"
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
  pytest tests/test_profile_canonicalization.py tests/test_questionnaire_validation.py \
    tests/test_scoring_service.py tests/test_constraint_relaxation.py tests/test_diversity_service.py -v
)
pass "Unit tests"

echo "=== Gate 2: E2E recommendation ==="
start_postgres
(
  cd api
  pytest tests/test_integration_recommendation.py -v
)
pass "E2E recommendation"

echo "=== Gate 3: Profile cache ==="
start_postgres
(
  cd api
  pytest tests/test_integration_profile_cache.py -v
)
pass "Profile cache"

echo "=== Gate 4: Candidate observability ==="
start_postgres
(
  cd api
  pytest tests/test_integration_recommendation.py::test_end_to_end_recommendation -v
)
pass "Candidate observability"

echo "=== Gate 5: Constraint relaxation ==="
start_postgres
(
  cd api
  pytest tests/test_integration_constraint_relaxation.py -v
)
pass "Constraint relaxation"

echo "=== Gate 6: History endpoints ==="
start_postgres
(
  cd api
  pytest tests/test_integration_recommendation_history.py::test_history_list_and_detail -v
)
pass "History endpoints"

echo "=== Gate 7: INSUFFICIENT_CANDIDATES ==="
start_postgres
(
  cd api
  pytest tests/test_integration_recommendation_history.py::test_insufficient_candidates -v
)
pass "Insufficient candidates"

echo "=== Gate 8: Timing smoke (<30s) ==="
start_postgres
(
  cd api
  pytest tests/test_integration_recommendation.py::test_end_to_end_recommendation -v
)
pass "Timing smoke"

echo "=== Gate 9: Ruff ==="
(cd api && ruff check app tests)
pass "Ruff"

echo "=== Gate 10: Regression test names ==="
required_tests=(
  "test_end_to_end_recommendation"
  "test_identical_questionnaire_profile_cache_hit"
  "test_history_list_and_detail"
  "test_insufficient_candidates"
)
collected=$(cd api && pytest tests/ --collect-only -q)
for test_name in "${required_tests[@]}"; do
  echo "$collected" | grep -q "$test_name" || fail "Missing regression test: $test_name"
done
pass "Regression names"

echo "=== All Phase 5 gates passed ==="

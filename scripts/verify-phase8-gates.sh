#!/usr/bin/env bash
# Phase 8 verification gates — Integration, NFR validation & polish.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

CONTAINER_NAME="${PHASE8_PG_CONTAINER:-${PHASE7_PG_CONTAINER:-${PHASE5_PG_CONTAINER:-phase25-pg}}}"
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

UNIT_TESTS=(
  tests/test_profile_canonicalization.py
  tests/test_scoring_service.py
  tests/test_confidence_scoring.py
  tests/test_csv_parser.py
  tests/test_constraint_relaxation.py
  tests/test_questionnaire_validation.py
)

INTEGRATION_TESTS=(
  tests/test_integration_full_journey.py
  tests/test_integration_profile_cache.py
  tests/test_integration_csv_sync.py
  tests/test_integration_review.py
  tests/test_integration_rematch.py
  tests/test_integration_recommendation_history.py
  tests/test_integration_recommendation_errors.py
)

PERF_TESTS=(
  "tests/test_integration_recommendation.py::test_end_to_end_recommendation"
  "tests/test_integration_recommendation_history.py::test_history_list_and_detail"
  "tests/test_integration_import.py::test_import_returns_job_immediately"
)

echo "=== Gate 1: API ruff ==="
(cd api && ruff check app tests)
pass "Ruff"

echo "=== Gate 2: Unit regression (no DB) ==="
(cd api && pytest "${UNIT_TESTS[@]}" -v)
pass "Unit regression"

echo "=== Gate 3: Integration suite ==="
start_postgres
(
  cd api
  pytest "${INTEGRATION_TESTS[@]}" -v
)
pass "Integration suite"

echo "=== Gate 4: Performance assertions ==="
(
  cd api
  pytest "${PERF_TESTS[@]}" -v
)
pass "Performance assertions"

echo "=== Gate 5: PRD success criteria audit ==="
bash scripts/verify-prd-success-criteria.sh
pass "PRD audit"

echo "=== Gate 6: Frontend typecheck ==="
(cd frontend && npx tsc --noEmit)
pass "Typecheck"

echo "=== Gate 7: Frontend production build ==="
(cd frontend && npm run build)
pass "Production build"

echo "=== Gate 8: Phase 7 regression ==="
bash scripts/verify-phase7-gates.sh
pass "Phase 7 regression"

echo "=== Gate 9: Playwright E2E (optional) ==="
if [[ "${PLAYWRIGHT_E2E_STACK:-}" == "1" ]]; then
  (
    cd frontend
    PLAYWRIGHT_E2E_STACK=1 npm run test:e2e
  )
  pass "Playwright E2E (full stack)"
else
  echo "SKIP: Set PLAYWRIGHT_E2E_STACK=1 with docker compose up to enable full-stack E2E"
fi

echo "=== Gate 10: Live stack smoke (optional) ==="
if [[ "${RUN_SMOKE_TEST:-}" == "1" ]]; then
  bash scripts/smoke-test.sh
  pass "Live stack smoke"
else
  echo "SKIP: Set RUN_SMOKE_TEST=1 with docker compose up and letterboxd/watchlist.csv"
fi

echo "=== All Phase 8 gates passed ==="

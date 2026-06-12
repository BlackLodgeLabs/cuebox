#!/usr/bin/env bash
# Phase 7 verification gates — Developer Mode.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

CONTAINER_NAME="${PHASE7_PG_CONTAINER:-${PHASE5_PG_CONTAINER:-phase25-pg}}"
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

echo "=== Gate 1: API ruff ==="
(cd api && ruff check app tests)
pass "Ruff"

echo "=== Gate 2: Developer Mode integration tests ==="
start_postgres
(
  cd api
  pytest tests/test_developer_mode.py -v
)
pass "Developer Mode tests"

echo "=== Gate 3: Frontend typecheck ==="
(cd frontend && npx tsc --noEmit)
pass "Typecheck"

echo "=== Gate 4: Frontend production build ==="
(cd frontend && npm run build)
pass "Production build"

echo "=== Gate 5: Playwright Developer Mode (mocked API) ==="
(
  cd frontend
  npx playwright test e2e/dev-mode.spec.ts --grep "mocked API"
)
pass "Playwright Developer Mode (mocked API)"

echo "=== Gate 6: Phase 6.5 regression ==="
bash scripts/verify-phase6.5-gates.sh
pass "Phase 6.5 regression"

echo "=== Gate 7: Playwright Developer Mode (full stack, optional) ==="
if [[ "${PLAYWRIGHT_E2E_STACK:-}" == "1" ]]; then
  (
    cd frontend
    PLAYWRIGHT_E2E_STACK=1 npx playwright test e2e/dev-mode.spec.ts --grep "full stack"
  )
  pass "Playwright Developer Mode (full stack)"
else
  echo "SKIP: Set PLAYWRIGHT_E2E_STACK=1 with docker compose up to enable full-stack dev mode E2E"
fi

echo "=== All Phase 7 gates passed ==="

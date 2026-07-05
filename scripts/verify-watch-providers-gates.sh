#!/usr/bin/env bash
# Watch providers feature gates — backend + frontend + Phase 8 regression.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

CONTAINER_NAME="${WATCH_PROVIDERS_PG_CONTAINER:-${PHASE8_PG_CONTAINER:-phase25-pg}}"
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
(cd api && ruff check app tests) && pass "API ruff"

echo "=== Gate 2: Watch providers unit tests (no DB) ==="
(cd api && pytest tests/test_tmdb_watch_providers.py -v) && pass "watch providers unit tests"

echo "=== Gate 3: Watch providers integration tests ==="
start_postgres
(cd api && pytest tests/test_integration_watch_providers.py -v) && pass "watch providers integration tests"

echo "=== Gate 4: Frontend tsc --noEmit ==="
if docker compose ps --format '{{.Name}} {{.State}}' 2>/dev/null | grep -q '^frontend Up'; then
  docker compose stop frontend
  sudo rm -rf frontend/.next
fi
(cd frontend && npx tsc --noEmit) && pass "frontend tsc"

echo "=== Gate 5: Frontend unit tests (watch-provider coverage) ==="
(cd frontend && npm run test:unit -- \
  src/hooks/use-watch-providers.test.tsx \
  src/components/where-to-watch-section.test.tsx \
  src/components/watch-provider-icons.test.tsx \
  src/components/results-view.test.tsx) && pass "frontend unit tests"

echo "=== Gate 6: Playwright watch-providers (mocked API) ==="
(cd frontend && npx playwright test e2e/watch-providers.spec.ts) && pass "playwright watch-providers"

echo "=== Gate 7: Phase 8 regression ==="
bash scripts/verify-phase8-gates.sh && pass "phase 8 regression"

echo "All watch-providers gates passed."

#!/usr/bin/env bash
# Phase 3 verification gates — semantic enrichment pipeline (mocked AI, no live keys).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

CONTAINER_NAME="${PHASE3_PG_CONTAINER:-${PHASE25_PG_CONTAINER:-phase25-pg}}"
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

echo "=== Gate 1: Provider resolution (unit) ==="
unset DATABASE_URL TEST_DATABASE_URL
(
  cd api
  pytest tests/test_semantic_provider.py tests/test_embedding_provider.py tests/test_semantic_prompt.py -v
)
pass "Provider resolution"

echo "=== Gate 2: Service layer (unit) ==="
unset DATABASE_URL TEST_DATABASE_URL
(
  cd api
  pytest tests/test_semantic_service.py tests/test_embedding_service.py -v
)
start_postgres
(
  cd api
  pytest tests/test_job_counter_semantics.py tests/test_enrichment_pipeline.py -v
)
pass "Service layer"

echo "=== Gate 3–5: Integration (Postgres + mocked AI) ==="
start_postgres
unset OPENAI_API_KEY TMDB_API_KEY OMDB_API_KEY VOYAGE_API_KEY
(
  cd api
  alembic upgrade head
  pytest tests/test_integration_semantic_pipeline.py -v
  pytest tests/test_integration_semantic_failures.py tests/test_import_orchestrator_faults.py -v
  pytest tests/test_integration_review_accept_semantic.py -v
  ruff check app tests
)
pass "Integration pipeline"

echo "=== Gate 6: pgvector / HNSW ==="
index_count=$(docker exec "$CONTAINER_NAME" psql -U cuebox -d cuebox -tAc \
  "SELECT count(*) FROM pg_indexes WHERE indexname = 'idx_film_embeddings_semantic_hnsw';")
[[ "$index_count" == "1" ]] || fail "HNSW index missing"
pass "HNSW index present"

echo "=== Gate 7: Regression test names ==="
required_tests=(
  "test_import_pipeline_reaches_ready"
  "test_semantic_failure_marks_film_failed"
  "test_accept_review_completes_to_ready_with_semantic_profile"
  "test_per_film_crash_does_not_halt_job"
)
collected=$(cd api && pytest tests/ --collect-only -q)
for test_name in "${required_tests[@]}"; do
  echo "$collected" | grep -q "$test_name" || fail "Missing regression test: $test_name"
done
pass "Regression test names"

echo "=== Gate 8: Full suite without live API keys ==="
start_postgres
count=$(cd api && pytest tests/ --collect-only -q | tail -n1 | grep -oE '[0-9]+ (tests collected|selected)' | awk '{print $1}')
[[ "${count:-0}" -ge 45 ]] || fail "Expected at least 45 tests, found ${count:-0}"
unset OPENAI_API_KEY TMDB_API_KEY OMDB_API_KEY VOYAGE_API_KEY
(cd api && pytest tests/ -v)
pass "Full suite ($count tests)"

echo "=== Phase 2.5 regression ==="
bash scripts/verify-phase2.5-gates.sh

echo "=== All Phase 3 gates passed ==="

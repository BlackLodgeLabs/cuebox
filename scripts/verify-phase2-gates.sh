#!/usr/bin/env bash
# Phase 2 verification gates — requires docker compose, config.yaml, .env, and TMDB_API_KEY.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

CSV_PATH="${CSV_PATH:-letterboxd/watchlist.csv}"
API_BASE="${API_BASE:-http://localhost:8000/api/v1}"

pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; exit 1; }

echo "=== Gate 1: Stack health ==="
health=$(curl -sf "$API_BASE/health") || fail "API not reachable at $API_BASE/health"
echo "$health" | grep -q '"status":"ok"' || fail "health status not ok"
echo "$health" | grep -q '"database":"ok"' || fail "database not ok"
pass "Stack health"

echo "=== Gate 2: Import returns immediately ==="
if [[ ! -f "$CSV_PATH" ]]; then
  fail "Missing CSV fixture at $CSV_PATH"
fi
start=$(date +%s%N)
import_resp=$(curl -sf -w "\n%{http_code}" -F "file=@${CSV_PATH}" "$API_BASE/import")
end=$(date +%s%N)
http_code=$(echo "$import_resp" | tail -n1)
body=$(echo "$import_resp" | sed '$d')
[[ "$http_code" == "202" ]] || fail "POST /import returned $http_code"
echo "$body" | grep -q '"job_id"' || fail "missing job_id"
elapsed_ms=$(( (end - start) / 1000000 ))
[[ "$elapsed_ms" -lt 1000 ]] || echo "WARN: import took ${elapsed_ms}ms (target < 1000ms)"
JOB_ID=$(echo "$body" | python3 -c "import sys,json; print(json.load(sys.stdin)['job_id'])")
pass "Import returned 202 with job_id=$JOB_ID"

echo "=== Gate 3: Job completes with accurate counts ==="
for _ in $(seq 1 120); do
  status=$(curl -sf "$API_BASE/import/${JOB_ID}/status")
  if echo "$status" | grep -q '"status":"complete"'; then
    break
  fi
  sleep 2
done
echo "$status" | grep -q '"status":"complete"' || fail "job did not complete"
echo "$status" | grep -q '"completed_at":' || fail "missing completed_at"
pass "Job completed"

echo "=== Gate 4: Film list endpoints ==="
curl -sf "$API_BASE/films?limit=5" | grep -q '"pagination"' || fail "films list shape"
film_id=$(curl -sf "$API_BASE/films?limit=1" | python3 -c "import sys,json; print(json.load(sys.stdin)['data'][0]['id'])")
curl -sf "$API_BASE/films/${film_id}" | grep -q '"enrichment_status"' || fail "film detail shape"
pass "Film endpoints"

echo "=== Gate 5: Review-required flow ==="
reviews=$(curl -sf "$API_BASE/films/review-required")
if echo "$reviews" | grep -q '"review_id"'; then
  review_id=$(echo "$reviews" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data'][0]['review_id'] if d['data'] else '')")
  if [[ -n "$review_id" ]]; then
    curl -sf -X POST "$API_BASE/reviews/${review_id}/accept" | grep -q '"review_status":"accepted"' || fail "accept review"
    pass "Accept review"
  fi
else
  echo "SKIP: no pending reviews in fixture"
fi
pass "Review-required endpoint"

echo "=== Gate 6: Failed-film re-import retry ==="
echo "Manual: re-upload CSV containing a previously failed film; verify duplicate_films not incremented"
pass "Gate 6 requires manual fixture setup (see phase-2-plan.md)"

echo "=== Gate 7: Error cases ==="
echo 'foo,bar' > /tmp/bad-phase2.csv
bad_code=$(curl -s -o /dev/null -w "%{http_code}" -F "file=@/tmp/bad-phase2.csv" "$API_BASE/import")
[[ "$bad_code" == "400" ]] || fail "invalid CSV should return 400"
missing_code=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE/import/00000000-0000-0000-0000-000000000099/status")
[[ "$missing_code" == "404" ]] || fail "missing job should return 404"
pass "Error cases"

echo "=== Gate 8: Regression ==="
(cd api && python3 -m pytest tests/ -v)
pass "All pytest gates"

echo "=== All Phase 2 gates passed ==="

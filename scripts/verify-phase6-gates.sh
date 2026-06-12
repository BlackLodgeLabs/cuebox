#!/usr/bin/env bash
# Phase 6 verification gates — frontend MVP UX.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; exit 1; }
skip() { echo "SKIP: $1"; }

echo "=== Gate 1: Frontend typecheck ==="
(cd frontend && npx tsc --noEmit)
pass "Typecheck"

echo "=== Gate 2: Frontend production build ==="
(cd frontend && npm run build)
pass "Production build"

echo "=== Gate 3: ESLint (if configured) ==="
if (cd frontend && npm run lint -- --help >/dev/null 2>&1); then
  if [[ -f frontend/.eslintrc.json || -f frontend/eslint.config.js || -f frontend/eslint.config.mjs ]]; then
    (cd frontend && npm run lint)
    pass "ESLint"
  else
    skip "ESLint not initialized"
  fi
else
  skip "ESLint not configured"
fi

echo "=== Gate 4: Backend regression (Phases 2.5–5) ==="
bash scripts/verify-phase2.5-gates.sh
bash scripts/verify-phase3-gates.sh
bash scripts/verify-phase4-gates.sh
bash scripts/verify-phase5-gates.sh
pass "Backend regression"

echo "=== Gate 5: Playwright E2E (optional) ==="
if [[ "${PLAYWRIGHT_E2E_STACK:-}" == "1" ]]; then
  (cd frontend && npx playwright test)
  pass "Playwright E2E"
else
  skip "Set PLAYWRIGHT_E2E_STACK=1 with docker compose stack running to enable E2E"
fi

echo "=== Gate 6: Error message coverage ==="
required_codes=(
  VALIDATION_ERROR
  NOT_FOUND
  CONFLICT
  INVALID_CSV_FORMAT
  WATCHLIST_SIZE_EXCEEDED
  NO_PREFERENCE_CONFLICT
  ENRICHMENT_NOT_READY
  INSUFFICIENT_CANDIDATES
  PROVIDER_ERROR
  INTERNAL_ERROR
)
for code in "${required_codes[@]}"; do
  grep -q "${code}" frontend/src/lib/error-messages.ts || \
    fail "Missing error message for ${code}"
done
pass "Error UX audit (all ErrorCode values mapped)"

echo "=== Gate 7: Frontend unit tests (PR review regressions) ==="
(cd frontend && npm run test:unit)
pass "Frontend unit tests"

echo "=== Gate 8: PR review static audit ==="
if grep -q "useToastOnError" frontend/src/hooks/use-recommendations.ts; then
  fail "useCreateRecommendation must not register duplicate toast errors"
fi
if grep -A6 "main-scanlines::after" frontend/src/app/globals.css | grep -q "position: fixed"; then
  fail "Scanlines overlay must use position: absolute on main, not fixed viewport"
fi
pass "PR review static audit"

echo "=== All Phase 6 gates passed ==="

#!/usr/bin/env bash
# Phase 6.5 verification gates — design system alignment.
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

echo "=== Gate 3: Design system audit ==="
if grep -rE "lucide-react|Film Picker|amber-50|amber-200|bg-amber" frontend/src >/dev/null 2>&1; then
  fail "Legacy styles or imports found (lucide, Film Picker, amber)"
fi
if ! test -f frontend/src/styles/tokens.css; then
  fail "Missing frontend/src/styles/tokens.css"
fi
if ! test -f frontend/src/components/icon.tsx; then
  fail "Missing frontend/src/components/icon.tsx"
fi
if ! test -f frontend/e2e/pr-review-regression.spec.ts; then
  fail "Missing frontend/e2e/pr-review-regression.spec.ts"
fi
pass "Design audit"

echo "=== Gate 4: Phase 6 regression ==="
bash scripts/verify-phase6-gates.sh
pass "Phase 6 regression"

echo "=== Gate 5: Playwright visual smoke (optional) ==="
if [[ "${PLAYWRIGHT_E2E_STACK:-}" == "1" ]]; then
  if ! test -f frontend/e2e/design-smoke.spec.ts; then
    skip "design-smoke.spec.ts not present yet"
  else
    (cd frontend && npx playwright test e2e/design-smoke.spec.ts)
    pass "Playwright design smoke"
  fi
else
  skip "Set PLAYWRIGHT_E2E_STACK=1 to enable E2E"
fi

echo "=== All Phase 6.5 gates passed ==="

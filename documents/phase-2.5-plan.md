---
name: Phase 2.5 — CI Pipeline & Regression Test Hardening
overview: "Add GitHub Actions CI with Postgres-backed integration tests, adversarial unit tests for provider/DB boundaries and orchestrator fault cases exposed by Phase 2 bugbot fixes — establishing automated gates before Phase 3 extends the enrichment pipeline."
depends_on: Phase 2 (complete)
todos:
  - id: ci-workflow
    content: Add GitHub Actions workflow — Postgres service, alembic upgrade head, pytest, ruff on every PR
    status: pending
  - id: unit-tmdb-normalization
    content: Add test_tmdb_normalization.py — runtime=0, malformed release_date, vote_average=0.0
    status: pending
  - id: unit-http-retry
    content: Add test_http_retry.py — Retry-After delta-seconds, HTTP-date, invalid header
    status: pending
  - id: unit-update-counters
    content: Add test_update_counters.py — failure_summary explicit clear via _UNSET sentinel
    status: pending
  - id: mock-adversarial
    content: Extend mock_providers.py with adversarial TMDB/HTTP profiles for fault injection
    status: pending
  - id: integration-job-invariants
    content: Add test_import_job_invariants.py — retry across jobs, old job complete, processed<=total CHECK
    status: pending
  - id: integration-orchestrator-faults
    content: Add test_import_orchestrator_faults.py — per-film crash isolation, MATCHING rollback, IntegrityError recovery
    status: pending
  - id: integration-review-guards
    content: Add test_review_guards.py — reject on non-review_required film returns 409
    status: pending
  - id: integration-provider-errors
    content: Add test_metadata_provider_errors.py — all candidate HTTP failures report provider error reason
    status: pending
  - id: pr-template
    content: Add PR template with regression-test checklist; document bug-fix-requires-test policy in plan/roadmap
    status: pending
  - id: verify-gates
    content: Run all Phase 2.5 verification gates locally and confirm CI workflow passes on push
    status: pending
  - id: update-roadmap
    content: Check off Phase 2.5 task checklist and verification gate in documents/roadmap.md; update overview
    status: pending
isProject: false
---

# Phase 2.5 — CI Pipeline & Regression Test Hardening

## Context

**Phase 2 is complete** (metadata import pipeline, TMDB/OMDb matching, review endpoints). Post-merge bugbot review on PR #5 surfaced **eight fix commits** across import job lifecycle, orchestrator resilience, TMDB→DB normalization, and HTTP retry correctness — **none of which added regression tests**.

Phase 3 extends the async pipeline (`enriching → ready`) with semantic enrichment and embeddings. Without automated CI and targeted regression tests, Phase 2 bugs will recur and Phase 3 failures will be harder to isolate.

**Phase 2.5 goal:** Shift defect detection left — every PR runs Postgres-backed integration tests and adversarial unit tests in CI before merge.

**Authoritative references:**

| Document | Purpose |
|----------|---------|
| [`documents/roadmap.md`](./roadmap.md) | Phase 2.5 section |
| [`documents/phase-2-plan.md`](./phase-2-plan.md) | Phase 2 implementation + gates |
| [`documents/database-design.md`](./database-design.md) | CHECK constraints for provider→DB mapping |
| [`scripts/verify-phase2-gates.sh`](../scripts/verify-phase2-gates.sh) | Manual smoke gates (not CI) |

### Motivation — Bugbot fix categories

| Category | Example commits | What tests prevent recurrence |
|----------|-----------------|------------------------------|
| Multi-job retry lifecycle | Old job counters, stale `failure_summary`, stuck `running` | DB integration: retry moves film between jobs |
| Orchestrator resilience | Per-film crash halts job; film stuck in `matching`; session poisoned after `IntegrityError` | Fault-injection integration tests |
| Provider→DB boundary | `runtime=0`, `vote_average=0.0`, malformed `release_date` | TMDB normalization unit tests |
| HTTP retry | `Retry-After` HTTP-date format | `http_retry` unit tests |
| API guards | `reject_review` on non-`review_required` film | Review guard integration test |

### Current scaffold state

| Path | State |
|------|-------|
| `.github/workflows/` | Does not exist |
| `api/tests/conftest.py` | Integration fixtures; tests skip without `DATABASE_URL` |
| `api/tests/mock_providers.py` | Happy-path TMDB/OMDb mocks only |
| `api/tests/test_integration_*.py` | 10 tests; never run in CI today |
| `scripts/verify-phase2-gates.sh` | Manual live-stack gates; requires API keys |

### Dependency graph

```mermaid
flowchart TD
    A[1. GitHub Actions CI workflow] --> B[2. Unit tests — TMDB, http_retry, update_counters]
    B --> C[3. Adversarial mock_providers fixtures]
    C --> D[4. DB integration — job invariants]
    D --> E[5. DB integration — orchestrator faults]
    E --> F[6. DB integration — review guards + provider errors]
    F --> G[7. PR template + policy]
    G --> H[8. Verification gates]
    H --> I[9. Update roadmap]
```

---

## Work Breakdown

### Step 1 — GitHub Actions CI workflow

**Goal:** Every push/PR to `api/` runs the full test suite against a migrated Postgres instance.

**Create:** `.github/workflows/api-ci.yml`

```yaml
# Structural requirements (implement in workflow file)
on: [push, pull_request]
jobs:
  api-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_USER: cuebox
          POSTGRES_PASSWORD: cuebox
          POSTGRES_DB: cuebox
        ports: ['5432:5432']
        options: >-
          --health-cmd "pg_isready -U cuebox -d cuebox"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10
    env:
      DATABASE_URL: postgresql+psycopg://cuebox:cuebox@localhost:5432/cuebox
      TEST_DATABASE_URL: postgresql+psycopg://cuebox:cuebox@localhost:5432/cuebox
    steps:
      - uses: actions/checkout@v4
      - name: Set up Python 3.12
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - name: Install dependencies
        run: pip install -e "./api[dev]"
      - name: Run migrations
        run: alembic upgrade head
      - name: Run tests
        run: pytest api/tests/ -v
      - name: Lint with ruff
        run: ruff check api/app api/tests
```

**Configuration decisions:**

- Use `pgvector/pgvector:pg16` to match `docker-compose.yml` and support Phase 3 vector tests without workflow changes.
- Set both `DATABASE_URL` and `TEST_DATABASE_URL` so `conftest.py` and `test_database.py` resolve the same DB.
- Run `alembic upgrade head` before pytest; confirm `alembic.ini` path relative to workflow `working-directory`.
- Do **not** call live TMDB/OMDb in CI — all provider tests use `httpx.MockTransport` via existing `integration_client` fixture.

**Acceptance:** Workflow passes on branch push; integration tests that previously `SKIPPED` now `PASSED`.

---

### Step 2 — TMDB normalization unit tests

**Create:** `api/tests/test_tmdb_normalization.py`

Test `TmdbClient` response mapping in isolation (mock `httpx` responses or test helper methods).

| Case | Input | Expected |
|------|-------|----------|
| Runtime zero | `"runtime": 0` | `None` (satisfies `runtime > 0` CHECK) |
| Vote zero | `"vote_average": 0.0` | Persisted as `0.0`, not skipped |
| Malformed date | `"release_date": "TBD"` | `year=None`, no `ValueError` |
| Short date | `"release_date": "199"` | `year=None` |
| Valid date | `"release_date": "1999-03-31"` | `year=1999` |

**Acceptance:** Tests fail on pre-`c7bb9e8` / pre-`91227c2` / pre-`8da42ce` code; pass on current code.

---

### Step 3 — HTTP retry unit tests

**Create:** `api/tests/test_http_retry.py`

| Case | `Retry-After` header | Expected delay behaviour |
|------|---------------------|--------------------------|
| Delta seconds | `"5"` | ~5s delay (mock sleep or test `_parse_retry_after` directly) |
| HTTP-date | RFC 7231 date in future | Computed seconds |
| Invalid | `"not-a-date"` | Falls back to exponential backoff |
| Absent | — | Exponential backoff `2**attempt` |

Export `_parse_retry_after` for direct unit testing (or test via controlled mock responses).

**Acceptance:** Covers bug `30929457` (float-only parsing).

---

### Step 4 — `update_counters` sentinel tests

**Create:** `api/tests/test_update_counters.py`

| Case | Call | Expected |
|------|------|----------|
| Clear summary | `update_counters(..., failure_summary=None)` | `job.failure_summary is None` |
| Omit summary | `update_counters(...)` without kwarg | Existing summary unchanged |
| Set summary | `update_counters(..., failure_summary=[...])` | Updated |

Requires DB fixture or in-memory session with `ImportJob` model.

**Acceptance:** Covers `_UNSET` sentinel from bugbot fix `91227c2`.

---

### Step 5 — Adversarial mock provider fixtures

**Extend:** `api/tests/mock_providers.py`

Add named profiles or handler branches:

```python
ADVERSARIAL_PROFILES = {
    "runtime_zero": ...,
    "malformed_date": ...,
    "vote_zero": ...,
    "partial_http_failure": ...,  # search OK, all detail fetches 500
    "duplicate_tmdb_id": ...,     # triggers IntegrityError on second film
}
```

Expose fixture parameter `mock_profile: str` in `conftest.py` for integration tests to select behaviour.

**Acceptance:** Integration tests can select fault mode without duplicating handler logic.

---

### Step 6 — Import job invariant integration tests

**Create:** `api/tests/test_import_job_invariants.py`

| Test | Scenario | Assertions |
|------|----------|------------|
| `test_retry_updates_old_job_counters` | Import → fail film → re-import same URI | Old job `total_films` decremented; `processed <= total`; old job `complete` when empty |
| `test_retry_does_not_increment_duplicate_films` | Same as Phase 2 gate 6 | `duplicate_films == 0` on retry job |
| `test_failure_summary_preserved_on_sync` | Film fails with specific reason → status poll | Reason not replaced by generic "Enrichment failed" |

Uses real DB + `integration_client` fixture; unique `letterboxd_uri` per test.

**Acceptance:** Would have caught bugbot commits `e82b816`, `4472496`, `4a12091`, `1e9fabf`.

---

### Step 7 — Orchestrator fault integration tests

**Create:** `api/tests/test_import_orchestrator_faults.py`

| Test | Scenario | Assertions |
|------|----------|------------|
| `test_per_film_crash_does_not_halt_job` | Mock causes exception on film 1; film 2 succeeds | Job `complete`; 1 failed + 1 enriching |
| `test_film_not_stuck_in_matching` | Simulate commit failure after enrich | Film not left in `matching` |
| `test_integrity_error_marks_failed` | Two films resolve to same `tmdb_id` | Both terminal; no `pending`/`matching` orphans |

May require patching `MetadataService.enrich_film` or adversarial mock profile for controlled faults.

**Acceptance:** Would have caught `91227c2`, `c232cab`, `5282d76`.

---

### Step 8 — Review guard integration tests

**Create:** `api/tests/test_review_guards.py`

| Test | Scenario | Assertions |
|------|----------|------------|
| `test_reject_non_review_required_returns_409` | Accept review first → reject again | HTTP 409 `CONFLICT` |
| `test_reject_on_enriching_film_returns_409` | Import high-confidence film → reject its review (if any) | 409; film stays `enriching` |

**Acceptance:** Would have caught `8da42ce`.

---

### Step 9 — Provider error messaging integration test

**Create:** `api/tests/test_metadata_provider_errors.py`

| Test | Scenario | Assertions |
|------|----------|------------|
| `test_all_candidate_fetches_fail_reports_provider_error` | `partial_http_failure` mock profile | `failure_summary` reason contains "provider HTTP errors" |
| `test_empty_search_reports_not_found` | `Unknown Film` query | Reason is "TMDB match not found" |

**Acceptance:** Would have caught `1e9fabf`.

---

### Step 10 — PR template and regression policy

**Create:** `.github/pull_request_template.md`

Checklist items:

- [ ] `pytest` passes locally with `DATABASE_URL` set
- [ ] CI workflow green
- [ ] Bug fixes include a regression test (link to test file)
- [ ] New provider→DB fields have CHECK constraint edge-case tests

**Update:** `documents/roadmap.md` Cross-Cutting Concerns → Testing Strategy (reference Phase 2.5 policy).

**Acceptance:** Template appears on new PRs; policy documented in roadmap.

---

## Verification Gates

All must pass before marking Phase 2.5 complete.

### Gate 1 — CI workflow green

```bash
# Push branch and confirm GitHub Actions job passes
# Locally simulate:
docker run -d --name phase25-pg -e POSTGRES_USER=cuebox -e POSTGRES_PASSWORD=cuebox \
  -e POSTGRES_DB=cuebox -p 5432:5432 pgvector/pgvector:pg16
export DATABASE_URL=postgresql+psycopg://cuebox:cuebox@localhost:5432/cuebox
cd api && alembic upgrade head && pytest tests/ -v && ruff check app tests
```

**Pass criteria:** 0 failures; 0 integration tests skipped due to missing `DATABASE_URL`.

### Gate 2 — Regression coverage matrix

| Bugbot fix area | Test file | Test name present |
|-----------------|-----------|-------------------|
| Retry old job counters | `test_import_job_invariants.py` | yes |
| `processed <= total` CHECK | `test_import_job_invariants.py` | yes |
| `Retry-After` HTTP-date | `test_http_retry.py` | yes |
| `runtime=0` | `test_tmdb_normalization.py` | yes |
| `vote_average=0.0` | `test_tmdb_normalization.py` | yes |
| Reject guard | `test_review_guards.py` | yes |
| Orchestrator isolation | `test_import_orchestrator_faults.py` | yes |
| Provider error message | `test_metadata_provider_errors.py` | yes |

### Gate 3 — No live API keys in CI

Confirm workflow env has no `TMDB_API_KEY` / `OMDB_API_KEY` and all tests still pass.

### Gate 4 — Regression

```bash
cd api && pytest tests/ -v
```

**Pass criteria:** All tests pass; count ≥ 30 (baseline 17 unit + new tests).

---

## Roadmap Update Procedure

Update [`documents/roadmap.md`](./roadmap.md) incrementally, then final pass when all gates pass.

### Per-task checklist

Mark `- [x]` in Phase 2.5 **Task Checklist** as each todo completes.

### Overview update

```markdown
**Current state:** Phase 2.5 complete. CI runs Postgres-backed integration tests on every PR; adversarial unit and integration tests cover Phase 2 bugbot regression categories. Next up: Phase 3 — Semantic Enrichment & Embeddings.
```

### Phase dependency graph

Ensure `P2 --> P2_5 --> P3` is reflected.

### Commit discipline

- Prefix commits with `phase-2.5:`.
- Each bug-class test suite in its own commit where practical.
- Include roadmap checkbox updates in the gate-verification commit.

---

## Deliverables Summary

| Deliverable | Path |
|-------------|------|
| CI workflow | `.github/workflows/api-ci.yml` |
| TMDB normalization tests | `api/tests/test_tmdb_normalization.py` |
| HTTP retry tests | `api/tests/test_http_retry.py` |
| Counter sentinel tests | `api/tests/test_update_counters.py` |
| Job invariant tests | `api/tests/test_import_job_invariants.py` |
| Orchestrator fault tests | `api/tests/test_import_orchestrator_faults.py` |
| Review guard tests | `api/tests/test_review_guards.py` |
| Provider error tests | `api/tests/test_metadata_provider_errors.py` |
| Adversarial mocks | `api/tests/mock_providers.py` (extended) |
| PR template | `.github/pull_request_template.md` |
| Roadmap | `documents/roadmap.md` — Phase 2.5 checked off |

---

## Recommended PR Slicing

| PR slice | Contents | Gates |
|----------|----------|-------|
| **2.5a — CI** | GitHub Actions workflow only; existing tests green in CI | Gate 1, 3 |
| **2.5b — Unit tests** | TMDB, http_retry, update_counters | Gate 2 (unit rows) |
| **2.5c — Integration tests** | Job invariants, orchestrator, review, provider errors + adversarial mocks | Gate 2 (integration rows), 4 |
| **2.5d — Policy + roadmap** | PR template, roadmap checkboxes | All gates |

---

## Exit Criteria

Phase 2.5 is **done** when:

1. All 12 todos in this plan are `completed`
2. All 4 verification gates pass
3. `documents/roadmap.md` Phase 2.5 checklist and gates are checked off
4. Overview reflects Phase 2.5 complete / Phase 3 next
5. Phase 3 `Depends on` references Phase 2.5 in roadmap
6. Changes committed, pushed, and PR ready for review

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Alembic path mismatch in CI | Pin `working-directory` in workflow; verify locally with same paths |
| Flaky integration timing | Use `TestClient` background task completion (no arbitrary sleep > 0.5s) |
| Postgres service startup race | Health-check `pg_isready` in workflow services options |
| Over-mocking hides real DB constraints | Job invariant tests use real Postgres, not SQLite |
| CI duration | Unit tests first in job; parallel jobs optional later |

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
  - id: agents-md-review
    content: Review AGENTS.md for structural changes (CI commands, env vars, compose services, bootstrap steps)
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
    I --> J[10. AGENTS.md review]
```

### Baseline inventory (branch start)

| Item | Count / state |
|------|----------------|
| `.github/workflows/` | Missing — no CI today |
| `api/tests/test_*.py` | 7 files, ~36 tests collected |
| Integration tests | Skip without `DATABASE_URL` (`conftest.py` `requires_db`) |
| `mock_providers.py` | Happy-path only (Matrix, Ambiguous, Unknown Film) |
| `scripts/verify-phase2-gates.sh` | Live-stack smoke gates; not a CI substitute |

---

## Execution Plan

Complete work in four PR slices (see [Recommended PR Slicing](#recommended-pr-slicing)). After **each** slice: run the slice gate, check off matching [roadmap](#roadmap-checkbox-mapping) items, commit with `phase-2.5:` prefix, push, and confirm GitHub Actions is green before starting the next slice.

| Step | Slice | Work | Gate checkpoint | Roadmap items to check |
|------|-------|------|-----------------|------------------------|
| 1 | 2.5a | Add `.github/workflows/api-ci.yml` | Gate 1 partial (local simulate) + Gate 3 | CI Pipeline (3 checkboxes) |
| 2 | 2.5b | Unit tests: TMDB, http_retry, update_counters | Gate 2 unit rows + Gate 4 | Unit Tests (3 checkboxes) |
| 3 | 2.5c | Adversarial mocks + 4 integration test modules | Gate 2 integration rows + Gate 4 | Test Infrastructure (mock) + Integration Tests (4 checkboxes) |
| 4 | 2.5d | PR template, policy note in roadmap | All gates | Test Infrastructure (PR template, policy) + Verification Gate (4 checkboxes) |
| 5 | — | Final gate run + roadmap overview + plan todos | All 4 gates | Overview + Phase 2.5 complete |
| 6 | — | AGENTS.md structural review | Manual checklist | — |

### Per-step commands

**After Step 1 (CI workflow):**

```bash
# Local CI simulation (from repo root)
docker run -d --name phase25-pg -e POSTGRES_USER=cuebox -e POSTGRES_PASSWORD=cuebox \
  -e POSTGRES_DB=cuebox -p 5432:5432 pgvector/pgvector:pg16
export DATABASE_URL=postgresql+psycopg://cuebox:cuebox@localhost:5432/cuebox
export TEST_DATABASE_URL="$DATABASE_URL"
cd api && alembic upgrade head && pytest tests/ -v && ruff check app tests
# Confirm: 0 integration skips; no TMDB_API_KEY / OMDB_API_KEY in env
```

**After Steps 2–4 (tests + template):**

```bash
cd api && pytest tests/ -v --tb=short   # Gate 4 — all pass, count ≥ 30
cd api && ruff check app tests
# Gate 2 — grep test names against matrix below
```

**Final (Step 5):**

```bash
# Push branch; confirm GitHub Actions api-ci job green (Gate 1)
bash scripts/verify-phase2.5-gates.sh   # optional consolidated script (add in Step 5)
```

---

## Roadmap Checkbox Mapping

Check off [`documents/roadmap.md`](./roadmap.md) Phase 2.5 items **incrementally** as each todo completes — do not batch until the final gate pass unless a slice fully covers a subsection.

| Plan todo ID | Roadmap checklist item |
|--------------|------------------------|
| `ci-workflow` | Add `.github/workflows/api-ci.yml` |
| `ci-workflow` | Set `DATABASE_URL` / `TEST_DATABASE_URL` in CI |
| `ci-workflow` | Confirm CI runs without live API keys |
| `unit-tmdb-normalization` | `test_tmdb_normalization.py` |
| `unit-http-retry` | `test_http_retry.py` |
| `unit-update-counters` | `test_update_counters.py` |
| `integration-job-invariants` | `test_import_job_invariants.py` |
| `integration-orchestrator-faults` | `test_import_orchestrator_faults.py` |
| `integration-review-guards` | `test_review_guards.py` |
| `integration-provider-errors` | `test_metadata_provider_errors.py` |
| `mock-adversarial` | Extend `mock_providers.py` with adversarial profiles |
| `pr-template` | Add `.github/pull_request_template.md` |
| `pr-template` | Document bug-fix-requires-test policy (roadmap Testing Strategy) |
| `verify-gates` | All four Verification Gate checkboxes |
| `update-roadmap` | Overview: Phase 2.5 complete → Phase 3 next |

**DB Constraint Test Matrix** (roadmap): mark covered when unit/integration tests assert each edge case (`runtime=0`, `vote_average=0.0`, malformed dates, `processed <= total`).

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

All four gates must pass before marking Phase 2.5 complete. Run gates locally during development; re-run the full set in Step 5 before the final roadmap overview update.

### Gate verification runbook

| Gate | When to run | How to verify pass | On failure |
|------|-------------|-------------------|------------|
| **1 — CI green** | After Step 1; again after every push | GitHub Actions `api-ci` job success; local simulate matches workflow | Fix workflow paths (`working-directory`, `alembic.ini`), Postgres health options |
| **2 — Coverage matrix** | After Steps 2–4 | Every row below has a named test; `pytest --collect-only -q` lists them | Add missing test before checking roadmap row |
| **3 — No live API keys** | After Step 1 | Workflow `env` has no `TMDB_API_KEY`/`OMDB_API_KEY`; `unset` locally and pytest still passes | Ensure `integration_client` uses `mock_providers` only |
| **4 — Full regression** | After every slice | `pytest tests/ -v` — 0 failures, 0 skips for DB tests | Fix test or production code before next slice |

**Optional:** Add `scripts/verify-phase2.5-gates.sh` in the final commit — wraps Gate 1 local simulate + Gate 4 + Gate 2 name grep (no live API keys, no docker compose stack required).

### Gate 1 — CI workflow green

```bash
# Push branch and confirm GitHub Actions job passes
# Locally simulate:
docker run -d --name phase25-pg -e POSTGRES_USER=cuebox -e POSTGRES_PASSWORD=cuebox \
  -e POSTGRES_DB=cuebox -p 5432:5432 pgvector/pgvector:pg16
export DATABASE_URL=postgresql+psycopg://cuebox:cuebox@localhost:5432/cuebox
export TEST_DATABASE_URL="$DATABASE_URL"
cd api && alembic upgrade head && pytest tests/ -v && ruff check app tests
```

**Pass criteria:** 0 failures; 0 integration tests skipped due to missing `DATABASE_URL`.

**Roadmap:** Check all three CI Pipeline checkboxes + first Verification Gate checkbox when GitHub Actions is green on the feature branch.

### Gate 2 — Regression coverage matrix

Verify each row with `pytest api/tests/<file>.py -v` or `pytest --collect-only -q api/tests/ | grep <test_name>`:

| Bugbot fix area | Test file | Required test (name or pattern) |
|-----------------|-----------|-----------------------------------|
| Retry old job counters | `test_import_job_invariants.py` | `test_retry_updates_old_job_counters` |
| `processed <= total` CHECK | `test_import_job_invariants.py` | asserts `processed_films <= total_films` after retry |
| `Retry-After` HTTP-date | `test_http_retry.py` | HTTP-date future parsing |
| `runtime=0` | `test_tmdb_normalization.py` | maps to `None` |
| `vote_average=0.0` | `test_tmdb_normalization.py` | persisted, not skipped |
| Reject guard | `test_review_guards.py` | `test_reject_non_review_required_returns_409` |
| Orchestrator isolation | `test_import_orchestrator_faults.py` | per-film crash + IntegrityError cases |
| Provider error message | `test_metadata_provider_errors.py` | provider HTTP errors vs not-found |

**Pass criteria:** All eight rows satisfied; DB Constraint Test Matrix edge cases covered.

**Roadmap:** Check second Verification Gate checkbox when matrix is complete.

### Gate 3 — No live API keys in CI

```bash
# Confirm workflow YAML has no TMDB_API_KEY / OMDB_API_KEY
grep -E 'TMDB_API_KEY|OMDB_API_KEY' .github/workflows/api-ci.yml && exit 1 || true
unset TMDB_API_KEY OMDB_API_KEY
export DATABASE_URL=postgresql+psycopg://cuebox:cuebox@localhost:5432/cuebox
cd api && pytest tests/ -v
```

**Pass criteria:** All tests pass with provider keys unset in shell and absent from CI env.

**Roadmap:** Third CI Pipeline checkbox + third Verification Gate checkbox.

### Gate 4 — Full regression

```bash
cd api && pytest tests/ -v
```

**Pass criteria:** All tests pass; total count ≥ 30 (baseline ~36 existing + new tests).

**Roadmap:** Fourth Verification Gate checkbox (`pytest` 0 skipped integration tests).

---

## Roadmap Update Procedure

Update [`documents/roadmap.md`](./roadmap.md) **incrementally** using the [Roadmap Checkbox Mapping](#roadmap-checkbox-mapping), then a final pass when all gates pass.

### During implementation (per slice)

1. Complete slice work and run slice gate(s).
2. Mark matching Phase 2.5 **Task Checklist** items `- [x]`.
3. Commit: `phase-2.5: <slice description> — roadmap checkboxes`.
4. Push; confirm CI green before next slice.

### Final pass (Step 5 — all gates green)

1. Mark any remaining Task Checklist and Verification Gate checkboxes.
2. Update **Overview** (line ~11):

```markdown
**Current state:** Phase 2.5 complete. CI runs Postgres-backed integration tests on every PR; adversarial unit and integration tests cover Phase 2 bugbot regression categories. Next up: Phase 3 — Semantic Enrichment & Embeddings.
```

3. Confirm Phase 3 **Depends on:** already reads `Phase 2.5` (no change needed if present).
4. Confirm dependency graph `P2 --> P2_5 --> P3` unchanged.
5. Mark all plan frontmatter todos `completed`.
6. Commit: `phase-2.5: complete — roadmap and plan todos updated`.

### Commit discipline

- Prefix commits with `phase-2.5:`.
- Each bug-class test suite in its own commit where practical.
- Include roadmap checkbox updates in the same commit as the feature they document (or in the gate-verification commit for gates-only items).

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
| Gate script (optional) | `scripts/verify-phase2.5-gates.sh` |
| Roadmap | `documents/roadmap.md` — Phase 2.5 checked off |
| Agent guidance | `AGENTS.md` — updated if CI/test commands changed |

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

1. All 13 todos in this plan frontmatter are `completed`
2. All 4 verification gates pass (document results in final PR description)
3. `documents/roadmap.md` Phase 2.5 checklist and Verification Gate section are fully checked off
4. Overview reflects Phase 2.5 complete / Phase 3 next
5. Phase 3 `Depends on` references Phase 2.5 in roadmap
6. `AGENTS.md` reviewed and updated if structural changes apply (see below)
7. Changes committed, pushed, and PR ready for review

---

## AGENTS.md Review (final step)

After all gates pass and the roadmap is updated, review [`AGENTS.md`](../AGENTS.md) for stale or missing guidance. Phase 2.5 is expected to change agent-facing workflows even though runtime architecture (compose services, ports) stays the same.

### When to update AGENTS.md

| Change in Phase 2.5 | AGENTS.md section to update |
|---------------------|----------------------------|
| New `.github/workflows/api-ci.yml` | **Lint and test** — add CI parity note: PRs must pass GitHub Actions `api-ci`; link local simulate command |
| `DATABASE_URL` / `TEST_DATABASE_URL` required for full test suite | **Lint and test** — clarify that `pytest tests/` (not only `test_health.py`) needs Postgres; document `TEST_DATABASE_URL` |
| Standard test command becomes full `pytest tests/` + `ruff` | **Lint and test** table — add row for full API test suite; align `ruff check` path with CI (`app tests` vs `.`) |
| New `scripts/verify-phase2.5-gates.sh` | **Lint and test** or **Hello-world verification** — optional gate script reference |
| PR template regression policy | No AGENTS change unless agents are instructed to use the template |

### Review checklist

Run through each item; update AGENTS.md only where the repo behaviour actually changed:

- [ ] **Compose services / ports** — unchanged (`frontend:3000`, `api:8000`, `postgres:5432`); no update unless CI adds a new local service
- [ ] **Required env vars** — CI uses `DATABASE_URL` + `TEST_DATABASE_URL` for tests; note if agents should set both for local full-suite runs
- [ ] **Lint / test commands** — table matches CI: `pytest tests/ -v`, `ruff check app tests`, `alembic upgrade head` before tests
- [ ] **Docker / bootstrap** — unchanged unless workflow documents a new bootstrap path (e.g. Actions-only Postgres container for tests)
- [ ] **New standard commands** — e.g. if ESLint is added later, not in Phase 2.5 scope unless added incidentally
- [ ] **Cursor Cloud instructions** — still accurate for nested Docker / `fuse-overlayfs` gotchas

If no structural changes apply, note in the final PR: "AGENTS.md reviewed — no updates required."

Mark plan todo `agents-md-review` complete after this review.

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Alembic path mismatch in CI | Pin `working-directory` in workflow; verify locally with same paths |
| Flaky integration timing | Use `TestClient` background task completion (no arbitrary sleep > 0.5s) |
| Postgres service startup race | Health-check `pg_isready` in workflow services options |
| Over-mocking hides real DB constraints | Job invariant tests use real Postgres, not SQLite |
| CI duration | Unit tests first in job; parallel jobs optional later |

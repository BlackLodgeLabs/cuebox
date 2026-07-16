# Issue #126: Pre-#122 SKILL trims and portability prep

**GitHub:** https://github.com/BlackLodgeLabs/cuebox/issues/126

## Summary

Reduce token and latency overhead on **workflow/docs** issues by tiering late-stage skills (demo, create-pr, babysit) and narrowing what each skill reads. Introduce a minimal **workflow config** entry point so skills stop hard-coding Cuebox paths, URLs, and gate commands — a deliberate precursor to the full portable boundary in [#122](https://github.com/BlackLodgeLabs/cuebox/issues/122).

No orchestrator or state-schema changes in this issue ([#127](https://github.com/BlackLodgeLabs/cuebox/issues/127) and #122 cover those separately).

## Problem

Recent workflow runs show predictable overhead on issues that touch only `.cursor/skills/`, `workflow/`, `scripts/cursor-workflow-*`, and docs:

| Symptom | Root cause |
|---------|------------|
| Demo agents start Docker, hit health URLs, and browse the product UI | `demo` skill always assumes full stack + `demo-spec.md` scenarios |
| Babysit runs long fix cycles on workflow-only PRs | Same loop limits and gate expectations as feature PRs |
| Create-pr re-reads entire `WORKFLOW.md` and full SPEC/PLAN | No PR seed contract; broad "read first" lists |
| Planning brings up stack for docs-only work | Bug-repro/stack path is correct for app bugs but not workflow issues |
| Execute agents over-read context or over-run gates | Default `verify-phase8-gates.sh` and long PLAN re-ingestion |
| Skills embed Cuebox URLs, ports, DB strings, phase gates | No config indirection; blocks clean Callsheet extraction (#122) |

Workflow-only issues (#103, #105) already document "no Docker stack" in PLAN/demo-spec, but skills do not **enforce** a lighter path — agents must infer from prose.

## Acceptance criteria

- [ ] **Issue tiering** — skills classify each issue as `workflow` (workflow/docs/scripts only; no `api/` or `frontend/` product changes) vs `application` (everything else). Classification rules documented in a shared helper doc referenced by all five skills.
- [ ] **Demo — light path** — for `workflow` tier: run `bash scripts/verify-workflow-paths.sh`; on exit 0, write minimal `demo-notes.md` (date, SHA, gate output, tier=`workflow`); set `demo-ready`; **do not** start Docker, browse UI, or capture screenshots unless PLAN explicitly requires product scenarios.
- [ ] **Babysit — light path** — for `workflow` tier: after first CI green + no unresolved Bugbot must-fix items, **early-exit** to `complete` without further fix cycles; loop caps `bugbot: 1`, `ci_autofix: 1` (vs default 3/2) unless PLAN overrides.
- [ ] **Create-pr — PR seeds** — PLAN must include a `## PR seed` section (≤15 lines: what/why, key changes, gate line, test steps). Create-pr skill reads PR seed + targeted PLAN excerpts + `demo-notes.md` only; does **not** require full `WORKFLOW.md` ingest (link to stage-specific excerpts instead).
- [ ] **Planning — targeted reads** — reads `WORKFLOW.md` via stage excerpt map (below), not the full file; skips stack bring-up and bug reproduction for `workflow` tier; demo-spec for workflow tier lists script-based scenarios only (no health URLs in preconditions).
- [ ] **Execute — tight scope** — emphasizes implementing PLAN steps only; default gate for `workflow` tier is `verify-workflow-paths.sh`; do not re-read full SPEC unless PLAN references acceptance criteria; do not run phase gates unless PLAN or touched paths require them.
- [ ] **Config entry point** — add `workflow/cursor-workflow/workflow.config.yaml` (committed) plus `scripts/cursor-workflow-config.sh` resolver; skills reference `{config}` variables for artifact paths, health URLs, workflow regression gate, default application gate, and repo URL pattern — no hard-coded `BlackLodgeLabs/cuebox`, `localhost:3000`, or `verify-phase8-gates.sh` in the five skills.
- [ ] **`verify-workflow-paths.sh`** — registers config file, resolver script, tiering doc, and PR-seed requirement in PLAN template or planning skill.
- [ ] **Regression** — `bash scripts/verify-workflow-paths.sh` passes; existing Cuebox workflow behavior unchanged for `application` tier issues.

## Scope

### In scope

| Area | Today | Target |
|------|-------|--------|
| `.cursor/skills/demo/SKILL.md` | Always full stack | `workflow` tier → light demo via `verify-workflow-paths.sh` |
| `.cursor/skills/babysit-pr/SKILL.md` | Uniform loop limits | `workflow` tier → reduced caps + early-exit when clean |
| `.cursor/skills/create-pr/SKILL.md` | Read SPEC, PLAN, demo-notes, template | PR seed first; targeted excerpts; no full WORKFLOW.md |
| `.cursor/skills/planning/SKILL.md` | Read full WORKFLOW.md; optional stack | Stage excerpts; skip stack for `workflow` tier; emit PR seed |
| `.cursor/skills/execute/SKILL.md` | Default phase 8 gate | Tier-aware gates; tight PLAN scope |
| Config | Hard-coded in skills | `workflow.config.yaml` + `cursor-workflow-config.sh` |
| Docs | — | `workflow/cursor-workflow/SKILL-TIERING.md` (classification + excerpt map) |
| Regression | — | Extend `verify-workflow-paths.sh` |

**Stage-specific `WORKFLOW.md` excerpts** (planning/create-pr link here; do not ingest full file):

| Skill / need | Sections |
|--------------|----------|
| All skills | `## Stages`, `## Branch and paths`, `## State file` |
| Planning | + `## Loop limits (babysit stage)`, `## GitHub labels` |
| Create-pr | + `## Visibility`, `## GitHub MCP adoption` (PR comment markers only) |
| Demo / babysit | + `## Human communication` (pass-back / blocked only) |

### Out of scope

- GitHub Actions / handoff orchestrator changes (dedup, resume, serialization) — [#127](https://github.com/BlackLodgeLabs/cuebox/issues/127)
- State schema versioning, adapter contract, installer — [#122](https://github.com/BlackLodgeLabs/cuebox/issues/122)
- Changes to `review-and-spec`, `workflow-review`, or `run-gate-scripts` skills (except cross-links if needed)
- Renaming branches, labels, or `workflow/issues/` paths
- Product API, frontend, database, or Docker Compose service changes

## User flows / API changes

No Cuebox product UI or API changes.

### Operators

1. Workflow/docs issues complete faster: demo stage is often a single script run; babysit exits once CI is green.
2. PR descriptions remain complete via PR seeds + template; quality bar unchanged for reviewers.
3. Application-feature issues follow the existing full demo/stack/babysit path (tier=`application`).

### Agents

1. **Classify tier** at planning (authoritative) and re-check at demo/create-pr/babysit/execute from PLAN front matter or `SPEC.md` scope signals (`api/`, `frontend/` in planned files → `application`).
2. **Workflow tier demo flow:**
   - Confirm stack **not** required per demo-spec preconditions
   - Run `bash scripts/verify-workflow-paths.sh` (resolve path via config)
   - Write `demo-notes.md` with gate exit line and log excerpt
   - Push `demo-ready` in one batched commit
3. **Workflow tier babysit flow:**
   - After CI green + Bugbot quiet → mark ready immediately
   - If fix needed, respect reduced loop caps; block rather than exceed
4. **Create-pr flow:**
   - Read `PLAN.md` § PR seed + § Definition of done + `demo-notes.md`
   - Fill `PR.md` from template; gate evidence line from demo-notes
5. **Config resolution:**
   - `source scripts/cursor-workflow-config.sh` or documented equivalent
   - Use `$WORKFLOW_ARTIFACT_ROOT`, `$WORKFLOW_REGRESSION_GATE`, `$APP_DEFAULT_GATE`, `$APP_HEALTH_URL_FRONTEND`, `$APP_HEALTH_URL_API`, `$GITHUB_REPO_SLUG` (exact keys in config spec)

### `workflow.config.yaml` (minimal contract — precursor to #122)

Illustrative shape (execute will finalize):

```yaml
# workflow/cursor-workflow/workflow.config.yaml
version: 1
paths:
  artifact_root: workflow/issues
  workflow_docs: workflow/cursor-workflow
  skills_root: .cursor/skills
repository:
  owner: BlackLodgeLabs
  name: cuebox
gates:
  workflow_regression: scripts/verify-workflow-paths.sh
  application_default: scripts/verify-phase8-gates.sh
environment:
  health_url_frontend: http://localhost:3000/api/v1/health
  health_url_api: http://localhost:8000/api/v1/health
  database_url_host_test: postgresql+psycopg://cuebox:cuebox@localhost:5432/cuebox
tiering:
  workflow_loop_limits:
    bugbot: 1
    ci_autofix: 1
  application_loop_limits:
    bugbot: 3
    ci_autofix: 2
```

Skills reference config keys or resolver output — not literal Cuebox strings. #122 may relocate this file under an adapter; this issue only establishes the pattern in-repo.

### PR seed (planning output — new required section)

```markdown
## PR seed

**Tier:** workflow | application
**What / why:** …
**Key changes:** …
**Gate:** Workflow regression: verify-workflow-paths.sh exit 0 at <short-sha>
**How to test:** …
```

Create-pr treats this as the primary narrative source; expands with commit log and demo-notes evidence.

## Data and integration notes

- **Application DB/API:** none
- **GitHub:** unchanged handoff contract; draft PR lifecycle unchanged
- **Cursor Cloud:** workflow-tier demos do not require Docker — reduces VM startup work
- **Coordination:**
  - **#122** — this config file is an intentional subset of the future adapter contract; do not implement schema versioning here
  - **#127** — late-stage context reuse (demo → create-pr → babysit) is complementary; this issue trims per-skill reads regardless of orchestrator resume

### Verification

| Check | Command / artifact |
|-------|-------------------|
| Portable regression | `bash scripts/verify-workflow-paths.sh` |
| Config resolver | `bash scripts/cursor-workflow-config.sh get gates.workflow_regression` (or equivalent) |
| Skill references | Grep five skills for hard-coded `localhost:`, `verify-phase8`, `BlackLodgeLabs/cuebox` — must be zero after execute |
| Dogfood | This issue's planning agent sets `tier: workflow`; demo uses light path |

## Open questions (must be empty before plan-ready)

None.

## Links

- GitHub issue: https://github.com/BlackLodgeLabs/cuebox/issues/126
- Prerequisite for: [#122 Harden portable workflow boundary](https://github.com/BlackLodgeLabs/cuebox/issues/122)
- Related orchestration hardening: [#127 v1 hardening](https://github.com/BlackLodgeLabs/cuebox/issues/127)
- Prior workflow-only examples: [#103](https://github.com/BlackLodgeLabs/cuebox/issues/103), [#105](https://github.com/BlackLodgeLabs/cuebox/issues/105)
- Callsheet extraction context: [workflow/cursor-workflow/CALLSHEET-EXTRACTION-PLAN.md](../../cursor-workflow/CALLSHEET-EXTRACTION-PLAN.md)

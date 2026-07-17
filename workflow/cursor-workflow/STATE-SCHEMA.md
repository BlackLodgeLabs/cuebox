# Workflow state schema

`workflow.state.json` is the handoff contract between cloud agents and GitHub Actions. Each issue folder under `workflow/issues/issue-{NNN}/` carries one state file; the template lives at [templates/workflow.state.json](templates/workflow.state.json).

## Current version

**`schema_version`: 1** (current)

Missing `schema_version` on in-flight branches is treated as **1** (pre-v1 files). Use `scripts/cursor-workflow-migrate-state.sh` to add the field idempotently.

## Required fields (v1)

| Field | Type | Semantics |
|-------|------|-----------|
| `issue` | number | GitHub issue number |
| `branch` | string | Workflow branch (`cursor/issue-{NNN}-{slug}`) |
| `stage` | string | Pipeline stage (see [WORKFLOW.md](WORKFLOW.md)) |
| `agents` | object | Map of skill name → agent id or `{id, …}` |
| `loops` | object | Counters: `bugbot`, `ci_autofix`, `total_runs` |

## Optional fields (v1)

| Field | Type | Semantics |
|-------|------|-----------|
| `schema_version` | number | Schema version (default 1 when absent) |
| `pr` | number \| null | Draft PR number |
| `active_skill` | string \| null | Skill currently holding the lock |
| `active_agent_id` | string \| null | Latest agent run id |
| `passback_to` | string \| null | Skill to resume on pass-back |
| `passback_reason` | string \| null | Human-readable pass-back reason |
| `handoff_pending` | object \| null | Spawn lock: `{skill, started_at, attempt}` |
| `status_comment_id` | number \| null | Cached GitHub status comment id |
| `updated_at` | string | ISO8601 timestamp |

## Compatibility policy

Aligned with [CALLSHEET-EXTRACTION-PLAN.md](CALLSHEET-EXTRACTION-PLAN.md):

| Bump | Meaning | Migration |
|------|---------|-----------|
| **Patch** | Documentation-only clarifications | None |
| **Minor** | Backward-compatible new optional fields | Optional `cursor-workflow-migrate-state.sh` step |
| **Major** | Breaking field renames or semantics | Coordinated release + migration script |

## v1 migration

```bash
bash scripts/cursor-workflow-migrate-state.sh workflow/issues/issue-NNN/workflow.state.json
```

- If `schema_version` is absent → set to `1`
- If already `1` → no-op

`cursor-workflow-merge-state.sh` applies the same default when merging (non-destructive, logged).

## Validation

Portable regression runs `scripts/cursor-workflow-validate-state.sh` on the template and every tracked `workflow/issues/issue-*/workflow.state.json`.

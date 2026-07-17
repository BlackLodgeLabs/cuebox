# Cursor workflow operations

Operator checklist for the v1 orchestrator. See [WORKFLOW.md](WORKFLOW.md) for stage semantics and [SETUP.md](SETUP.md) for secrets and bootstrap.

## Runs vs ACTIVE workspaces

Cursor Cloud Agent **runs** (status `RUNNING` / `CREATING`) count toward the global 8-run cap. **ACTIVE** workspaces persist after runs finish — they do not count toward the cap but may still appear in the agents dashboard ([#70](https://github.com/BlackLodgeLabs/cuebox/issues/70)).

| Check | Tool |
|-------|------|
| In-flight run count (cap) | `scripts/cursor-workflow-count-active-agents.sh` |
| Per-issue same-skill in-flight | `scripts/cursor-workflow-count-in-flight-for-issue.sh <issue> <skill>` |
| Windows cap diagnostic | `scripts/cursor-workflow-list-agents.ps1` |
| Linux / CI | Agents list API via `cursor-workflow-fetch-agents-list.sh` + run detail |

## Pre-flight before handoff

1. Confirm **&lt; 8** in-flight runs targeting the repo (`count-active-agents.sh`).
2. Run `scripts/cursor-workflow-housekeeping.sh` — review drift (complete folders on main, stale side-branches, `handoff_deferred` count).
3. Optional: archive orphan ACTIVE workspaces in the [Cursor agents dashboard](https://cursor.com/agents).

## When handoff stalls

| Symptom | Action |
|---------|--------|
| `handoff_deferred` set on branch | Wait for scheduled **Cursor workflow retry deferred** (every 15 min) or **Actions → Cursor workflow handoff → Run workflow** with issue number |
| At-cap deferral | Wait for runs to finish; retry workflow or comment `@cursoragent use <skill> skill for issue NNN` |
| Side-branch push ignored | Merge agent work to **canonical** `state.branch` before expecting handoff |
| Duplicate spawn blocked | Expected — `skip:duplicate-handoff` or `defer:same-skill-in-flight` |

## Human fallback template

```
@cursoragent use <skill> skill for issue NNN
```

Or: **Actions → Cursor workflow handoff → Run workflow** → issue number → enable **ensure draft PR** if `pr` is null.

## Resync vs `@cursoragent`

| Use | When |
|-----|------|
| **workflow_dispatch** resync | Labels/comment drift; recovery after deferred marker; no new agent intent |
| **`@cursoragent` comment** | Human-directed skill run; spec continuation; explicit override when automation is stuck |

## Related config

`workflow.config.yaml` → `orchestration.per_issue_spawn_serialization` (default `true`), `orchestration.late_stage_resume` (default `false`).

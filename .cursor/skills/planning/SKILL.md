---
name: planning
description: Create a detailed implementation plan with required tests, outcomes, and a demo spec from an approved feature spec. Use when workflow stage is spec-ready or when asked to plan issue NNN on a cursor/issue-* branch. Commits only; does not open a PR.
---

# Planning

Produce an implementation plan and demo spec on the existing feature branch.

## When to use

- Handoff from `review-and-spec` (`stage: spec-ready`)
- Prompt: "use planning skill for issue {NNN}"

## Read first

1. `workflow/issues/issue-{NNN}/SPEC.md`
2. `workflow/issues/issue-{NNN}/workflow.state.json`
3. [workflow/cursor-workflow/WORKFLOW.md](../../../workflow/cursor-workflow/WORKFLOW.md)
4. Relevant code areas (grep/read before planning)

## Preconditions

- Branch `cursor/issue-{NNN}-*` exists and is checked out
- Spec has no open questions in **Open questions** section
- `workflow.state.json` shows `stage: spec-ready` (or you are explicitly resuming planning)

## Start — update state (first commit)

Before planning work, commit an early state update so GitHub shows progress:

```json
{
  "stage": "plan-in-progress",
  "active_skill": "planning",
  "updated_at": "<ISO8601>"
}
```

Push (triggers status sync on the issue).

## Outputs

### 1. Implementation plan — `workflow/issues/issue-{NNN}/PLAN.md`

Include:

- **Overview** — approach in plain language
- **Files to change** — table: path, change type, rationale
- **Implementation steps** — ordered, small commits mentally grouped
- **Tests required** — unit, integration, E2E; map each to acceptance criterion
- **Gate script** — which `scripts/verify-phase*-gates.sh` to run before push (use `run-gate-scripts` skill)
- **Documentation updates** — list files under `documents/`, `README.md`, etc.
- **Risks and rollback**
- **Definition of done** — checklist execute must satisfy

### 2. Demo spec — `workflow/issues/issue-{NNN}/demo/demo-spec.md`

Instruct the demo agent what to capture on the VM:

- Preconditions (stack health URLs, seed data)
- Numbered scenarios with steps, pass criteria, and **exact artifact filenames** under `workflow/issues/issue-{NNN}/demo/`
- Reference [workflow/cursor-workflow/templates/demo-spec.md](../../../workflow/cursor-workflow/templates/demo-spec.md)

Assume **full Docker stack** on the cloud VM (frontend :3000, API :8000). API keys come from VM secrets / `.env`.

## Workflow state

Update `workflow/issues/issue-{NNN}/workflow.state.json`:

```json
{
  "stage": "plan-ready",
  "loops": { "bugbot": 0, "ci_autofix": 0, "total_runs": <increment> },
  "updated_at": "<ISO8601>"
}
```

Preserve `issue`, `branch`, `pr` fields.

## Git and labels

1. Commit plan + demo-spec + updated state; push branch.
2. Set `stage: plan-ready`, `active_skill: null` (or omit). Issue labels/comments are synced by GitHub Actions on push.

## Do not

- Write production code (execute does that)
- Open a pull request
- Skip test planning — every acceptance criterion needs a test mapping

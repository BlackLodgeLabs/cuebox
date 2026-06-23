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

1. `documents/specs/issue-{NNN}.md`
2. `demos/issue-{NNN}/workflow-state.json`
3. [documents/cursor-workflow/WORKFLOW.md](../../documents/cursor-workflow/WORKFLOW.md)
4. Relevant code areas (grep/read before planning)

## Preconditions

- Branch `cursor/issue-{NNN}-*` exists and is checked out
- Spec has no open questions in **Open questions** section
- `workflow-state.json` shows `stage: spec-ready` (or you are explicitly resuming planning)

## Outputs

### 1. Implementation plan — `documents/plans/issue-{NNN}.md`

Include:

- **Overview** — approach in plain language
- **Files to change** — table: path, change type, rationale
- **Implementation steps** — ordered, small commits mentally grouped
- **Tests required** — unit, integration, E2E; map each to acceptance criterion
- **Gate script** — which `scripts/verify-phase*-gates.sh` to run before push (use `run-gate-scripts` skill)
- **Documentation updates** — list files under `documents/`, `README.md`, etc.
- **Risks and rollback**
- **Definition of done** — checklist execute must satisfy

### 2. Demo spec — `demos/issue-{NNN}/demo-spec.md`

Instruct the demo agent what to capture on the VM:

- Preconditions (stack health URLs, seed data)
- Numbered scenarios with steps, pass criteria, and **exact artifact filenames** under `demos/issue-{NNN}/`
- Reference [demos/_template/demo-spec.md](../../demos/_template/demo-spec.md)

Assume **full Docker stack** on the cloud VM (frontend :3000, API :8000). API keys come from VM secrets / `.env`.

## Workflow state

Update `demos/issue-{NNN}/workflow-state.json`:

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
2. Issue labels: add `cursor:plan-ready`; remove `cursor:spec-ready`.
3. Comment on issue with plan summary and test strategy. No `@cursoragent` handoff comment.

## Do not

- Write production code (execute does that)
- Open a pull request
- Skip test planning — every acceptance criterion needs a test mapping

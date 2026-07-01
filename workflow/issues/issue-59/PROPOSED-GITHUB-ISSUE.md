# Copy-paste into GitHub → New issue → **Cursor feature** template

Use title: **`[Feature]: Harden cursor workflow from issue #59 review (state, pass-back, gates)`**

---

## Problem / goal

Issue [#59](https://github.com/BlackLodgeLabs/cuebox/issues/59) / PR [#60](https://github.com/BlackLodgeLabs/cuebox/pull/60) completed the feature successfully but exposed workflow gaps documented in [`workflow/issues/issue-59/WORKFLOW-REVIEW.md`](workflow/issues/issue-59/WORKFLOW-REVIEW.md):

- `workflow.state.json` loses `agents.*` IDs and progress stages when agents commit state
- Post-`complete` human feedback (pagination, Bugbot) bypassed formal stages and spawned extra agent cycles
- Demo could not reproduce Scenario 3 on re-run without manual seeding
- Babysit marked PR ready before all review feedback was addressed
- Handoffs always mint a **new** cloud agent (`POST /v1/agents`) instead of follow-up runs on the agent that already has context (`POST /v1/agents/{id}/runs`)

We need workflow scaffolding changes so the next issue is more accurate, auditable, and efficient — especially when a stage needs to **pass work back** to a prior agent (e.g. demo finds a code bug → same execute agent fixes it).

## Acceptance criteria

- [ ] **`scripts/cursor-workflow-merge-state.sh`** (or equivalent) merges remote `workflow.state.json` before agents commit; all skills updated to preserve `agents`, `pr`, `loops`, `active_agent_id`
- [ ] Agents commit correct `*-in-progress` stages before substantive work (`execute-in-progress` before code, `create-pr-in-progress` before `PR.md`, etc.)
- [ ] New terminal handoff stage **`changes-requested`** (or documented equivalent) for post-`complete` scope: converts PR to draft, routes to **execute** (not demo-only), increments `loops.total_runs`
- [ ] **Agent pass-back** supported: demo (and babysit) can set `stage: execute-passback` (or similar) with `passback_to: "execute"` and target `agents.execute` ID; handoff Action calls `POST /v1/agents/{id}/runs` instead of creating a new agent when pass-back is set
- [ ] Demo skill explicitly **forbids** production code changes on pass-back; must hand off to execute agent with structured failure notes in `demo/demo-notes.md`
- [ ] [`workflow/cursor-workflow/templates/demo-spec.md`](workflow/cursor-workflow/templates/demo-spec.md) requires explicit seed steps for conditional scenarios (`review_required`, `failed`, etc.)
- [ ] Babysit skill requires gate evidence line in `PR.md` or `demo-notes.md` before `complete` (e.g. `Phase 8 gate exit 0 at <sha>`)
- [ ] [`scripts/verify-workflow-paths.sh`](scripts/verify-workflow-paths.sh) (or new check) validates state schema, pass-back fields, and that skills reference merge-state helper
- [ ] [WORKFLOW.md](workflow/cursor-workflow/WORKFLOW.md) and [SETUP.md](workflow/cursor-workflow/SETUP.md) document pass-back, `changes-requested`, and agent ID preservation
- [ ] Dry-run on a throwaway issue OR update issue #59 state file on branch to demonstrate pass-back + preserved agent links in issue status comment

## Scope

**In scope:**

- Workflow scripts: merge-state, handoff Action pass-back branch, state schema extension (`passback_to`, optional `changes-requested` stage)
- Skill updates: `planning`, `execute`, `demo`, `create-pr`, `babysit-pr`, `review-and-spec`
- Templates: `workflow.state.json`, `demo-spec.md`
- Docs: WORKFLOW.md, SETUP.md, AGENTS.md cross-link
- Regression: extend `verify-workflow-paths.sh`

**Out of scope:**

- Changing Cuebox application features (API, frontend, etc.)
- Cursor product changes (API behaviour is given; we adapt orchestration)
- Retroactively fixing PR #60 feature code
- Bugbot/CI configuration beyond documenting when babysit may exit

## User-visible behavior

**Issue author / reviewer**

- Issue status comment always lists hyperlinked agent conversations per stage (no "—" gaps after a normal run)
- After human PR feedback post-`complete`, labels show `cursor:changes-requested` → `cursor:execute-in-progress` (not a silent code push at `complete`)
- PR returns to **draft** until babysit finishes again

**Cloud agents**

- Before committing `workflow.state.json`, run merge helper; never wipe `agents.*`
- Demo agent that hits a code defect: update `demo-notes.md`, set pass-back stage, push — does **not** edit `api/` or `frontend/`
- Execute agent receives follow-up on **same** `bc-…` ID when pass-back is used (conversation continuity)

**GitHub Actions**

- Handoff workflow: if `passback_to` is set, `POST /v1/agents/{agents[passback_to]}/runs` with prompt referencing demo notes / PR comment; else existing `POST /v1/agents` create flow
- On `changes-requested`, convert linked PR to draft before spawning execute

## Data / integration impact

- **`workflow.state.json` schema** (additive):
  - `passback_to`: optional skill key (`execute`, `babysit-pr`, …)
  - `passback_reason`: optional string (e.g. demo scenario failure summary)
  - `stage`: add `changes-requested`, `execute-passback` (exact names TBD in spec)
- **Cursor API**: use [Create A Run](https://cursor.com/docs/cloud-agent/api/endpoints) (`POST /v1/agents/{id}/runs`) for pass-back; retain create-agent for forward handoffs
- **No database / API schema migrations** for Cuebox app

## Reference

- Workflow review: [`workflow/issues/issue-59/WORKFLOW-REVIEW.md`](workflow/issues/issue-59/WORKFLOW-REVIEW.md) (top 5 recommendations)
- Example agent audit trail: same folder, timeline tables with `bc-…` links
- Cursor API pass-back: https://cursor.com/docs/cloud-agent/api/endpoints

---

_After creating the issue, comment **`@cursoragent spec`** to start the spec agent._

## Related Issue

Closes #126

[Link to GitHub Issue](https://github.com/BlackLodgeLabs/cuebox/issues/126)

## Description

**What does this PR do?**

Late-stage workflow skills (planning, execute, demo, create-pr, babysit) over-read context and assume full Docker/product gates even for docs-only issues. This PR adds **issue tiering** (`workflow` vs `application`), a committed **config entry point** (`workflow.config.yaml` + `cursor-workflow-config.sh`), and enforces a **light path** for workflow-tier issues — running `verify-workflow-paths.sh` instead of starting Docker, with reduced babysit loop caps and early-exit when CI is clean.

**Why is this the best approach?**

Tier classification is documented once in `SKILL-TIERING.md` and referenced by all five late-stage skills, so agents no longer infer the lighter path from scattered PLAN prose. Config indirection removes hard-coded Cuebox URLs, ports, and gate commands from skills — an intentional precursor to the portable boundary in #122 without touching orchestrator or state schema (#127).

## Changes Proposed

* Added `workflow/cursor-workflow/workflow.config.yaml` — committed config for paths, repo slug, gates, health URLs, and tier loop limits.
* Added `scripts/cursor-workflow-config.sh` — shell resolver exporting `$WORKFLOW_*`, `$APP_*`, and `$GITHUB_REPO_SLUG` variables.
* Added `scripts/test-cursor-workflow-config.sh` — offline unit tests for the config resolver.
* Added `workflow/cursor-workflow/SKILL-TIERING.md` — tier definitions, `WORKFLOW.md` excerpt map, PR seed contract, and per-tier behavior summary.
* Updated five skills (`planning`, `execute`, `demo`, `create-pr`, `babysit-pr`) — tier branching, config indirection, narrowed reads, PR seed consumption, light demo/babysit paths.
* Extended `scripts/verify-workflow-paths.sh` — registers config, resolver, tiering doc, PR-seed checks, and grep guards for forbidden literals in skills.
* Minor cross-links in `WORKFLOW.md` and `AGENTS.md`.

## Scenario Results

**Workflow tier — script verification only** (no Docker stack or UI screenshots required).

Gate evidence from demo:

```
Workflow regression: scripts/verify-workflow-paths.sh exit 0 at 2e9e110
PASS: no legacy workflow paths found
```

| # | Scenario | Result |
|---|----------|--------|
| 1 | Config entry point | **PASS** |
| 2 | Tiering documentation | **PASS** |
| 3 | Skill updates (five skills) | **PASS** |
| 4 | Workflow regression gate | **PASS** |
| 5 | Application tier preserved | **PASS** |

Demo logs: [scenario-1-config.log](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cursor/issue-126-pre-122-skill-trims-portability-prep/workflow/issues/issue-126/demo/scenario-1-config.log), [scenario-4-regression.log](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cursor/issue-126-pre-122-skill-trims-portability-prep/workflow/issues/issue-126/demo/scenario-4-regression.log)

## How to Test

1. Checkout this branch: `git checkout cursor/issue-126-pre-122-skill-trims-portability-prep`
2. Verify config resolver: `source scripts/cursor-workflow-config.sh && echo "$WORKFLOW_REGRESSION_GATE" "$GITHUB_REPO_SLUG"`
3. Run config unit tests: `bash scripts/test-cursor-workflow-config.sh`
4. Run workflow regression gate: `bash scripts/verify-workflow-paths.sh`
5. Confirm no hard-coded Cuebox strings in five skills:
   ```bash
   rg 'localhost:|verify-phase8-gates\.sh|BlackLodgeLabs/cuebox' .cursor/skills/{planning,execute,demo,create-pr,babysit-pr}/SKILL.md
   ```
   Expect zero matches.
6. Confirm `workflow/issues/issue-126/PLAN.md` contains `## PR seed` with `**Tier:** workflow`.
7. Confirm `workflow/issues/issue-126/demo/demo-spec.md` has no Docker or health URL preconditions.

No product stack (`docker compose up`) required for this workflow-only change.

## Known Issues / Notes for Reviewer

* This is a precursor to #122 (portable boundary) — config file may relocate under an adapter later; no state schema or handoff YAML changes in this PR.
* Application-tier issues retain full-stack demo path and 3/2 babysit loop limits — documented in `SKILL-TIERING.md`.
* Grep guard in `verify-workflow-paths.sh` enforces zero forbidden literals in the five skills going forward.

## Gate evidence

- [x] Workflow regression: `scripts/verify-workflow-paths.sh` exit 0 at `2e9e110`

## Checklist

- [ ] I have tested these changes locally
- [ ] I have updated the documentation accordingly
- [ ] My code follows the style guidelines of this project
- [ ] I have performed a self-review of my own code

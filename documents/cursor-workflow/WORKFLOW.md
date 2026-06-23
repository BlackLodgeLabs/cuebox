# Cursor multi-agent issue workflow

Reusable pipeline: GitHub issue → spec → plan → execute → demo → babysit → human review.

## Stages

| Stage | Trigger | Agent skill | Output |
|-------|---------|-------------|--------|
| 1 | You create issue | — | GitHub issue |
| 2 | You comment `@cursoragent spec` | `review-and-spec` | Branch + `documents/specs/issue-NNN.md` |
| 2b | You comment `@cursoragent continue spec` | `review-and-spec` | Resume after clarifications |
| 3 | Handoff (`spec-ready`) | `planning` | `documents/plans/issue-NNN.md`, `demos/issue-NNN/demo-spec.md` |
| 4 | Handoff (`plan-ready`) | `execute` | Code, docs, pushes to **existing draft PR** |
| 5 | Handoff (`execute-ready`) | `demo` | Artifacts under `demos/issue-NNN/` |
| 6 | Handoff (`demo-ready`) | `babysit-pr` | PR marked ready; loops until clean or blocked |
| 7 | GitHub notification | You | Final review and merge |

## Branch and paths

- **Branch:** `cursor/issue-{NNN}-{slug}` (slug from issue title, lowercase, hyphens)
- **Feature spec:** `documents/specs/issue-{NNN}.md`
- **Implementation plan:** `documents/plans/issue-{NNN}.md`
- **Demo spec + artifacts:** `demos/issue-{NNN}/` (`demo-spec.md`, screenshots, recordings, `workflow-state.json`)
- **Base branch:** `main`
- **PR:** One long-lived **draft** PR opened by GitHub Actions at `spec-ready` (not by cloud agents); execute pushes commits; babysit marks it **ready for review**

## State file

`demos/issue-{NNN}/workflow-state.json` is the handoff contract. The GitHub Action `.github/workflows/cursor-workflow-handoff.yml` reads `stage` on push and spawns the next cloud agent.

Handoff stages (trigger next agent): `spec-ready`, `plan-ready`, `execute-ready`, `demo-ready`.

Terminal stages: `complete`, `blocked`, `spec-needs-info`.

## Loop limits (babysit stage)

| Counter | Max |
|---------|-----|
| `loops.bugbot` | 3 |
| `loops.ci_autofix` | 2 |
| `loops.total_runs` | 10 |

When any limit is exceeded: set `stage` to `blocked`, add label `cursor:blocked`, post summary on issue + PR, stop.

## GitHub labels

Create these on the repository (colors are suggestions):

| Label | Purpose |
|-------|---------|
| `cursor:spec-needs-info` | Spec agent waiting on your answers |
| `cursor:spec-ready` | Spec committed; planning queued |
| `cursor:plan-ready` | Plan committed; execute queued |
| `cursor:execute-ready` | Code/tests done; demo queued |
| `cursor:demo-ready` | Demo artifacts committed; babysit queued |
| `cursor:complete` | Babysit finished; ready for your review |
| `cursor:blocked` | Loop limit or unrecoverable failure |

## Human triggers (only you)

- Start spec: `@cursoragent spec` (or `@cursoragent use review-and-spec`)
- Resume spec: `@cursoragent continue spec`
- Do **not** rely on bot `@cursoragent` comments for handoffs (filtered by GitHub/Cursor).

Automated stages 3–6 use the handoff Action or Cursor Automations (see [SETUP.md](SETUP.md)).

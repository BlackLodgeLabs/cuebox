# Workflow artifacts

## Active issues (`main`)

Per-issue specs, plans, state, and demo evidence for **in-flight** work live under `workflow/issues/issue-{NNN}/`.

| Path | Created by |
|------|------------|
| `SPEC.md` | `review-and-spec` |
| `PLAN.md` | `planning` |
| `workflow.state.json` | `review-and-spec` (init) — updated by each stage |
| `demo/demo-spec.md` | `planning` |
| `demo/demo-notes.md` | `demo` |
| `demo/*.png`, `demo/*.mp4` | `demo` |
| `PR.md` | `create-pr` |
| `WORKFLOW-REVIEW.md` | `workflow-review` (human-triggered, [#79](https://github.com/BlackLodgeLabs/cuebox/issues/79)) |

## Completed issues (archive)

After a PR merges to `main`, GitHub Actions moves `workflow/issues/issue-N/` to **`issue-N/`** on the [`workflow/archive`](https://github.com/BlackLodgeLabs/cuebox/tree/workflow/archive) branch and removes it from `main`.

- Index of lessons learned: [cursor-workflow/RETROSPECTIVES.md](cursor-workflow/RETROSPECTIVES.md)
- Manual archive: `bash scripts/cursor-workflow-archive-completed-issue.sh NNN`

## PR media links

Use **commit SHA** or the **`workflow/archive`** branch in `raw.githubusercontent.com` URLs — not `main` paths for demo images after merge.

```text
https://raw.githubusercontent.com/{owner}/{repo}/{commit-sha}/workflow/issues/issue-{NNN}/demo/foo.png
```

Large MP4s: attach to the PR comment and link from `demo-notes.md`.

## Legacy paths

Do not recreate `documents/cursor-workflow/`, `documents/specs/`, `documents/plans/`, or `demos/`.

Regression: `bash scripts/verify-workflow-paths.sh`

Workflow docs and templates: [cursor-workflow/](cursor-workflow/)

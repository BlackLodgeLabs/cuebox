# Workflow artifacts

Per-issue specs, plans, state, and demo evidence live **only** under `workflow/issues/issue-{NNN}/`.

Legacy paths (`documents/cursor-workflow/`, `documents/specs/`, `documents/plans/`, `demos/`) were removed after the workflow consolidation — do not recreate them.

| Path | Created by |
|------|------------|
| `SPEC.md` | `review-and-spec` |
| `PLAN.md` | `planning` |
| `workflow.state.json` | `review-and-spec` (init) — updated by each stage |
| `demo/demo-spec.md` | `planning` |
| `demo/demo-notes.md` | `demo` |
| `demo/*.png`, `demo/*.mp4` | `demo` |
| `PR.md` | `create-pr` |

Workflow documentation and templates: [cursor-workflow/](cursor-workflow/).

Copy [cursor-workflow/templates/](cursor-workflow/templates/) when bootstrapping manually. Agents create `workflow/issues/issue-{NNN}/` automatically.

Regression check: `bash scripts/verify-workflow-paths.sh` (fails if legacy directories or path strings reappear).

Large binaries: prefer short MP4s; GitHub warns above ~50MB. For long recordings, attach to the PR comment instead and note the URL in `demo/demo-notes.md`.

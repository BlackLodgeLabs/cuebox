# Workflow artifacts

Per-issue specs, plans, state, and demo evidence live under `workflow/issues/issue-{NNN}/`.

| Path | Created by |
|------|------------|
| `SPEC.md` | `review-and-spec` |
| `PLAN.md` | `planning` |
| `workflow.state.json` | `review-and-spec` (init) — updated by each stage |
| `demo/demo-spec.md` | `planning` |
| `demo/demo-notes.md` | `demo` |
| `demo/*.png`, `demo/*.mp4` | `demo` |

Workflow documentation and templates: [cursor-workflow/](cursor-workflow/).

Copy [cursor-workflow/templates/](cursor-workflow/templates/) when bootstrapping manually. Agents create `workflow/issues/issue-{NNN}/` automatically.

Large binaries: prefer short MP4s; GitHub warns above ~50MB. For long recordings, attach to the PR comment instead and note the URL in `demo/demo-notes.md`.

# Demo artifacts

Per-issue demo specs and evidence live under `demos/issue-{NNN}/`.

| File | Created by |
|------|------------|
| `workflow-state.json` | `review-and-spec` (init) — updated by each stage |
| `demo-spec.md` | `planning` |
| `demo-notes.md` | `demo` |
| `*.png`, `*.mp4` | `demo` |

Copy `demos/_template/` when bootstrapping manually. Agents create `demos/issue-{NNN}/` automatically.

Large binaries: prefer short MP4s; GitHub warns above ~50MB. For long recordings, attach to the PR comment instead and note the URL in `demo-notes.md`.

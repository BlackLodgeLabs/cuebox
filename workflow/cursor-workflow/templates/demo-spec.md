# Demo spec — issue #0 (template)

Planning agent replaces this file per issue. Demo agent follows it exactly.

## Preconditions

- Full Docker stack running (`docker compose ps` — frontend :3000, API :8000, DB ok)
- Seeded watchlist present (cloud Part 2 gate) unless the change is API-only

### Seed steps

_Required when any scenario depends on non-default DB state (`review_required`, `failed`, empty watchlist, etc.)._

1. _(List exact commands or API calls to reach the required state before scenarios run.)_

## Scenarios

### Scenario 1: (title)

**Goal:** What this proves about the change.

**Steps:**

1. Open http://localhost:3000/...
2. ...

**Capture:**

- Screenshot: `workflow/issues/issue-0/demo/scenario-1-after.png`
- Optional screen recording: `workflow/issues/issue-0/demo/scenario-1.mp4` (keep under 30s if possible)

**Pass criteria:**

- ...

## Artifacts checklist

- [ ] All screenshots listed above saved under `workflow/issues/issue-{NNN}/demo/`
- [ ] `workflow/issues/issue-{NNN}/demo/demo-notes.md` with short narrative of what was shown
- [ ] No secrets in images or logs

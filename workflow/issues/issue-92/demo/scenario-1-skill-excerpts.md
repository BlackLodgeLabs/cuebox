# Scenario 1 — Skill excerpts (batched push and SHA amend)

Source: `.cursor/skills/create-pr/SKILL.md` (issue #92 branch)

## Start — optional progress push (no PR.md)

```markdown
Optionally push `create-pr-in-progress` before drafting `PR.md` (progress signal only; **no `PR.md`** in that push). This stage does **not** trigger babysit — only `create-pr-ready` does.

**Required:** Commit `create-pr-in-progress` before writing `PR.md` or other substantive work (same rule as execute `execute-in-progress`).
```

## Demo image URLs — resolve SHA before handoff push

```markdown
Resolve SHA **before** the handoff-triggering push: URLs must reference the commit that **contains** `PR.md` (the commit about to be pushed, or amended in place). Get SHA with `git rev-parse HEAD` on that local commit. ...

Do **not** push `PR.md` with `create-pr-ready` until demo image URLs are final
Do **not** push then amend SHA in a **second** push (use `git commit --amend` before the single push instead)
Do **not** make a follow-up "fix demo image SHA" push after `create-pr-ready`
```

## Git and state — batched final push

```markdown
The handoff-triggering push must be **exactly one** commit containing complete `PR.md` + `workflow.state.json` with `stage: create-pr-ready`. Use this sequence:

1. Read sources locally (no `PR.md` push yet).
2. Draft `PR.md` locally (placeholders OK for SHA).
3. Run merge helper; set `stage: create-pr-ready` + increment `loops.total_runs` in `workflow.state.json` locally.
4. `git add PR.md` + `workflow.state.json`
5. `git commit -m "docs(workflow): PR description for issue #NNN"`
6. `git rev-parse HEAD` → embed SHA in `raw.githubusercontent.com` URLs in `PR.md`
7. If URLs changed: `git add PR.md && git commit --amend --no-edit` (still one commit)
8. **Single** `git push` → one handoff run

Expected push pattern: 1–2 pushes total (optional early `create-pr-in-progress` without `PR.md`; one `create-pr-ready` push with complete `PR.md`).
```

## WORKFLOW.md cross-reference (create-pr push batching)

From `workflow/cursor-workflow/WORKFLOW.md` § Create-pr push batching (issue #92):

- Expected push pattern: optional `create-pr-in-progress` (no `PR.md`), then **one** handoff push with complete `PR.md` + `create-pr-ready`.
- References issues [#79](https://github.com/BlackLodgeLabs/cuebox/issues/79) and [#84](https://github.com/BlackLodgeLabs/cuebox/issues/84).
- Agents must amend SHA before single push; no follow-up SHA fix push.

## automation-prompts/create-pr.md alignment

Automation prompt includes: optional `create-pr-in-progress` (no PR.md); batched final push with amend-if-needed; single handoff-triggering push only.

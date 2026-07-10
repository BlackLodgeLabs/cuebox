# Automation: Create PR (optional backup)

**Trigger:** Push with `stage: demo-ready`  
**Repository:** This repo  

## Prompt

```text
Read workflow.state.json. If stage is demo-ready:

- Use the create-pr skill for that issue number
- Read SPEC.md, PLAN.md, demo-notes.md, and git log on the branch
- Fill workflow/cursor-workflow/templates/PR.md structure; save as workflow/issues/issue-NNN/PR.md
- Demo screenshots in Scenario Results must use absolute `raw.githubusercontent.com` URLs (not relative `demo/...` paths) — see create-pr skill
- Optional: push once with create-pr-in-progress (no PR.md) for progress visibility
- Batched final push: draft PR.md locally → set stage create-pr-ready in workflow.state.json → commit PR.md + state → git rev-parse HEAD → embed SHA in demo URLs → git commit --amend if URLs changed → single push (one handoff-triggering push only; no follow-up SHA fix push)
```

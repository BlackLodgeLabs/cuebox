# Automation: Planning (optional backup)

Use only if not relying on `.github/workflows/cursor-workflow-handoff.yml`.

**Trigger:** Push to branch matching `cursor/issue-*`  
**Repository:** This repo  
**Model:** Your preferred cloud model  

## Prompt

```text
A push landed on a cursor/issue-* branch. Read workflow/issues/issue-*/workflow.state.json on the branch.

If stage is spec-ready:
- Use the planning skill for that issue number
- For app bugs: reproduce the issue and commit demo/bug-repro-* evidence before PLAN.md
- Commit workflow/issues/issue-NNN/PLAN.md and workflow/issues/issue-NNN/demo/demo-spec.md
- Set stage to plan-ready and push

If stage is plan-needs-info:
- User must comment @cursoragent continue plan first (human trigger)
- Resume planning skill; complete bug repro then PLAN.md

Otherwise do nothing.
```

**Tools:** Enable PR creation off; repo read/write via cloud agent defaults.

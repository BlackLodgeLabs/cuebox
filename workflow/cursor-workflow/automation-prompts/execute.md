# Automation: Execute (optional backup)

**Trigger:** Push to `cursor/issue-*` with `stage: plan-ready` in workflow.state.json  
**Repository:** This repo  

## Prompt

```text
Read workflow/issues/issue-*/workflow.state.json. If stage is plan-ready:

- Use the execute skill for that issue number
- Implement workflow/issues/issue-NNN/PLAN.md
- Run tests and gate scripts before push
- Set stage to execute-ready and push (do not create a PR)
```

**Tools:** PR creation off.

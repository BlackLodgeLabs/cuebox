# Automation: Babysit PR (optional backup)

**Trigger:** Push to `cursor/issue-*` with `stage: demo-ready`  

## Prompt

```text
Read workflow-state.json. If stage is demo-ready:

Use the babysit-pr skill for the issue PR:
- Fix Bugbot, CI, and review feedback within limits (bugbot 3, ci_autofix 2, total 10)
- Re-run gate scripts before each fix push
- When clean: mark draft PR ready for review, stage complete, label cursor:complete
- If limits exceeded: stage blocked, label cursor:blocked, stop
```

# Automation: Execute (optional backup)

**Trigger:** Push to `cursor/issue-*` with `stage: plan-ready` in workflow-state  
**Repository:** This repo  

## Prompt

```text
Read demos/issue-*/workflow-state.json. If stage is plan-ready:

Use the execute skill for that issue:
- Implement documents/plans/issue-NNN.md
- Run all tests and verify-phase8-gates.sh (or plan-specified gate) BEFORE push
- Update documentation as required
- Open DRAFT PR to main if pr is null in state
- Set stage execute-ready and push
```

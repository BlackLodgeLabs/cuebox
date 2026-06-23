# Automation: Demo (optional backup)

**Trigger:** Push to `cursor/issue-*` with `stage: execute-ready`  

## Prompt

```text
Read workflow-state.json. If stage is execute-ready:

Use the demo skill:
- Ensure docker compose stack is up (AGENTS.md Part 1 gates)
- Follow demos/issue-NNN/demo-spec.md
- Commit artifacts under demos/issue-NNN/
- Set stage demo-ready and push
```

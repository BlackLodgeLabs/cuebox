# Automation: Demo (optional backup)

**Trigger:** Push with `stage: execute-ready`  
**Repository:** This repo  

## Prompt

```text
Read workflow.state.json. If stage is execute-ready:

- Use the demo skill for that issue number
- Full Docker stack must be running
- Follow workflow/issues/issue-NNN/demo/demo-spec.md
- Commit artifacts under workflow/issues/issue-NNN/demo/
- Set stage to demo-ready and push
```

# Automation: Babysit PR (optional backup)

**Trigger:** Push with `stage: demo-ready`  
**Repository:** This repo  

## Prompt

```text
Read workflow.state.json. If stage is demo-ready:

- Use the babysit-pr skill for that issue number
- Loop limits: bugbot 3, ci_autofix 2, total 10
- Mark PR ready for review when clean; set stage to complete
```

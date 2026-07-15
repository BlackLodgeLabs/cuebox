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
- Use the demo skill batched final push sequence (see .cursor/skills/demo/SKILL.md § "Git and state — batched final push"):
  - Draft demo-notes.md locally; set stage: demo-ready with active_skill: null
  - git add artifacts + demo-notes.md + workflow.state.json; commit; embed SHA via git commit --amend if needed
  - Single git push (one handoff-triggering push at demo-ready)
- MCP PR scenario summary comment happens after the single push
```

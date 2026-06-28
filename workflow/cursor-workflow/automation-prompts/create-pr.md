# Automation: Create PR (optional backup)

**Trigger:** Push with `stage: demo-ready`  
**Repository:** This repo  

## Prompt

```text
Read workflow.state.json. If stage is demo-ready:

- Use the create-pr skill for that issue number
- Read SPEC.md, PLAN.md, demo-notes.md, and git log on the branch
- Fill workflow/cursor-workflow/templates/PR.md structure; save as workflow/issues/issue-NNN/PR.md
- Set stage to create-pr-ready and push
```

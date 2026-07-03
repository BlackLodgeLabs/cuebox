## Related Issue

[Link to GitHub Issue](https://github.com/OWNER/REPO/issues/NNN)

## Description

**What does this PR do?**
[Briefly explain the problem you are solving and the approach you took to solve it.]

**Why is this the best approach?**
[Optional: Briefly explain your architectural choices if you had to make a complex decision.]

## Changes Proposed

* Added `[Component Name]` to handle [specific UI task].
* Updated `[API Endpoint]` to return [specific data].
* Refactored `[File/Function]` to improve performance.

## Scenario Results

*(Includes embedded Screenshots / Screen Recordings from demo - this is essential for UI/Frontend changes)*

Use **absolute** `raw.githubusercontent.com` URLs — not relative `demo/...` paths. `PR.md` is copied to the GitHub PR description, where relative links resolve against `/pull/...` and break.

```markdown
![Scenario 1](https://raw.githubusercontent.com/OWNER/REPO/BRANCH/workflow/issues/issue-NNN/demo/scenario-1.png)
```

`BRANCH` = `workflow.state.json` → `branch`; `NNN` = issue number.

## How to Test

*(Provide step-by-step instructions for the reviewer)*

1. Checkout this branch: `git checkout feature/your-branch-name`
2. Start the development server: `npm run dev`
3. Navigate to `http://localhost:3000/your-feature-route`
4. Do [Action A] and verify that [Result B] occurs.
5. Check responsive behavior on mobile view.

## Known Issues / Notes for Reviewer

* [e.g., "I left a TODO on line 45 regarding a future edge case."]
* [e.g., "This relies on the new database migration, make sure to run `npx prisma db push`."]

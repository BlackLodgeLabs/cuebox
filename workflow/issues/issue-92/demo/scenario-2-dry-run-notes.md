# Scenario 2 — Simulated create-pr commit pattern (dry run)

**Date:** 2026-07-08  
**Location:** Ephemeral `mktemp` git repo (not pushed to issue branch)

## Commands run

```bash
WORKDIR=$(mktemp -d)
cd "$WORKDIR"
git init -q
git config user.email "demo@cuebox.local"
git config user.name "Demo Agent"

mkdir -p workflow/issues/issue-92
# Draft PR.md with PLACEHOLDER_SHA in raw URL
# Draft workflow.state.json with stage: create-pr-ready
git add workflow/issues/issue-92/PR.md workflow/issues/issue-92/workflow.state.json
git commit -m "docs(workflow): PR description for issue #92 (dry run)"

SHA=$(git rev-parse HEAD)
sed -i "s/PLACEHOLDER_SHA/$SHA/" workflow/issues/issue-92/PR.md
git add workflow/issues/issue-92/PR.md
git commit --amend --no-edit
```

## Results

| Check | Result |
|-------|--------|
| Commits with `create-pr-ready` + `PR.md` | **1** |
| Second commit for SHA URL fix | **No** |
| `git log -1 --name-only` includes `PR.md` | **Yes** |
| `git log -1 --name-only` includes `workflow.state.json` | **Yes** |
| Amend used after embedding SHA | **Yes** |

## Commit details

- Pre-amend SHA: `f6f8cc1c3a67c6a347f573c55674b10aa3ccbad1`
- Post-amend SHA (single commit): `161ba0db5123d45f11a047c52146f852901f5f23`
- Files in commit: `workflow/issues/issue-92/PR.md`, `workflow/issues/issue-92/workflow.state.json`

## Script guard (PLAN Step 4)

**Deferred** — per PLAN.md Step 4 ("defer by default") and SPEC.md ("optional script guard is explicitly deferred"). No changes to `cursor-workflow-admission-gate.sh` or `test-cursor-workflow-handoff.sh` in execute. Skill-only batched-push guidance is sufficient for this workflow-only issue; measurement in this demo shows a single local commit pattern without needing admission-gate idempotency.

## Pass

Scenario 2 **PASS** — documented workflow yields exactly one `create-pr-ready` handoff commit; no follow-up SHA-fix push.

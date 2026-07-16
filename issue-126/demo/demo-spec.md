# Demo spec — issue #126

Workflow-tier change (no product UI/API). Demo agent validates config resolver, tiering doc, skill updates, and regression scripts — **light path** per `SKILL-TIERING.md`.

**Tier:** `workflow`

## Preconditions

- Full Docker stack **not required**
- Branch: `cursor/issue-126-pre-122-skill-trims-portability-prep`
- Draft PR **#128** linked in `workflow.state.json`
- Repo root is current working directory

### Seed steps

None (no database or product state required).

## Scenarios

### Scenario 1: Config entry point

**Goal:** Committed config and resolver export documented variables.

**Steps:**

1. Confirm `workflow/cursor-workflow/workflow.config.yaml` exists with `version: 1` and keys: `paths`, `repository`, `gates`, `environment`, `tiering`.
2. Run `bash scripts/cursor-workflow-config.sh get gates.workflow_regression` — expect `scripts/verify-workflow-paths.sh`.
3. Run `source scripts/cursor-workflow-config.sh` then `echo "$WORKFLOW_REGRESSION_GATE" "$APP_DEFAULT_GATE" "$GITHUB_REPO_SLUG"` — all non-empty.
4. Run `bash scripts/test-cursor-workflow-config.sh` — exit 0.

**Capture:**

- Log: `workflow/issues/issue-126/demo/scenario-1-config.log`

**Pass criteria:**

- Config file and resolver work; test script exits 0

### Scenario 2: Tiering documentation

**Goal:** `SKILL-TIERING.md` defines classification, excerpt map, and PR seed contract.

**Steps:**

1. Verify `workflow/cursor-workflow/SKILL-TIERING.md` exists.
2. Confirm it documents `workflow` vs `application` tiers and classification rules (`api/`/`frontend/` → application).
3. Confirm excerpt map table matches SPEC (planning/create-pr/demo/babysit sections).
4. Confirm PR seed template is documented.
5. Confirm `workflow/issues/issue-126/PLAN.md` contains `## PR seed` with `**Tier:** workflow`.

**Capture:**

- Log: `workflow/issues/issue-126/demo/scenario-2-tiering.log`

**Pass criteria:**

- Tiering doc complete; this issue’s PLAN dogfoods PR seed

### Scenario 3: Skill updates (five skills)

**Goal:** Late-stage skills reference config and tier behavior; no hard-coded Cuebox strings.

**Steps:**

1. For each skill (`planning`, `execute`, `demo`, `create-pr`, `babysit-pr`), confirm `SKILL.md`:
   - References `SKILL-TIERING.md` and/or `cursor-workflow-config.sh`
   - Documents `workflow` vs `application` tier branching
2. Grep five skills for forbidden literals — expect **zero** matches:
   - `localhost:`
   - `verify-phase8-gates.sh`
   - `BlackLodgeLabs/cuebox`
3. Confirm `demo` skill documents light path (no Docker for workflow tier).
4. Confirm `create-pr` skill reads PR seed first (not full SPEC/WORKFLOW.md).
5. Confirm `babysit-pr` documents workflow-tier early-exit and reduced loop caps.

**Capture:**

- Log: `workflow/issues/issue-126/demo/scenario-3-skills.log`

**Pass criteria:**

- All five skills updated; grep guard passes

### Scenario 4: Workflow regression gate

**Goal:** Extended `verify-workflow-paths.sh` passes and registers new artifacts.

**Steps:**

1. Run `bash scripts/verify-workflow-paths.sh` — exit 0.
2. Confirm output includes `PASS: no legacy workflow paths found` (or equivalent success line).
3. Record short commit SHA: `git rev-parse --short HEAD`.

**Capture:**

- Log: `workflow/issues/issue-126/demo/scenario-4-regression.log`

**Pass criteria:**

- Gate exits 0 at recorded SHA

### Scenario 5: Application tier preserved (static)

**Goal:** Application-tier behavior is still documented for feature issues.

**Steps:**

1. In `SKILL-TIERING.md`, confirm `application` tier still requires full Docker demo path and default application gate.
2. In `demo/SKILL.md`, confirm `application` tier section retains stack/health-check instructions (via config vars, not literals).
3. In `babysit-pr/SKILL.md`, confirm application loop limits remain 3/2.

**Capture:**

- Log: `workflow/issues/issue-126/demo/scenario-5-application-tier.log`

**Pass criteria:**

- Application path documented; not removed by workflow-tier trims

## Artifacts checklist

- [ ] `scenario-1-config.log`
- [ ] `scenario-2-tiering.log`
- [ ] `scenario-3-skills.log`
- [ ] `scenario-4-regression.log`
- [ ] `scenario-5-application-tier.log`
- [ ] `workflow/issues/issue-126/demo/demo-notes.md` with date, commit SHA, `tier=workflow`, gate evidence line, scenario pass/fail table
- [ ] No secrets in logs

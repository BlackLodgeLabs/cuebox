# Callsheet extraction and adoption plan

## Purpose

This plan covers the work after Cuebox completes the portable-workflow hardening pass tracked in [#122](https://github.com/BlackLodgeLabs/cuebox/issues/122):

1. Create the Callsheet repository from the hardened core.
2. Reorganize and rebrand it.
3. Release `callsheet v1.0.0`.
4. Install that release into Cuebox as the first consumer.
5. Adopt a repeatable release and update process.

It deliberately does not prescribe implementation details for #122. That issue defines the configuration boundary, state-schema compatibility contract, and core-versus-adapter test split that this plan requires.

## Decisions to make before implementation

| Decision | Recommendation | Reason |
| --- | --- | --- |
| Distribution model | Versioned installer CLI plus an installed manifest | Gives application repositories reviewed, pinned copies with a simple explicit update path. |
| Version policy | SemVer for Callsheet; independently version the workflow state schema | Installer updates need a clear compatibility and migration decision. |
| Runtime source | Run the installed Callsheet version from the application repository | A workflow run must not change behavior because an unpinned remote `main` changed midway through an issue. |
| Adapter ownership | Application repository | Test commands, demo flow, CI workflow names, service URLs, and Cloud environment setup belong to the application. |
| Cutover | No in-flight Callsheet-managed issue branches | Prevents old and new branch/path/label conventions from running concurrent handoff Actions. |
| Repository history | Preserve relevant workflow history where practical; exclude active and archived Cuebox issue artifacts | Keeps rationale for the orchestration while avoiding customer-specific issue history in the product repository. |

## Target model

Callsheet consists of a portable core and an application-owned adapter.

```text
Callsheet release
  package/
    scripts/                 # handoff, state, lifecycle helpers
    skills/                  # generic workflow skills
    workflows/               # installable GitHub Actions templates
    templates/               # state, issue, PR, and demo templates
    schema/                  # versioned workflow state schema and migrations
    tests/                   # portable regression fixtures and tests
    docs/
    bin/                     # installer and updater entry points

Application repository after installation
  callsheet/
    manifest.json            # installed release, schema version, checksums
    config.yaml              # app-owned adapter configuration
    scripts/                 # installed immutable core for this release
    templates/
  .cursor/skills/
    callsheet-*/             # installer-managed skill entry points
  .github/workflows/
    callsheet-*.yml          # installer-managed Action entry points
```

The installed manifest is owned by Callsheet. `callsheet/config.yaml` is owned by the application and must be preserved by updates. A generated-file header identifies files the installer owns, their source release, and whether local edits block automatic update.

## Step 2 — Create the Callsheet repository

### Inputs

- The hardening pass from #122 is merged and its core and Cuebox-adapter checks pass.
- No unfinished design decisions remain for the configuration contract or state-schema compatibility policy.
- Cuebox workflow issue artifacts are identified as product data, not scaffold content.

### Work

1. Create a new repository named `callsheet`.
2. Import the generic workflow documentation, templates, helper scripts, Actions, skills, fixtures, and portable regression tests.
3. Exclude:
   - `workflow/issues/issue-*` active artifacts;
   - the Cuebox archive branch and retrospectives that are specific to Cuebox issues;
   - Cuebox product source, Docker bootstrap scripts, application gate scripts, and Cloud environment configuration.
4. Add project-level documentation:
   - product purpose and architecture;
   - supported host requirements: GitHub Actions, Cursor Cloud Agents, GitHub integration, and required secrets;
   - installer and updater design;
   - adapter contract and reference configuration;
   - support/versioning policy.
5. Establish repository CI that runs portable shell tests, schema validation, template rendering tests, and installer fixture tests.
6. Set branch protection and release permissions before publishing the first release.

### Exit criteria

- The Callsheet repository contains no Cuebox application or issue-history data.
- A clean clone can run all portable checks without a Cuebox Docker stack.
- Documentation identifies every required application-side adapter input.

## Step 3 — Reorganize and rebrand

### Naming rules

Rename workflow-owned identifiers to Callsheet:

- repository, package, docs, installer commands, workflow files, skills, templates, labels, status comments, branches, and installed artifact paths;
- use `callsheet/issue-<number>-<slug>` as the default branch convention;
- use `callsheet:*` labels and `Callsheet workflow` in human-visible status messages.

Do not rename actual Cursor integration identifiers:

- `.cursor/skills`;
- `CURSOR_API_KEY`;
- Cursor API URLs and Cloud Agent terminology;
- GitHub/Cursor integration guidance.

### Work

1. Put the canonical portable implementation under the Callsheet package layout described above; do not retain workflow scripts in a generic application `scripts/` directory.
2. Make Actions and skills resolve the configured Callsheet root rather than hard-coded Cuebox paths.
3. Materialize required root-level integration files from templates:
   - GitHub Actions remain in `.github/workflows/`;
   - Cursor-discoverable skills remain in `.cursor/skills/`;
   - the issue template remains in `.github/ISSUE_TEMPLATE/`.
4. Add a single `callsheet/config.yaml` specification with defaults for:
   - base branch, branch pattern, artifact path, label prefix, archive branch;
   - agent cap, stale-lock duration, and loop limits;
   - adapter commands for validation, demo, CI discovery, and environment verification.
5. Add a `schema_version` to the workflow state template and implement idempotent migrations for every supported prior schema version.
6. Make every CallSheet-owned file identifiable by a generated-file header and record its checksum in the manifest.
7. Test the rebrand with a fixture repository that exercises status synchronization, handoff target resolution, state merge, recovery, and post-merge cleanup.

### Exit criteria

- Searching the Callsheet portable core for `cuebox`, Cuebox ports, phase gates, and Cuebox CI paths produces no functional dependencies.
- All new human-facing identifiers say Callsheet while required Cursor integration names remain unchanged.
- The package can render an installable fixture without hand editing generated files.

## Step 4 — Build and release `callsheet v1.0.0`

### Installer behavior

Implement an installer CLI with commands conceptually equivalent to:

```text
callsheet install <release>
callsheet update [<release>]
callsheet status
callsheet doctor
```

The final packaging technology may be a portable shell release asset, Node package, Python package, or standalone binary; it must work in the target Cloud Agent environment without depending on Cuebox tooling.

`install` must:

1. resolve an immutable tag or release artifact, never a moving branch;
2. create the installed Callsheet core and manifest;
3. create or validate the application adapter configuration;
4. render the root-level Actions, skills, and issue template;
5. report required manual setup such as labels, `CURSOR_API_KEY`, GitHub App access, and Cloud environment requirements;
6. support `--dry-run` and fail before modifying a non-empty conflicting managed file.

`update` must:

1. compare the installed manifest with the target release;
2. preserve application-owned adapter fields;
3. apply state-schema/config migrations in a documented order;
4. stop on edited installer-owned files unless the operator explicitly resolves the conflict;
5. show the release, changed files, migration result, and post-update verification commands.

### Release validation

1. Install into an empty fixture repository.
2. Configure a minimal adapter and validate generated files.
3. Exercise install → `status` → update to a newer prerelease fixture → `doctor`.
4. Verify state-schema migration with representative historical state fixtures.
5. Run workflow regression checks against the installed fixture, including safe mock handoff execution.
6. Publish signed or checksummed release artifacts and release notes with upgrade instructions.

### Exit criteria

- `v1.0.0` is immutable and documented.
- Installation and update tests run in CI from clean fixture repositories.
- Every installed core file is traceable to a release manifest.

## Step 5 — Install `callsheet v1.0.0` into Cuebox

### Preconditions

- No active Cuebox issue is between `spec-ready` and `complete`.
- Existing branch, label, Action, and artifact conventions are documented for retirement.
- Required GitHub labels and `CURSOR_API_KEY` are available for the new Callsheet convention.

### Work

1. Create a Cuebox migration branch dedicated to the first Callsheet installation.
2. Run `callsheet install` against the immutable `v1.0.0` release.
3. Write the Cuebox adapter configuration using its existing test gates, Docker stack, service health checks, CI workflows, and Cloud environment bootstrap.
4. Remove or disable the legacy embedded workflow entry points in the same cutover change so two handoff Actions cannot process the same push.
5. Preserve legacy issue artifacts according to the existing archive policy; do not relocate in-flight artifacts.
6. Validate generated files and required GitHub configuration with `callsheet doctor`.
7. Run a real, low-risk Cuebox issue through the complete Callsheet pipeline:
   - issue creation and spec trigger;
   - draft PR creation;
   - plan, execute, demo, PR-description, and babysit handoffs;
   - status comment and label synchronization;
   - pass-back/recovery behavior where safely mockable;
   - post-merge archive behavior.

### Exit criteria

- Cuebox uses only the installed Callsheet core and its Cuebox adapter.
- A full issue-to-PR run completes using the pinned `v1.0.0` manifest.
- The migration PR documents the installed version, adapter settings, and operator recovery path.

## Step 6 — Operate Callsheet as a product

### Release process

1. Make workflow feature and hardening changes in the Callsheet repository.
2. Require portable CI, fixture installation/update tests, and state-schema compatibility tests before release.
3. Publish a tagged SemVer release with migration notes and a compatibility matrix.
4. Update Cuebox on a dedicated branch with `callsheet update <version>`.
5. Review the generated-file diff, config migration, and `callsheet doctor` output before merging.
6. Run a smoke workflow in Cuebox for releases that change Actions, state transitions, skills, or installer behavior.

### Compatibility policy

- Patch releases may fix portable behavior without changing the state schema.
- Minor releases may add backward-compatible configuration and schema migrations.
- Major releases may change default conventions or remove support only with an explicit migration path.
- The updater must refuse unsafe schema downgrades and explain the required recovery path.
- Active application issue branches retain their installed core version until the application explicitly updates; no remote runtime fetch may silently change them.

### Success measures

- A new application repository can install Callsheet without copying internal Cuebox files.
- Cuebox can update Callsheet with one reviewed, reproducible change set.
- A second application can install the latest stable release independently of Cuebox.
- Workflow improvements are made once in Callsheet and adopted by applications through explicit version upgrades.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| A state migration disrupts an in-flight issue | Require schema compatibility tests, block updates during active pipeline runs, and retain an explicit rollback procedure. |
| Generated files are locally edited | Track checksums in the manifest and require an explicit conflict resolution rather than overwriting them. |
| Two workflow Actions react to one push | Treat the Cuebox installation as an atomic cutover and remove/disable legacy triggers in the same merge. |
| Callsheet becomes coupled to Cuebox again | Keep Cuebox gates, CI names, Docker requirements, and environment setup in the adapter; assert this in portable CI. |
| An update changes behavior mid-run | Use installed, immutable release content; update only through a reviewed application-repository commit. |

## Deliverables

- Callsheet repository with a portable core, adapter contract, installer/updater, tests, and release documentation.
- Immutable `callsheet v1.0.0` release.
- Cuebox installation PR using `v1.0.0` and a documented Cuebox adapter.
- A repeatable operating guide for developing Callsheet, releasing it, and adopting updates in application repositories.

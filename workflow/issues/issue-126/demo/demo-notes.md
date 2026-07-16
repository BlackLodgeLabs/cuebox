# Demo notes — issue #126

| Field | Value |
|-------|-------|
| Date | 2026-07-16T18:38:24Z |
| Commit SHA | `2e9e1106b4ad812d07a9dbab55d86fa8f85a4dc8` (short: `2e9e110`) |
| Tier | `workflow` |
| Branch | `cursor/issue-126-pre-122-skill-trims-portability-prep` |
| PR | #128 |

## Gate evidence

```
Workflow regression: scripts/verify-workflow-paths.sh exit 0 at 2e9e110
PASS: no legacy workflow paths found
```

## Scenario results

| # | Scenario | Result | Log |
|---|----------|--------|-----|
| 1 | Config entry point | **PASS** | [scenario-1-config.log](scenario-1-config.log) |
| 2 | Tiering documentation | **PASS** | [scenario-2-tiering.log](scenario-2-tiering.log) |
| 3 | Skill updates (five skills) | **PASS** | [scenario-3-skills.log](scenario-3-skills.log) |
| 4 | Workflow regression gate | **PASS** | [scenario-4-regression.log](scenario-4-regression.log) |
| 5 | Application tier preserved | **PASS** | [scenario-5-application-tier.log](scenario-5-application-tier.log) |

## Notes

- Workflow-tier light path per `SKILL-TIERING.md` — no Docker stack or UI required.
- All five late-stage skills reference config/tiering; grep guard found zero forbidden literals (`localhost:`, `verify-phase8-gates.sh`, `BlackLodgeLabs/cuebox`).
- Application-tier full-stack path and 3/2 babysit loop limits remain documented.

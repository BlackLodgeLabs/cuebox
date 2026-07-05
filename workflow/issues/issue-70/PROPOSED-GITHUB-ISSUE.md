# GitHub issue #70 — v1 workflow hardening (from issue #28 review)

**Created:** https://github.com/BlackLodgeLabs/cuebox/issues/70

Decisions captured during issue authoring (2026-07-03 — 2026-07-04):

| # | Topic | Decision |
|---|--------|----------|
| 1 | Packaging | One bundled issue |
| 2 | #28 / PR #67 | Future-only (no babysit recovery in scope) |
| 3 | Babysit recovery | Re-spawn on stable `create-pr-ready`; no `babysit-queued` stage |
| 4 | Demo serialization | `handoff_pending` lock + skip if `agents.<skill>` set |
| 5 | API quota | A+: global **8-agent cap**, admission gate, defer/retry |
| 6 | Progress stages / CI | Skills + templates only; CI guard deferred to [#68](https://github.com/BlackLodgeLabs/cuebox/issues/68) |
| 7 | Title | `[Feature]: Harden cursor workflow from issue #28 review (handoff dedup, quota, babysit recovery)` |
| 8 | Metadata | `enhancement` label; no milestone; assign to owner (manual — token could not assign) |
| 9 | Validation | `verify-workflow-paths.sh` + shell tests (no live throwaway issue) |

v2 design draft: [#68](https://github.com/BlackLodgeLabs/cuebox/issues/68)

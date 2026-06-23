---
name: run-gate-scripts
description: Run Cuebox phase verification gate scripts (verify-phase*-gates.sh) and related PRD/smoke checks. Use when validating changes, fixing CI failures, running regression tests, or when the user mentions gates, phase verification, or pre-PR checks. Works on cloud agents and local dev.
paths:
  - "scripts/verify-*-gates.sh"
  - "scripts/verify-prd-success-criteria.sh"
  - "scripts/smoke-test.sh"
  - "api/**"
  - "frontend/**"
---

# Run gate scripts

Run the appropriate `scripts/verify-*-gates.sh` gate before pushing. **Execute** and **babysit-pr** skills require gates to pass first.

## Pick the right gate

| If you changed… | Run |
| --- | --- |
| Full regression / pre-merge | `bash scripts/verify-phase8-gates.sh` |
| Developer Mode | `bash scripts/verify-phase7-gates.sh` |
| Design tokens | `bash scripts/verify-phase6.5-gates.sh` |
| Frontend MVP | `bash scripts/verify-phase6-gates.sh` |
| Recommendations | `bash scripts/verify-phase5-gates.sh` |
| CSV/RSS sync | `bash scripts/verify-phase4-gates.sh` |
| Semantic enrichment | `bash scripts/verify-phase3-gates.sh` |
| Schema/import regression | `bash scripts/verify-phase2.5-gates.sh` |

## Cloud gotchas

```bash
export DATABASE_URL=postgresql+psycopg://cuebox:cuebox@localhost:5432/cuebox
export TEST_DATABASE_URL="$DATABASE_URL"
```

Before host `npm run build` with compose frontend running:

```bash
docker compose stop frontend && sudo rm -rf frontend/.next
```

See [AGENTS.md](../../../AGENTS.md) for full lint/test tables.

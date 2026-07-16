#!/usr/bin/env bash
# Workflow-tier regression entry point: portable core + Cuebox adapter checks.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

bash scripts/verify-workflow-portable.sh
bash scripts/verify-workflow-cuebox-adapter.sh

echo "PASS: no legacy workflow paths found"

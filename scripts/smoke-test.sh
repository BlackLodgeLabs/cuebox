#!/usr/bin/env bash
# Live stack smoke test — requires docker compose up, config.yaml, .env, and letterboxd/watchlist.csv.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== Cuebox smoke test ==="
echo "Prerequisites:"
echo "  - docker compose up (API on :8000, Postgres healthy)"
echo "  - config.yaml and .env with TMDB_API_KEY"
echo "  - letterboxd/watchlist.csv (optional; override with CSV_PATH)"
echo ""

exec bash scripts/verify-phase2-gates.sh

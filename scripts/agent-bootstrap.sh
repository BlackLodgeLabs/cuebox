#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

bash scripts/cloud-bootstrap-env.sh

echo "Waiting for API health..."
for _ in $(seq 1 120); do
  if curl -sf http://localhost:8000/api/v1/health 2>/dev/null | grep -q '"database":"ok"'; then
    break
  fi
  sleep 2
done

film_count=$(docker compose exec -T postgres psql -U cuebox -d cuebox -tAc "SELECT count(*) FROM films" 2>/dev/null | tr -d '[:space:]' || echo "0")

if [[ "${film_count:-0}" == "0" ]]; then
  echo "Seeding dev database..."
  python3 scripts/seed-dev-db.py
  echo "Dev DB seeded."
else
  echo "DB already has ${film_count} films — skipping seed."
fi

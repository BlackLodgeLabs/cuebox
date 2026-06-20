#!/usr/bin/env bash
# Idempotent local/.env setup for Docker Compose (cloud agents and first-time dev).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

cp -n config.example.yaml config.yaml 2>/dev/null || true
if [[ ! -f .env ]]; then
  cp .env.example .env
fi

# Inside Compose, the API service reaches Postgres at hostname "postgres".
COMPOSE_DATABASE_URL="${DATABASE_URL:-postgresql+psycopg://cuebox:cuebox@postgres:5432/cuebox}"

set_or_replace_env() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" .env; then
    sed -i "s|^${key}=.*|${key}=${value}|" .env
  else
    echo "${key}=${value}" >> .env
  fi
}

# Always ensure Compose has a database URL (empty .env.example leaves this unset).
set_or_replace_env DATABASE_URL "$COMPOSE_DATABASE_URL"

# Mirror dashboard/runtime secrets into .env for services using env_file: .env
for key in TMDB_API_KEY OPENAI_API_KEY OMDB_API_KEY VOYAGE_API_KEY ANTHROPIC_API_KEY; do
  value="${!key:-}"
  if [[ -n "$value" ]]; then
    set_or_replace_env "$key" "$value"
  fi
done

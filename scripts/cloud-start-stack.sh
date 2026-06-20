#!/usr/bin/env bash
# Wait for dockerd then start the full Compose stack (cloud agent stack terminal).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

until docker info >/dev/null 2>&1; do
  sleep 1
done

exec docker compose up --build

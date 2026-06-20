#!/usr/bin/env bash
# Wait for dockerd then start the full Compose stack (cloud agent stack terminal).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

bash scripts/cloud-ensure-docker.sh

exec docker compose up --build

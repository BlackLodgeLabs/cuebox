#!/usr/bin/env bash
# Wait for dockerd, start the full Compose stack, seed dev DB if empty (cloud agent stack terminal).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

bash scripts/cloud-ensure-docker.sh

docker compose up --build -d

bash scripts/agent-bootstrap.sh

# Follow logs in foreground for the stack terminal
exec docker compose up

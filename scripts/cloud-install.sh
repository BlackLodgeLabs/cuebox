#!/usr/bin/env bash
# Cursor Cloud environment install: bootstrap config, Docker, Python/Node deps,
# Playwright Chromium, and warm Compose images for faster agent start.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

log() {
  echo "[cloud-install] $*" >&2
}

log "Bootstrapping .env / config.yaml"
bash scripts/cloud-bootstrap-env.sh

log "Ensuring Docker is installed and running"
bash scripts/cloud-ensure-docker.sh

log "Installing API Python package (editable + dev extras)"
(
  cd api
  pip install -e ".[dev]"
)

log "Installing frontend npm dependencies"
(
  cd frontend
  npm ci
)

log "Installing Playwright Chromium (and OS deps when needed)"
(
  cd frontend
  # --with-deps needs root; fall back to browser-only if apt deps fail.
  if ! npx playwright install --with-deps chromium; then
    log "playwright --with-deps failed; retrying browser-only install"
    npx playwright install chromium
  fi
)

log "Warming Compose images (pull Postgres + build services)"
docker compose pull postgres
docker compose build

log "Cloud install complete"

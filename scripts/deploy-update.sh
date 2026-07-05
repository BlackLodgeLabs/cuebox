#!/usr/bin/env bash
# Deploy an updated Cuebox release on a Docker Compose server (LAN or local).
# Backs up Postgres, pulls git, rebuilds images, restarts the stack, and verifies health.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SKIP_BACKUP=0
SKIP_PULL=0
SKIP_VERIFY=0
STOP_SERVICES=0
ALLOW_DIRTY=0
GIT_REF="main"
HEALTH_HOST="${HEALTH_HOST:-localhost}"

usage() {
  cat <<'EOF'
Usage: bash scripts/deploy-update.sh [options]

Deploy updated code to a running Cuebox Docker Compose server.

Options:
  --ref REF           Git ref to deploy (default: main)
  --skip-backup       Skip the pre-deploy database backup
  --skip-pull         Skip git fetch/pull (rebuild/restart only)
  --skip-verify       Skip post-deploy health checks
  --stop-services     Stop API and frontend before rebuild (brief downtime)
  --health-host HOST  Host for health checks (default: localhost)
  --allow-dirty       Allow deploy with uncommitted working tree changes
  -h, --help          Show this help

Environment:
  HEALTH_HOST         Same as --health-host

Preserves across deploys: .env, config.yaml, postgres_data volume, data/backups/.
Never run: docker compose down -v (wipes the database).

Rollback: git checkout <previous-sha> && bash scripts/deploy-update.sh --skip-pull
          Restore DB from data/backups/ if needed â€” see documents/database-backup-restore.md
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ref)
      GIT_REF="${2:?--ref requires a value}"
      shift 2
      ;;
    --skip-backup) SKIP_BACKUP=1; shift ;;
    --skip-pull) SKIP_PULL=1; shift ;;
    --skip-verify) SKIP_VERIFY=1; shift ;;
    --stop-services) STOP_SERVICES=1; shift ;;
    --health-host)
      HEALTH_HOST="${2:?--health-host requires a value}"
      shift 2
      ;;
    --allow-dirty) ALLOW_DIRTY=1; shift ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "FAIL: required command not found: $1" >&2
    exit 1
  fi
}

warn_config_drift() {
  local example target
  for example in .env.example config.example.yaml; do
    target="${example%.example}"
    if [[ ! -f "$target" ]]; then
      echo "WARN: missing $target â€” copy from $example before first deploy" >&2
      continue
    fi
    if ! diff -q "$example" "$target" >/dev/null 2>&1; then
      echo "WARN: $target differs from $example â€” review for new settings:" >&2
      diff "$example" "$target" || true
    fi
  done
}

verify_health() {
  local base api_url frontend_health_url frontend_url api_body frontend_body http_code

  base="http://${HEALTH_HOST}"
  api_url="${base}:8000/api/v1/health"
  frontend_health_url="${base}:3000/api/v1/health"
  frontend_url="${base}:3000"

  echo ""
  echo "=== Verifying deployment ==="
  docker compose ps

  api_body="$(mktemp)"
  frontend_body="$(mktemp)"
  trap 'rm -f "$api_body" "$frontend_body"' RETURN

  if ! curl -sf "$api_url" -o "$api_body"; then
    echo "FAIL: API health check failed: $api_url" >&2
    return 1
  fi

  if ! curl -sf "$frontend_health_url" -o "$frontend_body"; then
    echo "FAIL: Frontend proxy health check failed: $frontend_health_url" >&2
    return 1
  fi

  if ! grep -q '"status"[[:space:]]*:[[:space:]]*"ok"' "$api_body"; then
    echo "FAIL: API health status is not ok" >&2
    cat "$api_body" >&2
    return 1
  fi

  if ! grep -q '"database"[[:space:]]*:[[:space:]]*"ok"' "$api_body"; then
    echo "FAIL: API database health is not ok" >&2
    cat "$api_body" >&2
    return 1
  fi

  if ! grep -q '"status"[[:space:]]*:[[:space:]]*"ok"' "$frontend_body"; then
    echo "FAIL: Frontend health status is not ok" >&2
    cat "$frontend_body" >&2
    return 1
  fi

  http_code="$(curl -sf -o /dev/null -w "%{http_code}" "$frontend_url" || true)"
  if [[ "$http_code" != "200" ]]; then
    echo "FAIL: Frontend returned HTTP ${http_code} (expected 200): $frontend_url" >&2
    return 1
  fi

  if command -v python3 >/dev/null 2>&1; then
    echo "API health:"
    python3 -m json.tool <"$api_body"
    echo "Frontend health:"
    python3 -m json.tool <"$frontend_body"
  else
    echo "API health: $(cat "$api_body")"
    echo "Frontend health: $(cat "$frontend_body")"
  fi

  echo "PASS: deployment healthy (frontend HTTP 200)"
}

echo "=== Cuebox deploy update ==="
echo "Repo: $ROOT"
echo "Target ref: $GIT_REF"
echo ""

require_cmd git
require_cmd docker
require_cmd curl

if ! docker compose version >/dev/null 2>&1; then
  echo "FAIL: docker compose is not available" >&2
  exit 1
fi

if [[ ! -f docker-compose.yml ]]; then
  echo "FAIL: docker-compose.yml not found in $ROOT" >&2
  exit 1
fi

if [[ "$ALLOW_DIRTY" -eq 0 ]] && { ! git diff --quiet || ! git diff --cached --quiet; }; then
  echo "FAIL: working tree has uncommitted changes (use --allow-dirty to override)" >&2
  exit 1
fi

echo "Current revision: $(git log -1 --oneline)"
docker compose ps || true
echo ""

if [[ "$SKIP_BACKUP" -eq 0 ]]; then
  echo "=== Pre-deploy backup ==="
  bash scripts/backup-db.sh
  ls -lh data/backups/ 2>/dev/null || true
  echo ""
else
  echo "Skipping pre-deploy backup (--skip-backup)"
  echo ""
fi

if [[ "$SKIP_PULL" -eq 0 ]]; then
  echo "=== Pulling $GIT_REF ==="
  git fetch origin "$GIT_REF"
  current_branch="$(git rev-parse --abbrev-ref HEAD)"
  if [[ "$current_branch" != "$GIT_REF" ]]; then
    git checkout "$GIT_REF"
  fi
  git pull --ff-only origin "$GIT_REF"
  echo "Updated revision: $(git log -1 --oneline)"
  echo ""
else
  echo "Skipping git pull (--skip-pull)"
  echo ""
fi

warn_config_drift
echo ""

if [[ "$STOP_SERVICES" -eq 1 ]]; then
  echo "=== Stopping API and frontend ==="
  docker compose stop api frontend
  echo ""
fi

echo "=== Rebuild and restart stack ==="
docker compose up --build -d
echo ""

if [[ "$SKIP_VERIFY" -eq 0 ]]; then
  verify_health
else
  echo "Skipping health verification (--skip-verify)"
  docker compose ps
fi

echo ""
echo "Deploy complete."

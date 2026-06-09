#!/bin/sh
set -euo pipefail

# Keep node_modules in sync when package-lock.json changes (e.g. after git pull).
# The compose file mounts an anonymous volume at /app/node_modules, which can
# otherwise retain packages from an older image build.
npm ci

exec npm run dev -- -H 0.0.0.0

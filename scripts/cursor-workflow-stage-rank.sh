#!/usr/bin/env bash
# Print numeric rank for a workflow stage (higher = further along pipeline).
# Usage: cursor-workflow-stage-rank.sh [stage-name]
#        echo stage-name | cursor-workflow-stage-rank.sh
set -euo pipefail

stage="${1:-}"
if [ -z "$stage" ]; then
  stage=$(cat)
fi
stage=$(echo "$stage" | tr -d '[:space:]')

case "$stage" in
  spec-in-progress) echo 10 ;;
  spec-needs-info) echo 15 ;;
  spec-ready) echo 20 ;;
  plan-in-progress) echo 25 ;;
  plan-needs-info) echo 26 ;;
  plan-ready) echo 28 ;;
  execute-in-progress) echo 30 ;;
  execute-ready) echo 40 ;;
  demo-in-progress) echo 50 ;;
  execute-passback) echo 55 ;;
  demo-ready) echo 60 ;;
  create-pr-in-progress) echo 70 ;;
  create-pr-ready) echo 80 ;;
  babysit-in-progress) echo 90 ;;
  complete|blocked) echo 100 ;;
  changes-requested) echo 105 ;;
  "") echo -1 ;;
  *) echo -1 ;;
esac

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
  spec-needs-info|plan-needs-info) echo 0 ;;
  spec-in-progress) echo 10 ;;
  spec-ready) echo 20 ;;
  plan-in-progress) echo 25 ;;
  plan-ready) echo 28 ;;
  execute-in-progress|execute-passback) echo 30 ;;
  execute-ready|changes-requested) echo 40 ;;
  demo-in-progress) echo 50 ;;
  demo-ready) echo 60 ;;
  create-pr-in-progress) echo 70 ;;
  create-pr-ready) echo 80 ;;
  babysit-in-progress) echo 90 ;;
  complete|blocked) echo 100 ;;
  "") echo -1 ;;
  *) echo -1 ;;
esac

#!/usr/bin/env bash
# Recover missed babysit handoff when stage is create-pr-ready but no babysit agent recorded.
# Usage: cursor-workflow-babysit-recovery.sh <issue> <branch> <state-file>
set -euo pipefail

ISSUE="${1:?}"
BRANCH="${2:?}"
STATE_FILE="${3:?}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WF="${WF:-${SCRIPTS_DIR:-$SCRIPT_DIR}}"

"$WF/cursor-workflow-handoff-recovery.sh" "$ISSUE" "$BRANCH" "$STATE_FILE"

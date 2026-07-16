#!/usr/bin/env bash
# Idempotent v0→v1 migration: add schema_version when missing.
# Usage: cursor-workflow-migrate-state.sh <path-to-workflow.state.json>
set -euo pipefail

STATE_FILE="${1:?usage: cursor-workflow-migrate-state.sh <path-to-workflow.state.json>}"

if [[ ! -f "$STATE_FILE" ]]; then
  echo "State file not found: $STATE_FILE" >&2
  exit 1
fi

if ! jq empty "$STATE_FILE" 2>/dev/null; then
  echo "Invalid JSON in ${STATE_FILE}" >&2
  exit 1
fi

if jq -e 'has("schema_version")' "$STATE_FILE" >/dev/null 2>&1; then
  version="$(jq -r '.schema_version' "$STATE_FILE")"
  echo "No migration needed (schema_version=${version})"
  exit 0
fi

jq '.schema_version = 1' "$STATE_FILE" > "${STATE_FILE}.tmp" && mv "${STATE_FILE}.tmp" "$STATE_FILE"
echo "Migrated ${STATE_FILE} to schema_version=1"

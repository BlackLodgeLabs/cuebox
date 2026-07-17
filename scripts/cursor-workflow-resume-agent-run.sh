#!/usr/bin/env bash
# Resume an existing Cursor agent (POST /v1/agents/{id}/runs).
# Usage: cursor-workflow-resume-agent-run.sh <agent-id> <prompt> <out-json-file>
# stdout: http status code. Exit 0 on success or 409 busy defer.
set -euo pipefail

AGENT_ID="${1:?}"
PROMPT="${2:?}"
OUT_FILE="${3:-/tmp/cursor-resume-run.json}"

mock_curl_post_runs() {
  local url="$1"
  local out_file="$2"
  local code="${MOCK_CURSOR_POST_CODE:-201}"
  if [ -n "${MOCK_CURSOR_RUNS_COUNT_FILE:-}" ]; then
    local count=0
    [ -f "$MOCK_CURSOR_RUNS_COUNT_FILE" ] && count=$(cat "$MOCK_CURSOR_RUNS_COUNT_FILE")
    count=$((count + 1))
    echo "$count" > "$MOCK_CURSOR_RUNS_COUNT_FILE"
  fi
  if [ -n "${MOCK_CURSOR_RESUME_URL_FILE:-}" ]; then
    echo "$url" > "$MOCK_CURSOR_RESUME_URL_FILE"
  fi
  if [ -f "${MOCK_CURSOR_POST_RESPONSE:-}" ]; then
    cp "${MOCK_CURSOR_POST_RESPONSE}" "$out_file"
  else
    echo '{"id":"bc-mock-run-id"}' > "$out_file"
  fi
  echo "$code"
}

payload=$(jq -n --arg text "$PROMPT" '{prompt: {text: $text}}')

if [ "${MOCK_CURSOR_API:-}" = "1" ]; then
  http_code=$(mock_curl_post_runs "https://api.cursor.com/v1/agents/${AGENT_ID}/runs" "$OUT_FILE")
elif [ -n "${CURSOR_API_KEY:-}" ]; then
  http_code=$(curl -sS -o "$OUT_FILE" -w "%{http_code}" \
    -X POST "https://api.cursor.com/v1/agents/${AGENT_ID}/runs" \
    -u "${CURSOR_API_KEY}:" \
    -H "Content-Type: application/json" \
    -d "$payload")
else
  echo 0
  exit 1
fi

echo "$http_code"

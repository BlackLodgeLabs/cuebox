#!/usr/bin/env bash
# Fetch paginated Cursor agents list once per Actions job; cache to CURSOR_AGENTS_LIST_CACHE.
# Prints cache file path on stdout.
#
# Items are accumulated and wrapped via temp files / jq file inputs — never
# `jq --argjson` with the full list on argv (Linux ARG_MAX; issue #117).
set -euo pipefail

CACHE="${CURSOR_AGENTS_LIST_CACHE:-${RUNNER_TEMP:-/tmp}/cursor-agents-list.json}"
export CURSOR_AGENTS_LIST_CACHE="$CACHE"

bump_fetch_count() {
  if [ -n "${MOCK_CURSOR_LIST_FETCH_COUNT_FILE:-}" ]; then
    current=$(cat "${MOCK_CURSOR_LIST_FETCH_COUNT_FILE}" 2>/dev/null || echo 0)
    echo $((current + 1)) > "${MOCK_CURSOR_LIST_FETCH_COUNT_FILE}"
  fi
}

if [ -f "$CACHE" ] && [ -s "$CACHE" ]; then
  echo "$CACHE"
  exit 0
fi

if [ "${MOCK_CURSOR_LIST_FETCH_FAIL:-}" = "1" ]; then
  echo "Mock Cursor agent-list fetch failure" >&2
  exit 1
fi

if [ "${MOCK_CURSOR_API:-}" = "1" ]; then
  if [ -n "${MOCK_AGENTS_LIST_JSON:-}" ] && [ -f "${MOCK_AGENTS_LIST_JSON}" ]; then
    cp "${MOCK_AGENTS_LIST_JSON}" "$CACHE"
  else
    echo '{"items":[]}' > "$CACHE"
  fi
  bump_fetch_count
  echo "$CACHE"
  exit 0
fi

if [ -z "${CURSOR_API_KEY:-}" ]; then
  echo '{"items":[]}' > "$CACHE"
  echo "$CACHE"
  exit 0
fi

REPO="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY required}"
pr_url_filter="${CURSOR_AGENTS_PR_URL:-}"
if [ -z "$pr_url_filter" ] && [ -n "${CURSOR_AGENTS_STATE_FILE:-}" ] && [ -f "${CURSOR_AGENTS_STATE_FILE}" ]; then
  pr=$(jq -r '.pr // empty' "${CURSOR_AGENTS_STATE_FILE}")
  if [ -n "$pr" ] && [ "$pr" != "null" ]; then
    pr_url_filter="https://github.com/${REPO}/pull/${pr}"
  fi
fi

tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT
items_file="${tmpdir}/items.json"
page_file="${tmpdir}/page.json"
echo '[]' > "$items_file"

page_cursor=""
while true; do
  url="https://api.cursor.com/v1/agents?limit=100&includeArchived=false"
  if [ -n "$page_cursor" ]; then
    url="${url}&cursor=${page_cursor}"
  elif [ -n "$pr_url_filter" ]; then
    encoded_pr=$(python3 -c "import urllib.parse, sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$pr_url_filter")
    url="${url}&prUrl=${encoded_pr}"
  fi
  curl -fsS -u "${CURSOR_API_KEY}:" "$url" -o "$page_file"
  jq -s 'add' "$items_file" <(jq '.items // []' "$page_file") > "${tmpdir}/items.next.json"
  mv "${tmpdir}/items.next.json" "$items_file"

  page_cursor=$(jq -r '.nextCursor // empty' "$page_file" | tr -d '\r')
  if [ -z "$page_cursor" ] || [ "$page_cursor" = "null" ]; then
    break
  fi
done

if [ -n "$pr_url_filter" ]; then
  pr_slug="${pr_url_filter#https://github.com/}"
  if jq --arg pr "$pr_url_filter" --arg slug "$pr_slug" '
    [.[] | select(
      ((.prUrl // "") == $pr)
      or ((.prUrl // "") | endswith("/" + ($slug | split("/") | last)))
    )]
  ' "$items_file" > "${tmpdir}/items.filtered.json"; then
    mv "${tmpdir}/items.filtered.json" "$items_file"
  fi
fi

# File input — never --argjson with the full list on argv.
jq '{items: .}' "$items_file" > "$CACHE"

bump_fetch_count
echo "$CACHE"

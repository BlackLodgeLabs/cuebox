#!/usr/bin/env bash
# Read text from stdin; print unique issue numbers from Closes/Fixes #N lines.
# Safe under pipefail when no keywords match (grep may exit 1).
set -euo pipefail

BODY="$(cat)"
KEYWORD_MATCHES="$(printf '%s\n' "$BODY" | grep -oiE '(close[sd]?|fixe[sd]?)\s+#[0-9]+' || true)"
if [[ -z "$KEYWORD_MATCHES" ]]; then
  exit 0
fi
printf '%s\n' "$KEYWORD_MATCHES" | grep -oiE '#[0-9]+' | tr -d '#' | sort -nu || true

#!/usr/bin/env bash
# Shared helpers for real-git cursor workflow integration tests (issue #90).
set -euo pipefail

git_remote_fixture_init() {
  local issue="$1"
  local branch="${2:-cursor/issue-${issue}-test}"
  local state_rel="workflow/issues/issue-${issue}/workflow.state.json"

  GIT_REMOTE_DIR=$(mktemp -d)
  GIT_CLONE_DIR=$(mktemp -d)
  GIT_REMOTE_BRANCH="$branch"
  GIT_REMOTE_STATE_REL="$state_rel"

  git init -q --bare "$GIT_REMOTE_DIR"
  git -C "$GIT_CLONE_DIR" init -q
  git -C "$GIT_CLONE_DIR" config user.email "test@example.com"
  git -C "$GIT_CLONE_DIR" config user.name "Test User"
  git -C "$GIT_CLONE_DIR" remote add origin "$GIT_REMOTE_DIR"
  git -C "$GIT_CLONE_DIR" checkout -q -b "$GIT_REMOTE_BRANCH"
}

git_remote_fixture_push_state() {
  local json="$1"
  local message="${2:-state update}"

  mkdir -p "$GIT_CLONE_DIR/$(dirname "$GIT_REMOTE_STATE_REL")"
  printf '%s\n' "$json" > "$GIT_CLONE_DIR/$GIT_REMOTE_STATE_REL"
  git -C "$GIT_CLONE_DIR" add "$GIT_REMOTE_STATE_REL"
  git -C "$GIT_CLONE_DIR" commit -q -m "$message"
  git -C "$GIT_CLONE_DIR" push -u origin "$GIT_REMOTE_BRANCH" --quiet 2>/dev/null \
    || git -C "$GIT_CLONE_DIR" push origin "$GIT_REMOTE_BRANCH" --quiet
}

git_remote_fixture_tip_agent() {
  local skill="$1"
  git -C "$GIT_CLONE_DIR" fetch origin "$GIT_REMOTE_BRANCH" --quiet
  jq -r --arg k "$skill" '
    ((.agents // {})[$k] // empty)
    | if type == "object" then .id // empty else . end
  ' <(git -C "$GIT_CLONE_DIR" show "origin/${GIT_REMOTE_BRANCH}:${GIT_REMOTE_STATE_REL}")
}

git_remote_fixture_cleanup() {
  rm -rf "${GIT_REMOTE_DIR:-}" "${GIT_CLONE_DIR:-}" 2>/dev/null || true
}

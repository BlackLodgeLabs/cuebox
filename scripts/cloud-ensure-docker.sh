#!/usr/bin/env bash
# Start dockerd (if needed) and ensure the VM user can reach the Docker socket.
set -euo pipefail

wait_for_docker() {
  local attempt=0
  while (( attempt < 120 )); do
    if [[ -S /var/run/docker.sock ]]; then
      # Relax socket permissions before non-root docker info (cloud VMs: ubuntu not in docker group).
      sudo chmod 666 /var/run/docker.sock 2>/dev/null || true
      if docker info >/dev/null 2>&1; then
        return 0
      fi
    fi
    (( attempt++ )) || true
    sleep 1
  done
  return 1
}

if docker info >/dev/null 2>&1; then
  exit 0
fi

if ! pgrep -x dockerd >/dev/null 2>&1; then
  sudo dockerd > /tmp/dockerd.log 2>&1 &
fi

if wait_for_docker; then
  exit 0
fi

echo "dockerd did not become ready within 120s" >&2
tail -30 /tmp/dockerd.log 2>/dev/null || true
exit 1

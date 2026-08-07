#!/usr/bin/env bash
# Install Docker (if missing), configure fuse-overlayfs for nested VMs, start dockerd,
# and ensure the VM user can reach the Docker socket.
set -euo pipefail

DOCKER_DAEMON_JSON="/etc/docker/daemon.json"
DOCKER_PACKAGES=(docker.io docker-compose-v2 fuse-overlayfs)

log() {
  echo "[cloud-ensure-docker] $*" >&2
}

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

docker_packages_installed() {
  local pkg
  for pkg in "${DOCKER_PACKAGES[@]}"; do
    if ! dpkg -s "$pkg" >/dev/null 2>&1; then
      return 1
    fi
  done
  return 0
}

install_docker_packages() {
  if docker_packages_installed && command -v docker >/dev/null 2>&1 && command -v dockerd >/dev/null 2>&1; then
    return 0
  fi

  log "Installing Docker packages: ${DOCKER_PACKAGES[*]}"
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "${DOCKER_PACKAGES[@]}"

  if ! command -v docker >/dev/null 2>&1; then
    log "ERROR: docker binary missing after package install"
    return 1
  fi
  if ! command -v dockerd >/dev/null 2>&1; then
    log "ERROR: dockerd binary missing after package install"
    return 1
  fi
}

ensure_daemon_json() {
  local desired
  desired='{"storage-driver":"fuse-overlayfs"}'
  sudo mkdir -p /etc/docker

  if [[ -f "$DOCKER_DAEMON_JSON" ]]; then
    if python3 - "$DOCKER_DAEMON_JSON" <<'PY'
import json, sys
path = sys.argv[1]
try:
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
except Exception:
    sys.exit(1)
sys.exit(0 if data.get("storage-driver") == "fuse-overlayfs" else 1)
PY
    then
      return 0
    fi
    log "Updating $DOCKER_DAEMON_JSON for fuse-overlayfs"
  else
    log "Writing $DOCKER_DAEMON_JSON for fuse-overlayfs"
  fi

  printf '%s\n' "$desired" | sudo tee "$DOCKER_DAEMON_JSON" >/dev/null
}

ensure_nested_bridge_networking() {
  # Nested Cursor Cloud VMs often enable br_netfilter. Combined with Docker's
  # iptables DROP rules, that breaks container-to-container traffic on the
  # compose bridge (api cannot reach postgres:5432). Disable bridge netfilter
  # so same-bridge packets stay on the Linux bridge.
  if [[ -e /proc/sys/net/bridge/bridge-nf-call-iptables ]]; then
    if [[ "$(cat /proc/sys/net/bridge/bridge-nf-call-iptables)" != "0" ]]; then
      log "Disabling net.bridge.bridge-nf-call-iptables for nested Docker networking"
      sudo sysctl -w net.bridge.bridge-nf-call-iptables=0 >/dev/null
    fi
  fi
  if [[ -e /proc/sys/net/bridge/bridge-nf-call-ip6tables ]]; then
    if [[ "$(cat /proc/sys/net/bridge/bridge-nf-call-ip6tables)" != "0" ]]; then
      sudo sysctl -w net.bridge.bridge-nf-call-ip6tables=0 >/dev/null
    fi
  fi

  # Prefer iptables-legacy when both backends exist; dual nft+legacy tables
  # leave FORWARD policy DROP on one backend and break published ports.
  if [[ -x /usr/sbin/iptables-legacy ]]; then
    local alt
    alt="$(readlink /etc/alternatives/iptables 2>/dev/null || true)"
    if [[ "$alt" != "/usr/sbin/iptables-legacy" ]]; then
      log "Selecting iptables-legacy for Docker"
      sudo update-alternatives --set iptables /usr/sbin/iptables-legacy >/dev/null
      if [[ -x /usr/sbin/ip6tables-legacy ]]; then
        sudo update-alternatives --set ip6tables /usr/sbin/ip6tables-legacy >/dev/null 2>&1 || true
      fi
    fi
  fi
}

stop_dockerd_if_running() {
  if pgrep -x dockerd >/dev/null 2>&1; then
    log "Stopping existing dockerd to apply daemon config"
    sudo pkill -x dockerd 2>/dev/null || true
    local attempt=0
    while pgrep -x dockerd >/dev/null 2>&1 && (( attempt < 30 )); do
      sleep 1
      (( attempt++ )) || true
    done
  fi
}

start_dockerd() {
  if pgrep -x dockerd >/dev/null 2>&1; then
    return 0
  fi
  # systemd is often unavailable in Cursor Cloud VMs; start dockerd directly.
  log "Starting dockerd"
  sudo dockerd > /tmp/dockerd.log 2>&1 &
}

storage_driver_ok() {
  local driver
  driver="$(docker info --format '{{.Driver}}' 2>/dev/null || true)"
  [[ "$driver" == "fuse-overlayfs" || "$driver" == "overlay2" || "$driver" == "overlay" ]]
}

install_docker_packages
ensure_daemon_json
ensure_nested_bridge_networking

if docker info >/dev/null 2>&1; then
  if storage_driver_ok; then
    sudo chmod 666 /var/run/docker.sock 2>/dev/null || true
    exit 0
  fi
  log "Docker is up but storage driver is unexpected; restarting dockerd"
  stop_dockerd_if_running
fi

# Package install may have attempted a systemd start that left a half-ready daemon.
stop_dockerd_if_running
start_dockerd

if wait_for_docker; then
  ensure_nested_bridge_networking
  driver="$(docker info --format '{{.Driver}}' 2>/dev/null || echo unknown)"
  log "Docker ready (storage-driver=$driver)"
  exit 0
fi

log "ERROR: dockerd did not become ready within 120s"
tail -30 /tmp/dockerd.log 2>/dev/null || true
exit 1

#!/usr/bin/env bash
# Install Docker (if missing), configure fuse-overlayfs for nested VMs, start dockerd,
# and ensure the VM user can reach the Docker socket.
set -euo pipefail

DOCKER_DAEMON_JSON="/etc/docker/daemon.json"
DOCKER_PACKAGES=(docker.io docker-compose-v2 fuse-overlayfs)
NEED_DOCKER_RESTART=0

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
  NEED_DOCKER_RESTART=1
}

ensure_daemon_json() {
  # Merge storage-driver into existing daemon.json (do not clobber other keys).
  sudo mkdir -p /etc/docker
  local status
  status="$(sudo python3 - "$DOCKER_DAEMON_JSON" <<'PY'
import json
import os
import sys

path = sys.argv[1]
data = {}
if os.path.isfile(path):
    try:
        with open(path, encoding="utf-8") as f:
            loaded = json.load(f)
        if isinstance(loaded, dict):
            data = loaded
    except Exception:
        data = {}

if data.get("storage-driver") == "fuse-overlayfs":
    print("unchanged")
    raise SystemExit(0)

data["storage-driver"] = "fuse-overlayfs"
tmp_path = path + ".tmp"
with open(tmp_path, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, sort_keys=True)
    f.write("\n")
os.replace(tmp_path, path)
print("changed")
PY
)"

  if [[ "$status" == "changed" ]]; then
    log "Updated $DOCKER_DAEMON_JSON for fuse-overlayfs (merged)"
    NEED_DOCKER_RESTART=1
  fi
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
  # Switching backends requires a dockerd restart so rules are rewritten.
  if [[ -x /usr/sbin/iptables-legacy ]]; then
    local alt
    alt="$(readlink /etc/alternatives/iptables 2>/dev/null || true)"
    if [[ "$alt" != "/usr/sbin/iptables-legacy" ]]; then
      log "Selecting iptables-legacy for Docker"
      sudo update-alternatives --set iptables /usr/sbin/iptables-legacy >/dev/null
      if [[ -x /usr/sbin/ip6tables-legacy ]]; then
        sudo update-alternatives --set ip6tables /usr/sbin/ip6tables-legacy >/dev/null 2>&1 || true
      fi
      NEED_DOCKER_RESTART=1
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

finish_ready() {
  local driver
  ensure_nested_bridge_networking
  if ! storage_driver_ok; then
    driver="$(docker info --format '{{.Driver}}' 2>/dev/null || echo unknown)"
    log "ERROR: unsupported Docker storage driver '$driver' (need fuse-overlayfs, overlay2, or overlay)"
    tail -30 /tmp/dockerd.log 2>/dev/null || true
    exit 1
  fi
  sudo chmod 666 /var/run/docker.sock 2>/dev/null || true
  driver="$(docker info --format '{{.Driver}}' 2>/dev/null || echo unknown)"
  log "Docker ready (storage-driver=$driver)"
  exit 0
}

install_docker_packages
ensure_daemon_json
ensure_nested_bridge_networking

docker_already_up=0
if docker info >/dev/null 2>&1; then
  docker_already_up=1
fi

if (( docker_already_up )) && storage_driver_ok && (( NEED_DOCKER_RESTART == 0 )); then
  finish_ready
fi

if (( docker_already_up )); then
  if ! storage_driver_ok; then
    log "Docker is up but storage driver is unexpected; restarting dockerd"
  elif (( NEED_DOCKER_RESTART )); then
    log "Restarting dockerd to apply daemon.json / iptables-legacy changes"
  fi
fi

# Package install may have attempted a systemd start that left a half-ready daemon.
stop_dockerd_if_running
start_dockerd

if wait_for_docker; then
  finish_ready
fi

log "ERROR: dockerd did not become ready within 120s"
tail -30 /tmp/dockerd.log 2>/dev/null || true
exit 1

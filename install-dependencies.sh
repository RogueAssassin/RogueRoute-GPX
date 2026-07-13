#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=infra/scripts/_common.sh
source "$SCRIPT_DIR/infra/scripts/_common.sh"

ASSUME_YES="false"
INSTALL_DOCKER="true"
CREATE_OSRM_DIR="true"
UPGRADE_SYSTEM="false"
OSRM_DIR="${OSRM_DATA_DIR:-/mnt/h/osrm}"

usage() {
  cat <<USAGE
RogueRoute-GPX dependency installer
Created by RogueAssassin

Usage:
  ./install-dependencies.sh [options]

Options:
  --yes, -y               Non-interactive install where possible
  --no-docker             Skip Docker Engine / Docker Compose install
  --no-osrm-dir           Do not create the OSRM data directory
  --osrm-dir PATH         OSRM data directory to create/chown. Default: /mnt/h/osrm
  --upgrade-system        Run apt-get upgrade after refreshing package indexes
  --help, -h              Show this help

Installs/checks:
  - Base Linux build tools and helpers
  - Docker Engine + Docker Compose plugin
  - nvm
  - Node.js $EXPECTED_NODE_VERSION
  - pnpm $EXPECTED_PNPM_VERSION
  - OSRM host data directory
  - Recommended sysctl tuning

Supported hosts:
  - Ubuntu / Debian servers
  - Ubuntu / Debian under WSL2
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --yes|-y) ASSUME_YES="true"; shift ;;
    --no-docker) INSTALL_DOCKER="false"; shift ;;
    --no-osrm-dir) CREATE_OSRM_DIR="false"; shift ;;
    --upgrade-system) UPGRADE_SYSTEM="true"; shift ;;
    --osrm-dir) OSRM_DIR="${2:-}"; [[ -n "$OSRM_DIR" ]] || fail "--osrm-dir requires a path"; shift 2 ;;
    --help|-h) usage; exit 0 ;;
    *) fail "Unknown option: $1. Use --help." ;;
  esac
done

require_linux() {
  [[ "${OSTYPE:-}" == linux* ]] || fail "This dependency installer is for Linux/WSL2 hosts. Install Docker Desktop and WSL2 first on Windows."
  command -v apt-get >/dev/null 2>&1 || fail "This installer currently supports apt-based Ubuntu/Debian systems."
}

confirm() {
  local prompt="$1"
  [[ "$ASSUME_YES" == "true" ]] && return 0
  local reply
  read -r -p "$prompt [y/N]: " reply || true
  case "${reply,,}" in y|yes) return 0 ;; *) return 1 ;; esac
}

apt_install() {
  sudo apt-get install -y "$@"
}

install_base_packages() {
  print_step 1 7 "Install base system packages"
  sudo apt-get update
  if [[ "$UPGRADE_SYSTEM" == "true" ]]; then
    sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -y
  else
    log "Skipping full system upgrade. Use --upgrade-system when you explicitly want it."
  fi
  apt_install \
    apt-transport-https \
    build-essential \
    ca-certificates \
    coreutils \
    curl \
    dnsutils \
    g++ \
    gcc \
    git \
    gnupg \
    htop \
    iproute2 \
    iputils-ping \
    jq \
    libssl-dev \
    lsb-release \
    make \
    nano \
    net-tools \
    osmium-tool \
    p7zip-full \
    python3 \
    python3-pip \
    python3-venv \
    rsync \
    screen \
    software-properties-common \
    tmux \
    tree \
    unzip \
    vim \
    wget \
    xz-utils \
    zip
}

install_docker() {
  print_step 2 7 "Install Docker Engine and Docker Compose plugin"
  if [[ "$INSTALL_DOCKER" != "true" ]]; then
    warn "Skipping Docker install because --no-docker was provided."
    return 0
  fi

  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    log "Docker and docker compose are already available."
  else
    sudo install -m 0755 -d /etc/apt/keyrings
    if [[ ! -f /etc/apt/keyrings/docker.gpg ]]; then
      curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    fi
    sudo chmod a+r /etc/apt/keyrings/docker.gpg
    . /etc/os-release
    local docker_os="ubuntu"
    case "${ID:-}" in
      ubuntu) docker_os="ubuntu" ;;
      debian) docker_os="debian" ;;
      *) warn "Unsupported apt distribution ID '${ID:-unknown}' for Docker repo; trying Ubuntu-compatible repo."; docker_os="ubuntu" ;;
    esac
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/${docker_os} ${VERSION_CODENAME} stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
    sudo apt-get update
    apt_install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  fi

  if command -v systemctl >/dev/null 2>&1 && [[ "$(ps -p 1 -o comm= 2>/dev/null || true)" == "systemd" ]]; then
    sudo systemctl enable docker >/dev/null 2>&1 || true
    sudo systemctl start docker >/dev/null 2>&1 || true
  else
    warn "systemd is not PID 1. If Docker is not running, start Docker Desktop/daemon manually."
  fi

  if getent group docker >/dev/null 2>&1; then
    sudo usermod -aG docker "$USER" || true
    log "Added $USER to the docker group. Log out/in or run: newgrp docker"
  fi
}

install_node() {
  print_step 3 7 "Install nvm and Node.js $EXPECTED_NODE_VERSION"
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [[ ! -s "$NVM_DIR/nvm.sh" ]]; then
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
  fi
  # shellcheck disable=SC1090
  source "$NVM_DIR/nvm.sh"
  mkdir -p "$NVM_DIR/.cache/bin" "$NVM_DIR/.cache/src"
  nvm install "$EXPECTED_NODE_VERSION"
  nvm use "$EXPECTED_NODE_VERSION"
  nvm alias default "$EXPECTED_NODE_VERSION"
}

install_pnpm() {
  print_step 4 7 "Install pnpm $EXPECTED_PNPM_VERSION"
  if command -v corepack >/dev/null 2>&1; then
    corepack enable || true
    corepack prepare "pnpm@$EXPECTED_PNPM_VERSION" --activate
  fi
  if ! command -v pnpm >/dev/null 2>&1 || [[ "$(pnpm -v 2>/dev/null || true)" != "$EXPECTED_PNPM_VERSION" ]]; then
    npm install -g "pnpm@$EXPECTED_PNPM_VERSION"
  fi
}

create_osrm_dir() {
  print_step 5 7 "Prepare OSRM data directory"
  if [[ "$CREATE_OSRM_DIR" != "true" ]]; then
    warn "Skipping OSRM directory creation because --no-osrm-dir was provided."
    return 0
  fi
  sudo mkdir -p "$OSRM_DIR"
  sudo chown -R "$USER:$USER" "$OSRM_DIR" || true
  log "OSRM data directory ready: $OSRM_DIR"
}

apply_sysctl_tuning() {
  print_step 6 7 "Apply recommended host tuning"
  sudo tee /etc/sysctl.d/99-rogueroute-gpx.conf >/dev/null <<SYSCTL
fs.inotify.max_user_watches=524288
fs.inotify.max_user_instances=1024
vm.max_map_count=262144
net.core.somaxconn=65535
SYSCTL
  sudo sysctl --system >/dev/null || warn "sysctl reload failed. The settings file was written and may apply after reboot."
}

verify_install() {
  print_step 7 7 "Verify installed tools"
  load_nvm_if_available
  log "Node: $(node -v 2>/dev/null || echo missing)"
  log "npm: $(npm -v 2>/dev/null || echo missing)"
  log "pnpm: $(pnpm -v 2>/dev/null || echo missing)"
  log "Docker: $(docker --version 2>/dev/null || echo missing)"
  log "Docker Compose: $(docker compose version 2>/dev/null || echo missing)"
  ensure_node_version
  enable_pnpm
  if [[ "$INSTALL_DOCKER" == "true" ]]; then
    ensure_core_tools
  fi
}

print_header "RogueRoute-GPX Dependencies"
require_linux
if confirm "Install/update system packages and RogueRoute-GPX runtime dependencies now?"; then
  install_base_packages
  install_docker
  install_node
  install_pnpm
  create_osrm_dir
  apply_sysctl_tuning
  verify_install
  log "Dependency install complete. Run: bash ./fix-permissions.sh && ./first-run.sh osrm"
else
  warn "Dependency install cancelled."
fi

#!/usr/bin/env bash
set -e

GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
NC="\033[0m"

log() { echo -e "${GREEN}==>${NC} $1"; }
warn() { echo -e "${YELLOW}WARNING:${NC} $1"; }
fail() { echo -e "${RED}ERROR:${NC} $1"; exit 1; }

log "Detecting distribution..."

if [ -f /etc/debian_version ]; then
    DISTRO="debian"
elif [ -f /etc/fedora-release ] || [ -f /etc/redhat-release ]; then
    DISTRO="fedora"
elif command -v pacman &> /dev/null; then
    DISTRO="arch"
else
    fail "Unsupported Linux distribution."
fi

log "Detected $DISTRO-based system"

# See https://v2.tauri.app/start/prerequisites/#linux
log "Updating package lists..."
if [ "$DISTRO" = "debian" ]; then
    sudo apt update -y
    sudo apt install -y libwebkit2gtk-4.1-dev \
        build-essential \
        aria2 curl wget \
        file \
        libxdo-dev \
        libssl-dev \
        libayatana-appindicator3-dev \
        librsvg2-dev
elif [ "$DISTRO" = "fedora" ]; then
    sudo dnf check-update -y
    sudo dnf install -y webkit2gtk4.1-devel \
            openssl-devel \
            wget aria2 curl \
            file \
            libappindicator-gtk3-devel \
            librsvg2-devel \
            libxdo-devel
    sudo dnf group install "c-development"
elif [ "$DISTRO" = "arch" ]; then
    # clang.lld is needed as of Rust 1.90
    sudo pacman -Syu --needed --noconfirm \
        aria2 curl lld base-devel \
        webkit2gtk-4.1 \
        wget \
        file \
        openssl \
        appmenu-gtk-module \
        libappindicator-gtk3 \
        librsvg \
        xdotool
fi


if command -v fnm >/dev/null 2>&1; then
    log "fnm already installed"
else
    echo "==> Installing fnm (Fast Node Manager)..."
    curl -fsSL https://fnm.vercel.app/install | bash
    export PATH="$HOME/.local/share/fnm:$HOME/.fnm:$PATH"
fi

log "loading fnm environments"
eval "$(fnm env)"


if ! command -v node >/dev/null 2>&1; then
    log "Installing Node LTS"
    
    fnm install --lts
    fnm default --lts
else
    log "Node already installed"
fi



if command -v cargo >/dev/null 2>&1; then
    log "Rust & Cargo already installed"
else
    log "Installing Rust & Cargo"
    if [ "$DISTRO" = "arch" ]; then
        sudo pacman -S --needed --noconfirm rustup
        rustup default stable
    else
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    fi
    source "$HOME/.cargo/env"
fi

if [ -f package.json ]; then
    log "Installing npm dependencies"
    npm install
else
    warn "No package.json found, skipping npm install"
fi

log "All dependencies installed successfully"

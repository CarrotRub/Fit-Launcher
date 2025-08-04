#!/bin/bash
# Script to install dependencies for Fit-Launcher on Debian/Ubuntu-based systems.

echo "Updating package list..."
sudo apt-get update

echo "Installing essential build tools, network tools, and libraries..."
sudo apt-get install -y \
    build-essential \
    curl \
    pkg-config \
    libssl-dev \
    aria2

echo "Installing GTK and WebKit2GTK development libraries for the UI..."
sudo apt-get install -y \
    libgtk-3-dev \
    libwebkit2gtk-4.1-dev \
    libappindicator3-dev \
    librsvg2-dev

echo "Installing Node.js and npm..."
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

echo "Installing Rust and Cargo..."
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y

# Source cargo env to make rustc and cargo available in the current shell
source "$HOME/.cargo/env"

echo "Dependency installation complete!"
echo "Please run 'source \"\$HOME/.cargo/env\"' in your terminal or restart it to update your PATH."
echo "You can now build the project by running 'npm install' and then 'npm run tauri dev'."

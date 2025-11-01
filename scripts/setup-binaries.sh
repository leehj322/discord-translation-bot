#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BIN_DIR="$ROOT_DIR/bin"
mkdir -p "$BIN_DIR"

# deno
if [ ! -x "$BIN_DIR/deno" ]; then
  echo "Downloading deno (linux x86_64) ..."
  curl -fsSL "https://github.com/denoland/deno/releases/latest/download/deno-x86_64-unknown-linux-gnu" -o "$BIN_DIR/deno"
  chmod +x "$BIN_DIR/deno"
fi

# yt-dlp
if [ ! -x "$BIN_DIR/yt-dlp" ]; then
  echo "Downloading yt-dlp ..."
  curl -fsSL "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp" -o "$BIN_DIR/yt-dlp"
  chmod +x "$BIN_DIR/yt-dlp"
fi

echo "Binaries ready at $BIN_DIR"



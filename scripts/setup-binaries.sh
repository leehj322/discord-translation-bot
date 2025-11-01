#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BIN_DIR="$ROOT_DIR/bin"
mkdir -p "$BIN_DIR"

# deno (zip 아티팩트 다운로드 후 압축 해제)
if [ ! -x "$BIN_DIR/deno" ]; then
  OS_NAME="$(uname -s)"
  ARCH_NAME="$(uname -m)"
  DENO_ASSET=""

  if [ "$OS_NAME" = "Linux" ]; then
    case "$ARCH_NAME" in
      x86_64|amd64)
        DENO_ASSET="deno-x86_64-unknown-linux-gnu.zip"
        ;;
      aarch64|arm64)
        DENO_ASSET="deno-aarch64-unknown-linux-gnu.zip"
        ;;
    esac
  elif [ "$OS_NAME" = "Darwin" ]; then
    case "$ARCH_NAME" in
      x86_64)
        DENO_ASSET="deno-x86_64-apple-darwin.zip"
        ;;
      arm64)
        DENO_ASSET="deno-aarch64-apple-darwin.zip"
        ;;
    esac
  fi

  if [ -n "$DENO_ASSET" ]; then
    echo "Downloading deno ($OS_NAME $ARCH_NAME) ..."
    TMP_ZIP="$(mktemp -t deno.XXXXXX).zip"
    curl -fsSL "https://github.com/denoland/deno/releases/latest/download/$DENO_ASSET" -o "$TMP_ZIP"
    if command -v unzip >/dev/null 2>&1; then
      unzip -o -q "$TMP_ZIP" -d "$BIN_DIR"
    elif command -v bsdtar >/dev/null 2>&1; then
      bsdtar -xf "$TMP_ZIP" -C "$BIN_DIR"
    else
      echo "Warning: unzip/bsdtar not found; skipping deno extraction"
    fi
    rm -f "$TMP_ZIP"
    if [ -f "$BIN_DIR/deno" ]; then chmod +x "$BIN_DIR/deno"; fi
  else
    echo "Skipping deno download for OS=$OS_NAME ARCH=$ARCH_NAME"
  fi
fi

# yt-dlp
if [ ! -x "$BIN_DIR/yt-dlp" ]; then
  echo "Downloading yt-dlp ..."
  curl -fsSL "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp" -o "$BIN_DIR/yt-dlp"
  chmod +x "$BIN_DIR/yt-dlp"
fi

echo "Binaries ready at $BIN_DIR"



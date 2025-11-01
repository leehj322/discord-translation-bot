#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="$ROOT_DIR/bin:$PATH"

npx --yes tsx "$ROOT_DIR/src/bot.ts"



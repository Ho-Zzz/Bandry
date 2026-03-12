#!/usr/bin/env bash
#
# Lightweight check: if python-env/venv doesn't exist, run the full setup.
# Called automatically by `pnpm dev` -- no manual step needed.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
VENV_DIR="$PROJECT_ROOT/python-env/venv"

if [ -f "$VENV_DIR/bin/python" ] || [ -f "$VENV_DIR/Scripts/python.exe" ]; then
  if [ -x "$VENV_DIR/bin/openviking-server" ] || [ -x "$VENV_DIR/Scripts/openviking-server.exe" ]; then
    exit 0
  fi
  echo "[openviking] openviking-server not found in venv, running setup..."
  OPENVIKING_VERSION=latest bash "$SCRIPT_DIR/setup-python-env.sh"
  exit 0
fi

echo "[openviking] Python environment not found, running setup..."
bash "$SCRIPT_DIR/setup-python-env.sh"

#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PYTHON_ENV_DIR="$PROJECT_ROOT/python-env"
VENV_DIR="$PYTHON_ENV_DIR/venv"
OPENVIKING_VERSION="${OPENVIKING_VERSION:-latest}"

PYTHON_BUILD_STANDALONE_TAG="20260211"
PYTHON_VERSION="3.12.12"

detect_platform() {
  local os arch
  os="$(uname -s)"
  arch="$(uname -m)"

  case "$os" in
    Darwin)
      case "$arch" in
        arm64) echo "aarch64-apple-darwin" ;;
        x86_64) echo "x86_64-apple-darwin" ;;
        *) echo "unsupported:$os:$arch"; return 1 ;;
      esac
      ;;
    Linux)
      case "$arch" in
        x86_64) echo "x86_64-unknown-linux-gnu" ;;
        aarch64) echo "aarch64-unknown-linux-gnu" ;;
        *) echo "unsupported:$os:$arch"; return 1 ;;
      esac
      ;;
    *)
      echo "unsupported:$os:$arch"; return 1
      ;;
  esac
}

download_python() {
  local platform="$1"
  local filename="cpython-${PYTHON_VERSION}+${PYTHON_BUILD_STANDALONE_TAG}-${platform}-install_only_stripped.tar.gz"
  local url_encoded_name="cpython-${PYTHON_VERSION}%2B${PYTHON_BUILD_STANDALONE_TAG}-${platform}-install_only_stripped.tar.gz"
  local url="https://github.com/astral-sh/python-build-standalone/releases/download/${PYTHON_BUILD_STANDALONE_TAG}/${url_encoded_name}"
  local dest="$PYTHON_ENV_DIR/python"

  if [ -x "$dest/bin/python3" ]; then
    echo "[setup] Portable Python already present at $dest"
    return 0
  fi

  echo "[setup] Downloading portable Python from $url ..."
  mkdir -p "$PYTHON_ENV_DIR"
  local tmp_dir
  tmp_dir="$(mktemp -d)"

  curl -fsSL "$url" -o "$tmp_dir/python.tar.gz"
  tar xzf "$tmp_dir/python.tar.gz" -C "$PYTHON_ENV_DIR"
  rm -rf "$tmp_dir"

  if [ ! -x "$dest/bin/python3" ]; then
    echo "[setup] ERROR: python3 binary not found after extraction" >&2
    exit 1
  fi

  echo "[setup] Portable Python installed at $dest"
}

create_venv() {
  local python_bin="$PYTHON_ENV_DIR/python/bin/python3"

  if [ -f "$VENV_DIR/bin/python" ] || [ -f "$VENV_DIR/Scripts/python.exe" ]; then
    echo "[setup] Virtual environment already exists at $VENV_DIR"
    return 0
  fi

  echo "[setup] Creating virtual environment ..."
  "$python_bin" -m venv "$VENV_DIR"
  echo "[setup] Virtual environment created at $VENV_DIR"
}

install_openviking() {
  local pip_bin="$VENV_DIR/bin/pip"
  if [ ! -x "$pip_bin" ]; then
    pip_bin="$VENV_DIR/Scripts/pip.exe"
  fi

  echo "[setup] Installing OpenViking ..."
  if [ "$OPENVIKING_VERSION" = "latest" ]; then
    "$pip_bin" install --upgrade openviking
  else
    "$pip_bin" install "openviking==$OPENVIKING_VERSION"
  fi
  "$pip_bin" install 'httpx[socks]' 2>/dev/null || true
  echo "[setup] OpenViking installed successfully"
}

verify_installation() {
  local ov_bin="$VENV_DIR/bin/openviking"
  if [ ! -x "$ov_bin" ]; then
    ov_bin="$VENV_DIR/Scripts/openviking.exe"
  fi

  if [ -x "$ov_bin" ]; then
    echo "[setup] Verification: $("$ov_bin" --version 2>/dev/null || echo 'openviking binary found')"
  else
    echo "[setup] WARNING: openviking CLI not found in venv; falling back to module entry"
    local python_bin="$VENV_DIR/bin/python"
    [ ! -x "$python_bin" ] && python_bin="$VENV_DIR/Scripts/python.exe"
    "$python_bin" -m openviking --version 2>/dev/null || echo "[setup] openviking module entry also unavailable"
  fi
}

main() {
  echo "[setup] Setting up OpenViking Python environment ..."
  echo "[setup] Project root: $PROJECT_ROOT"

  local platform
  platform="$(detect_platform)"
  echo "[setup] Detected platform: $platform"

  download_python "$platform"
  create_venv
  install_openviking
  verify_installation

  echo ""
  echo "[setup] Done. OpenViking Python environment is ready at:"
  echo "  Python: $PYTHON_ENV_DIR/python/bin/python3"
  echo "  Venv:   $VENV_DIR"
  echo "  CLI:    $VENV_DIR/bin/openviking"
}

main "$@"

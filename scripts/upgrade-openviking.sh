#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
VENV_DIR="$PROJECT_ROOT/python-env/venv"
REQUESTED_VERSION="latest"
RESET_DATA=1

usage() {
  cat <<'EOF'
Usage: bash scripts/upgrade-openviking.sh [--version <ver>] [--keep-data]

Options:
  --version <ver>  Upgrade to a specific openviking version (default: latest)
  --keep-data      Keep existing ov.conf and data directory (default: reset)
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --version)
      if [ $# -lt 2 ]; then
        echo "[upgrade] ERROR: --version requires a value" >&2
        usage
        exit 1
      fi
      REQUESTED_VERSION="$2"
      shift 2
      ;;
    --keep-data)
      RESET_DATA=0
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[upgrade] ERROR: unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

resolve_pip_bin() {
  if [ -x "$VENV_DIR/bin/pip" ]; then
    echo "$VENV_DIR/bin/pip"
    return
  fi
  if [ -x "$VENV_DIR/Scripts/pip.exe" ]; then
    echo "$VENV_DIR/Scripts/pip.exe"
    return
  fi
  echo ""
}

resolve_openviking_bin() {
  if [ -x "$VENV_DIR/bin/openviking" ]; then
    echo "$VENV_DIR/bin/openviking"
    return
  fi
  if [ -x "$VENV_DIR/Scripts/openviking.exe" ]; then
    echo "$VENV_DIR/Scripts/openviking.exe"
    return
  fi
  echo ""
}

resolve_openviking_server_bin() {
  if [ -x "$VENV_DIR/bin/openviking-server" ]; then
    echo "$VENV_DIR/bin/openviking-server"
    return
  fi
  if [ -x "$VENV_DIR/Scripts/openviking-server.exe" ]; then
    echo "$VENV_DIR/Scripts/openviking-server.exe"
    return
  fi
  echo ""
}

upgrade_package() {
  local pip_bin="$1"
  if [ "$REQUESTED_VERSION" = "latest" ]; then
    echo "[upgrade] Installing latest openviking ..."
    "$pip_bin" install --upgrade openviking
  else
    echo "[upgrade] Installing openviking==$REQUESTED_VERSION ..."
    "$pip_bin" install --upgrade "openviking==$REQUESTED_VERSION"
  fi
  "$pip_bin" install 'httpx[socks]' 2>/dev/null || true
}

reset_runtime_data() {
  local runtime_root="$1"
  local ov_conf="$runtime_root/ov.conf"
  local data_dir="$runtime_root/data"

  if [ ! -e "$runtime_root" ]; then
    echo "[upgrade] Runtime directory not found, skip reset: $runtime_root"
    return
  fi

  local timestamp
  timestamp="$(date +%Y%m%d-%H%M%S)"
  local backup_dir="${runtime_root}-backup-${timestamp}"
  mkdir -p "$backup_dir"

  if [ -f "$ov_conf" ]; then
    cp "$ov_conf" "$backup_dir/ov.conf"
  fi
  if [ -d "$data_dir" ]; then
    cp -R "$data_dir" "$backup_dir/data"
  fi

  rm -f "$ov_conf"
  rm -rf "$data_dir"
  echo "[upgrade] Reset done. Backup saved at: $backup_dir"
}

main() {
  echo "[upgrade] OpenViking upgrade starting ..."
  echo "[upgrade] Project root: $PROJECT_ROOT"

  local pip_bin
  pip_bin="$(resolve_pip_bin)"
  if [ -z "$pip_bin" ]; then
    echo "[upgrade] Python environment missing, running setup ..."
    OPENVIKING_VERSION="$REQUESTED_VERSION" bash "$SCRIPT_DIR/setup-python-env.sh"
    pip_bin="$(resolve_pip_bin)"
  fi
  if [ -z "$pip_bin" ]; then
    echo "[upgrade] ERROR: pip not found in venv" >&2
    exit 1
  fi

  upgrade_package "$pip_bin"

  local ov_bin ov_server_bin
  ov_bin="$(resolve_openviking_bin)"
  ov_server_bin="$(resolve_openviking_server_bin)"

  if [ -z "$ov_server_bin" ]; then
    echo "[upgrade] ERROR: openviking-server not found after upgrade" >&2
    exit 1
  fi

  local bandry_home="${BANDRY_HOME:-$HOME/.bandry}"
  local runtime_root="$bandry_home/resources/openviking"
  if [ "$RESET_DATA" -eq 1 ]; then
    echo "[upgrade] Resetting ov.conf and data directory ..."
    reset_runtime_data "$runtime_root"
  else
    echo "[upgrade] Keeping existing ov.conf/data (--keep-data)"
  fi

  if [ -n "$ov_bin" ]; then
    echo "[upgrade] Verification: $("$ov_bin" --version 2>/dev/null || echo 'openviking installed')"
  fi
  echo "[upgrade] Verification: $("$ov_server_bin" --version 2>/dev/null || echo 'openviking-server installed')"
  echo "[upgrade] Done. Restart Bandry to regenerate ov.conf and rebuild OpenViking data."
}

main "$@"

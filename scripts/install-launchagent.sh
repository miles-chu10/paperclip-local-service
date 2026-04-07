#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
TEMPLATE_PATH="${REPO_DIR}/config/paperclip.launchagent.plist.template"
RENDER_DIR="${REPO_DIR}/config/rendered"
LOCAL_ENV_PATH="${REPO_DIR}/.env.local"

PAPERCLIP_HOME_WAS_SET="${PAPERCLIP_HOME+x}"
PAPERCLIP_HOME_VALUE="${PAPERCLIP_HOME-}"
PAPERCLIP_INSTANCE_ID_WAS_SET="${PAPERCLIP_INSTANCE_ID+x}"
PAPERCLIP_INSTANCE_ID_VALUE="${PAPERCLIP_INSTANCE_ID-}"
LAUNCHD_LABEL_WAS_SET="${LAUNCHD_LABEL+x}"
LAUNCHD_LABEL_VALUE="${LAUNCHD_LABEL-}"

if [[ -f "${LOCAL_ENV_PATH}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${LOCAL_ENV_PATH}"
  set +a
fi

if [[ -n "${PAPERCLIP_HOME_WAS_SET}" ]]; then
  PAPERCLIP_HOME="${PAPERCLIP_HOME_VALUE}"
fi

if [[ -n "${PAPERCLIP_INSTANCE_ID_WAS_SET}" ]]; then
  PAPERCLIP_INSTANCE_ID="${PAPERCLIP_INSTANCE_ID_VALUE}"
fi

if [[ -n "${LAUNCHD_LABEL_WAS_SET}" ]]; then
  LAUNCHD_LABEL="${LAUNCHD_LABEL_VALUE}"
fi

PAPERCLIP_HOME="${PAPERCLIP_HOME:-$HOME/.paperclip}"
PAPERCLIP_INSTANCE_ID="${PAPERCLIP_INSTANCE_ID:-default}"
LAUNCHD_LABEL="${LAUNCHD_LABEL:-com.paperclip.${PAPERCLIP_INSTANCE_ID}}"
PATH_VALUE="${PATH:-/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin}"

RENDER_ONLY=0

usage() {
  cat <<'EOF'
Usage: bash scripts/install-launchagent.sh [options]

Options:
  --paperclip-home <path>  Override Paperclip home directory
  --instance <id>          Override Paperclip instance id
  --label <name>           Override LaunchAgent label
  --render-only            Render and validate the plist without installing it
  -h, --help               Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --paperclip-home)
      PAPERCLIP_HOME="$2"
      shift 2
      ;;
    --instance)
      PAPERCLIP_INSTANCE_ID="$2"
      shift 2
      ;;
    --label)
      LAUNCHD_LABEL="$2"
      shift 2
      ;;
    --render-only)
      RENDER_ONLY=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

CONFIG_PATH="${PAPERCLIP_HOME}/instances/${PAPERCLIP_INSTANCE_ID}/config.json"
LOG_DIR="${PAPERCLIP_HOME}/instances/${PAPERCLIP_INSTANCE_ID}/logs"
START_SCRIPT="${REPO_DIR}/scripts/start-paperclip-instance.sh"
INSTALL_PATH="${HOME}/Library/LaunchAgents/${LAUNCHD_LABEL}.plist"
RENDER_PATH="${RENDER_DIR}/${LAUNCHD_LABEL}.plist"

if [[ ! -f "${TEMPLATE_PATH}" ]]; then
  echo "LaunchAgent template not found at ${TEMPLATE_PATH}." >&2
  exit 1
fi

if [[ ! -f "${CONFIG_PATH}" ]]; then
  echo "Paperclip config not found at ${CONFIG_PATH}." >&2
  exit 1
fi

command -v plutil >/dev/null 2>&1 || {
  echo "plutil is required but not available." >&2
  exit 1
}

command -v launchctl >/dev/null 2>&1 || {
  echo "launchctl is required but not available." >&2
  exit 1
}

mkdir -p "${RENDER_DIR}" "${HOME}/Library/LaunchAgents" "${LOG_DIR}"

escape_sed() {
  printf '%s' "$1" | sed -e 's/[\/&]/\\&/g'
}

sed \
  -e "s|{{LAUNCHD_LABEL}}|$(escape_sed "${LAUNCHD_LABEL}")|g" \
  -e "s|{{START_SCRIPT}}|$(escape_sed "${START_SCRIPT}")|g" \
  -e "s|{{REPO_DIR}}|$(escape_sed "${REPO_DIR}")|g" \
  -e "s|{{PATH_VALUE}}|$(escape_sed "${PATH_VALUE}")|g" \
  -e "s|{{PAPERCLIP_HOME}}|$(escape_sed "${PAPERCLIP_HOME}")|g" \
  -e "s|{{PAPERCLIP_INSTANCE_ID}}|$(escape_sed "${PAPERCLIP_INSTANCE_ID}")|g" \
  -e "s|{{LOG_DIR}}|$(escape_sed "${LOG_DIR}")|g" \
  "${TEMPLATE_PATH}" > "${RENDER_PATH}"

plutil -lint "${RENDER_PATH}"

if [[ "${RENDER_ONLY}" -eq 1 ]]; then
  echo "Rendered ${RENDER_PATH}"
  exit 0
fi

cp "${RENDER_PATH}" "${INSTALL_PATH}"

launchctl bootout "gui/$(id -u)" "${INSTALL_PATH}" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "${INSTALL_PATH}"
launchctl kickstart -k "gui/$(id -u)/${LAUNCHD_LABEL}"

echo "Installed ${LAUNCHD_LABEL}"
echo "LaunchAgent: ${INSTALL_PATH}"
echo "Rendered: ${RENDER_PATH}"

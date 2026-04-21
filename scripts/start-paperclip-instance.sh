#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOCAL_ENV_PATH="${REPO_DIR}/.env.local"

PAPERCLIP_HOME_WAS_SET="${PAPERCLIP_HOME+x}"
PAPERCLIP_HOME_VALUE="${PAPERCLIP_HOME-}"
PAPERCLIP_INSTANCE_ID_WAS_SET="${PAPERCLIP_INSTANCE_ID+x}"
PAPERCLIP_INSTANCE_ID_VALUE="${PAPERCLIP_INSTANCE_ID-}"
PAPERCLIP_BIN_WAS_SET="${PAPERCLIP_BIN+x}"
PAPERCLIP_BIN_VALUE="${PAPERCLIP_BIN-}"

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

if [[ -n "${PAPERCLIP_BIN_WAS_SET}" ]]; then
  PAPERCLIP_BIN="${PAPERCLIP_BIN_VALUE}"
fi

PAPERCLIP_HOME="${PAPERCLIP_HOME:-$HOME/.paperclip}"
PAPERCLIP_INSTANCE_ID="${PAPERCLIP_INSTANCE_ID:-default}"
PAPERCLIP_BIN="${PAPERCLIP_BIN:-${REPO_DIR}/node_modules/.bin/paperclipai}"

CONFIG_PATH="${PAPERCLIP_HOME}/instances/${PAPERCLIP_INSTANCE_ID}/config.json"
LOG_DIR="${PAPERCLIP_HOME}/instances/${PAPERCLIP_INSTANCE_ID}/logs"

export PATH="${PATH:-/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin}"

if [[ ! -x "${PAPERCLIP_BIN}" ]]; then
  echo "paperclipai CLI not found at ${PAPERCLIP_BIN}. Run 'npm install' in ${REPO_DIR} first." >&2
  exit 1
fi

if [[ ! -f "${CONFIG_PATH}" ]]; then
  echo "Paperclip config not found at ${CONFIG_PATH}." >&2
  exit 1
fi

mkdir -p "${LOG_DIR}"
cd "${REPO_DIR}"

# Let `paperclipai run` load the instance-adjacent .env itself.
exec "${PAPERCLIP_BIN}" run -c "${CONFIG_PATH}" -d "${PAPERCLIP_HOME}"

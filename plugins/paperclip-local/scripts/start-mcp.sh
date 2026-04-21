#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_DIR="$(cd "${PLUGIN_ROOT}/../.." && pwd)"

cd "${REPO_DIR}"
exec node src/paperclip-mcp.mjs "$@"

# paperclip-local-service

Reusable macOS LaunchAgent setup for running a local Paperclip instance as a background service.

This repo packages the macOS plumbing around a local Paperclip install without committing any live instance data, secrets, or user-specific LaunchAgent files.

It is intentionally a thin wrapper around one named local Paperclip instance. It does not replace the upstream Paperclip CLI/UI for onboarding, worktrees, plugins, company skills, or local agent bootstrap flows.

## What It Installs

- a repo-local `paperclipai@2026.325.0` CLI
- a launcher script that targets one Paperclip home + instance id
- a sanitized LaunchAgent template
- an installer that renders a machine-specific plist into `config/rendered/`, validates it, installs it into `~/Library/LaunchAgents`, and reloads the service

## Requirements

- macOS with `launchctl` and `plutil`
- Node.js 20+
- a configured Paperclip instance, typically at `~/.paperclip/instances/default`

Use the native Paperclip CLI first if the instance does not exist yet:

```bash
paperclipai onboard
# or
paperclipai run
```

## Setup

```bash
cd ~/Projects/paperclip-local-service
npm install
cp .env.example .env.local  # optional local defaults, do not commit
```

Both scripts read `.env.local` if it exists. Explicit environment variables and installer flags still take precedence.

Optional local defaults:

```bash
PAPERCLIP_HOME=~/.paperclip
PAPERCLIP_INSTANCE_ID=default
LAUNCHD_LABEL=com.paperclip.default
```

Optional MCP / CLI defaults:

```bash
PAPERCLIP_CONFIG=~/.paperclip/instances/default/config.json
PAPERCLIP_DATA_DIR=~/.paperclip
PAPERCLIP_CONTEXT=
PAPERCLIP_PROFILE=
PAPERCLIP_API_BASE=http://127.0.0.1:3100
PAPERCLIP_API_KEY=
```

Path-like values in `.env.local` may use `~`, `$HOME`, or `${HOME}`.

## Install The LaunchAgent

Render only:

```bash
bash scripts/install-launchagent.sh --render-only
plutil -lint config/rendered/com.paperclip.default.plist
```

Install and start:

```bash
bash scripts/install-launchagent.sh
```

Replace an existing machine-specific label:

```bash
LAUNCHD_LABEL=com.miles.paperclip.default bash scripts/install-launchagent.sh
```

## Verification

Check Paperclip health before install:

```bash
./node_modules/.bin/paperclipai doctor \
  -c "${HOME}/.paperclip/instances/default/config.json" \
  -d "${HOME}/.paperclip"
```

Check the service:

```bash
launchctl print gui/$(id -u)/com.paperclip.default
lsof -nP -iTCP:3100 -sTCP:LISTEN
lsof -nP -iTCP:54329 -sTCP:LISTEN
curl http://127.0.0.1:3100/
```

Check the MCP server wiring:

```bash
npm run check:mcp
node src/paperclip-mcp.mjs --print-config
```

## MCP Server

This repo now includes a local stdio MCP server that wraps `paperclipai` with JSON output and uses the same `.env.local` / `PAPERCLIP_*` defaults as the launcher scripts.

This MCP server exposes a focused operator surface for one named local instance. It is still not a full replacement for native `paperclipai` commands or the Paperclip UI.

Run it directly:

```bash
npm run mcp:server
```

The server exposes focused Paperclip tools for:

- resolved local status/config
- companies plus company import/export
- dashboard summary and activity log
- issues
- agents and local CLI bootstrap
- approvals
- plugin lifecycle
- CLI context and auth visibility
- local diagnostics, environment export, and one-off heartbeat runs

Use native Paperclip surfaces for workflows that are outside this wrapper's scope, including:

- onboarding and deployment-mode setup: `paperclipai onboard`, `paperclipai run`
- worktree-local instances: `paperclipai worktree ...`
- company skills and `desiredSkills`
- local agent bootstrap: `paperclipai agent local-cli ...`

## Repo-Local Plugin

This repo now ships a repo-local Codex plugin bundle for the same MCP surface:

- plugin manifest: `plugins/paperclip-local/.codex-plugin/plugin.json`
- marketplace entry: `.agents/plugins/marketplace.json`
- MCP launcher config: `plugins/paperclip-local/.mcp.json`
- launcher script: `plugins/paperclip-local/scripts/start-mcp.sh`
- skill: `plugins/paperclip-local/skills/paperclip-local-operator/`

The plugin launches the repo's stdio MCP server and forwards the standard `PAPERCLIP_*` environment variables into that process.

Example MCP client config:

```json
{
  "mcpServers": {
    "paperclip-local": {
      "command": "node",
      "args": [
        "/Users/your-user/Projects/paperclip-local-service/src/paperclip-mcp.mjs"
      ],
      "cwd": "/Users/your-user/Projects/paperclip-local-service",
      "env": {
        "PAPERCLIP_HOME": "/Users/your-user/.paperclip",
        "PAPERCLIP_INSTANCE_ID": "default"
      }
    }
  }
}
```

If `.env.local` already points at the right instance, the explicit `env` block is optional.

## Update Flow

```bash
cd ~/Projects/paperclip-local-service
npm install
bash scripts/install-launchagent.sh
```

## Uninstall

```bash
LABEL=com.paperclip.default
launchctl bootout "gui/$(id -u)" "$HOME/Library/LaunchAgents/${LABEL}.plist" || true
rm -f "$HOME/Library/LaunchAgents/${LABEL}.plist"
rm -f "config/rendered/${LABEL}.plist"
```

## Project Structure

```
.agents/    repo-local plugin marketplace metadata
config/     LaunchAgent template and gitignored rendered local output
plugins/    repo-local Codex plugin and Paperclip operator skill
src/        Paperclip MCP server, CLI wrapper, and smoke test
scripts/    Launcher and installer
```

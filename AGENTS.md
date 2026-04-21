# paperclip-local-service

## Overview
Reusable macOS LaunchAgent setup for running a local Paperclip instance as a background service.
This repo is a thin wrapper around one named local Paperclip instance. It does not replace the upstream Paperclip CLI/UI for onboarding, plugins, company skills, worktrees, or agent bootstrap flows.

## Architecture
- `package.json` pins the local `paperclipai` CLI version.
- `scripts/start-paperclip-instance.sh` boots a single Paperclip instance from a local repo install.
- `scripts/install-launchagent.sh` renders and installs a user LaunchAgent from `config/paperclip.launchagent.plist.template`.
- `src/paperclip-mcp.mjs` exposes the local `paperclipai` CLI through an stdio MCP server.
- `src/paperclip-cli.mjs` centralizes `.env.local` and `PAPERCLIP_*` resolution for local tooling.

## Key Configuration
- Default Paperclip home: `$HOME/.paperclip`
- Default instance id: `default`
- Default LaunchAgent label: `com.paperclip.default`
- Rendered plists are generated into `config/rendered/` and never committed.

## Constraints
- Never commit secrets, live instance data, or `~/Library/LaunchAgents/*.plist`.
- Keep the launcher generic: no hardcoded usernames, absolute home paths, or copied `node_modules`.
- Keep `.env.local` semantics aligned between shell scripts and Node-side helpers.
- Validate any plist changes with `plutil -lint`.

## Validation
- `npm install`
- `npm run check:mcp`
- `bash scripts/install-launchagent.sh --render-only`
- `bash scripts/install-launchagent.sh`
- `launchctl print gui/$(id -u)/<label>`

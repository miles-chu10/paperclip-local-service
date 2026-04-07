# paperclip-local-service

## Overview
Reusable macOS LaunchAgent setup for running a local Paperclip instance as a background service.

## Architecture
- `package.json` pins the local `paperclipai` CLI version.
- `scripts/start-paperclip-instance.sh` boots a single Paperclip instance from a local repo install.
- `scripts/install-launchagent.sh` renders and installs a user LaunchAgent from `config/paperclip.launchagent.plist.template`.

## Key Configuration
- Default Paperclip home: `$HOME/.paperclip`
- Default instance id: `default`
- Default LaunchAgent label: `com.paperclip.default`
- Rendered plists are generated into `config/rendered/` and never committed.

## Constraints
- Never commit secrets, live instance data, or `~/Library/LaunchAgents/*.plist`.
- Keep the launcher generic: no hardcoded usernames, absolute home paths, or copied `node_modules`.
- Validate any plist changes with `plutil -lint`.

## Validation
- `npm install`
- `bash scripts/install-launchagent.sh --render-only`
- `bash scripts/install-launchagent.sh`
- `launchctl print gui/$(id -u)/<label>`

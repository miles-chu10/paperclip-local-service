# paperclip-local-service

Reusable macOS LaunchAgent setup for running a local Paperclip instance as a background service.

This repo packages the macOS plumbing around a local Paperclip install without committing any live instance data, secrets, or user-specific LaunchAgent files.

## What It Installs

- a repo-local `paperclipai@2026.325.0` CLI
- a launcher script that targets one Paperclip home + instance id
- a sanitized LaunchAgent template
- an installer that renders a machine-specific plist into `config/rendered/`, validates it, installs it into `~/Library/LaunchAgents`, and reloads the service

## Requirements

- macOS with `launchctl` and `plutil`
- Node.js 20+
- an existing Paperclip instance, typically at `~/.paperclip/instances/default`

## Setup

```bash
cd ~/Projects/paperclip-local-service
npm install
cp .env.example .env.local  # optional local defaults, do not commit
```

Both scripts read `.env.local` if it exists. Explicit environment variables and installer flags still take precedence.

Optional local defaults:

```bash
PAPERCLIP_HOME=$HOME/.paperclip
PAPERCLIP_INSTANCE_ID=default
LAUNCHD_LABEL=com.paperclip.default
```

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
  -c "$HOME/.paperclip/instances/default/config.json" \
  -d "$HOME/.paperclip"
```

Check the service:

```bash
launchctl print gui/$(id -u)/com.paperclip.default
lsof -nP -iTCP:3100 -sTCP:LISTEN
lsof -nP -iTCP:54329 -sTCP:LISTEN
curl http://127.0.0.1:3100/
```

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
config/     LaunchAgent template and gitignored rendered local output
scripts/    Launcher and installer
```

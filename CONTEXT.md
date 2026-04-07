# paperclip-local-service — Full Context
> **Last updated:** 2026-04-06
> **Status:** Active

## What This Project Is
Sanitized local-service scaffolding for running a Paperclip instance as a durable macOS LaunchAgent.

## Architecture Overview
- The repo installs `paperclipai` locally with npm.
- The launcher script resolves a Paperclip home directory and instance id at runtime.
- The install script renders a machine-specific plist from a committed template, validates it, installs it into `~/Library/LaunchAgents`, and reloads the service with `launchctl`.

## Files In This Project
- `README.md` — setup, update, uninstall, and verification guide
- `config/paperclip.launchagent.plist.template` — templated LaunchAgent definition
- `scripts/start-paperclip-instance.sh` — instance launcher
- `scripts/install-launchagent.sh` — render and install entrypoint
- `.env.example` — optional local defaults for home, instance id, and label

## Session History
| Session | What Happened |
|---------|---------------|
| 1 | Scaffolded repo and added reusable LaunchAgent tooling for Paperclip |

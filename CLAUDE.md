# paperclip-local-service

Reusable macOS LaunchAgent setup for running a local Paperclip instance as a background service.

## Key Files
- `package.json` — pins `paperclipai@2026.325.0`
- `scripts/start-paperclip-instance.sh` — launches Paperclip for one instance
- `scripts/install-launchagent.sh` — renders, validates, installs, and restarts the LaunchAgent
- `config/paperclip.launchagent.plist.template` — sanitized plist template

## Quick Commands

```bash
npm install
bash scripts/install-launchagent.sh --render-only
bash scripts/install-launchagent.sh
launchctl print gui/$(id -u)/com.paperclip.default
curl http://127.0.0.1:3100/
```

## Constraints
- Keep repo content sanitized and reusable.
- Do not commit rendered plists, logs, or local `.env` files.

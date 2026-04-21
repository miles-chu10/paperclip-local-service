# Awesome Paperclip Snapshot

Source reviewed: `gsxdsm/awesome-paperclip` on 2026-04-08.

Use this reference when the user asks what exists in the wider Paperclip ecosystem beyond this repo-local MCP wrapper.

## Official

- `paperclipai/paperclip`: the upstream orchestration platform.
- `paperclipai/paperclip-website`: official website source.

## Notable Plugin Families

- UI and operator views: `obsidian-paperclip`, `paperclip-aperture`, `paperclip-plugin-chat`.
- Notifications and chat surfaces: `paperclip-plugin-slack`, `paperclip-plugin-discord`, `paperclip-plugin-telegram`.
- System integrations: `paperclip-plugin-github-issues`, `paperclip-plugin-writbase`.
- Runtime and memory layers: `paperclip-plugin-acp`, `paperclip-plugin-avp`, `paperclip-plugin-hindsight`.
- Guided setup: `paperclip-plugin-company-wizard`.

## Tools and Utilities

- `oh-my-paperclip`: plugin bundle for Paperclip setups.
- `paperclip-mcp` by `wizarck`: REST API based Paperclip MCP server for operator tooling outside the local CLI wrapper.

## How To Apply This

- Use the local `paperclip_*` MCP tools in this repo for one named local instance.
- Use ecosystem plugins when the user asks for integrations, notifications, dashboards, memory, or chat surfaces that this local wrapper does not provide.
- Prefer inspection before install: list current plugins, inspect candidate plugins, then install the specific package or local path the user chose.

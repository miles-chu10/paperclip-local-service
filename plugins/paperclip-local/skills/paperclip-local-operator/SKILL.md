---
name: paperclip-local-operator
description: Operate a named local Paperclip instance through the bundled `paperclip-local` MCP server. Use when the user wants to inspect Paperclip status, companies, dashboard, activity, issues, agents, approvals, plugins, context profiles, import/export packages, local diagnostics, or agent local-cli bootstrap flows from this repo.
---

# Paperclip Local Operator

## Overview

Use this skill for the human-operator layer around one named local Paperclip instance. Prefer the bundled MCP tools over ad hoc shell calls so status, issue work, approvals, plugin lifecycle, and context changes stay typed and discoverable.

This repo is still a thin wrapper. Use native `paperclipai onboard`, `paperclipai run`, and interactive `auth login` flows outside this skill when the task is first-run setup or browser-based authentication.

## Quick Start

1. Call `paperclip_status` first to confirm the resolved `PAPERCLIP_*` paths and whether the local config exists.
2. Use `paperclip_context_show` or `paperclip_company_list` to confirm which company and profile you are operating against.
3. Pick the narrowest tool family that fits the task instead of jumping straight to imports, plugin installs, or heartbeats.

## Core Workflows

- Day-to-day operations: use `paperclip_dashboard_get`, `paperclip_activity_list`, `paperclip_issue_*`, `paperclip_agent_*`, and `paperclip_approval_*`.
- Plugin lifecycle: use `paperclip_plugin_list`, `paperclip_plugin_inspect`, `paperclip_plugin_install`, `paperclip_plugin_enable`, `paperclip_plugin_disable`, and `paperclip_plugin_uninstall`.
- Portability and migrations: use `paperclip_company_export` and start with `paperclip_company_import` in `dryRun` mode before applying a real import.
- Local bootstrap: use `paperclip_agent_local_cli` when the user wants agent-scoped local CLI exports or to install Paperclip skills into Codex and Claude.
- Local maintenance: use `paperclip_doctor`, `paperclip_env`, and `paperclip_heartbeat_run` for diagnostics and one-off heartbeat execution.

## Safety Notes

- `paperclip_context_use`, `paperclip_context_set`, `paperclip_company_import`, `paperclip_plugin_install`, `paperclip_plugin_uninstall`, `paperclip_auth_bootstrap_ceo`, and `paperclip_agent_local_cli` change local or remote state. Summarize the intended mutation before calling them.
- `paperclip_doctor` repair mode must be called with `yes=true`; otherwise the command will stop with a validation error rather than hanging on an interactive prompt.
- `paperclip_heartbeat_run` returns streamed logs. Prefer explicit `agentId` and `timeoutMs` values for targeted debugging.
- Use `paperclip_plugin_examples` and the ecosystem reference before recommending third-party plugin installs.

## Reference

Read [awesome-paperclip.md](./references/awesome-paperclip.md) when the user asks which Paperclip ecosystem plugins, tools, or integrations are worth considering beyond this repo-local operator surface.

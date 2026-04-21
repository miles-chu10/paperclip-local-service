# Audit: `paperclip-local-service` vs Paperclip `2026.325.0`

Date: 2026-04-08

## Intended scope

`paperclip-local-service` is valid as a thin wrapper around one named local Paperclip instance that:

- renders and installs a macOS LaunchAgent
- starts `paperclipai run` for a chosen `PAPERCLIP_HOME` + `PAPERCLIP_INSTANCE_ID`
- exposes a narrow stdio MCP wrapper for a subset of control-plane commands

It is not a replacement for the upstream Paperclip CLI or UI.

## Verdicts

| Area | Verdict | Notes |
| --- | --- | --- |
| Launcher / LaunchAgent model | correct | The repo correctly targets the canonical instance layout under `PAPERCLIP_HOME/instances/<id>`. |
| Launch/runtime semantics | correct after fix | The launcher now defers instance `.env` loading to upstream `paperclipai run` instead of sourcing it itself. |
| `.env.local` handling | wrong before fix | Shell scripts expanded `~` / `$HOME`, but the Node-side MCP resolver treated them literally. |
| Instance topology assumptions | correct but intentionally narrow | The repo is suitable for one named local instance, not repo-local worktree instances. |
| MCP/API surface | correct but under-documented before fix | The wrapper intentionally exposes only companies/dashboard/issues/agents/approvals. |
| Paperclip ecosystem alignment | under-documented before fix | Native Paperclip flows for onboarding, plugins, company skills, worktrees, and `agent local-cli` needed to be called out explicitly. |
| Packaging / repo hygiene | correct | `config/rendered/` is gitignored and not tracked. Local rendered plists in the working tree are not a repo hygiene defect. |

## Mismatches against upstream

| Severity | Mismatch | Status |
| --- | --- | --- |
| medium | `.env.local` path defaults behaved differently in shell vs Node, which broke the documented `cp .env.example .env.local` flow for MCP usage. | fixed |
| medium | `scripts/start-paperclip-instance.sh` sourced the instance `.env` directly, which diverged from upstream `paperclipai run` semantics and executed shell instead of dotenv parsing. | fixed |
| low | Repo docs did not clearly state that this is a thin named-instance wrapper, not a general Paperclip admin surface. | fixed |
| low | Repo docs did not point operators to upstream flows for plugins, company skills, worktrees, and `agent local-cli`. | fixed |

## Minimum fix set

1. Keep the repo scoped to a named local instance wrapper.
2. Make `.env.local` path resolution consistent across shell and Node.
3. Let upstream `paperclipai run` load the instance-adjacent `.env`.
4. Document the explicit boundary between this wrapper and first-class upstream Paperclip workflows.

## Validation performed

- Compared local scripts and helpers to upstream `paperclipai` docs and CLI behavior for `2026.325.0`.
- Verified `paperclipai` in this repo exposes current upstream commands, including `run`, `plugin`, `worktree`, and client operations.
- Rendered a LaunchAgent in an isolated temp Paperclip home and validated it with `plutil -lint`.
- Verified `src/paperclip-mcp.mjs --print-config` against an isolated temp instance.
- Reproduced the `.env.local` mismatch with the documented example values and then fixed it.

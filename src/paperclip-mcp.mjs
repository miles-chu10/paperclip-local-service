#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  REPO_DIR,
  describeResolvedPaperclipContext,
  runPaperclipCommand,
  runPaperclipJson,
} from './paperclip-cli.mjs';

const __filename = fileURLToPath(import.meta.url);
const packageJson = JSON.parse(fs.readFileSync(path.join(REPO_DIR, 'package.json'), 'utf8'));

function stringify(value) {
  return JSON.stringify(value, null, 2);
}

function pushOption(args, flag, value) {
  if (value === undefined || value === null || value === '') {
    return;
  }

  args.push(flag, String(value));
}

function pushCsvOption(args, flag, value) {
  if (value === undefined || value === null) {
    return;
  }

  const csv = Array.isArray(value) ? value.join(',') : String(value);
  if (csv !== '') {
    args.push(flag, csv);
  }
}

function pushFlag(args, flag, enabled) {
  if (enabled) {
    args.push(flag);
  }
}

function toolSuccess(result) {
  return {
    content: [
      {
        type: 'text',
        text: stringify(result),
      },
    ],
    structuredContent: {
      result,
    },
  };
}

function toolCommandSuccess(result) {
  const stdout = result.stdout.trimEnd();
  const stderr = result.stderr.trimEnd();
  const text = [
    stdout,
    stderr ? `stderr:\n${stderr}` : '',
  ]
    .filter(Boolean)
    .join('\n\n') || 'Command completed with no output.';

  return {
    content: [
      {
        type: 'text',
        text,
      },
    ],
    structuredContent: {
      result: {
        command: result.command,
        exitCode: result.code,
        stdout,
        stderr,
      },
    },
  };
}

function toolFailure(error) {
  const details = {
    message: error instanceof Error ? error.message : String(error),
  };

  if (error instanceof Error && error.cause && typeof error.cause === 'object') {
    const cause = error.cause;
    if ('code' in cause) {
      details.code = cause.code;
    }
    if ('command' in cause) {
      details.command = cause.command;
    }
  }

  return {
    isError: true,
    content: [
      {
        type: 'text',
        text: stringify(details),
      },
    ],
    structuredContent: {
      error: details,
    },
  };
}

function registerJsonTool(server, name, description, inputSchema, buildArgs) {
  server.registerTool(
    name,
    {
      description,
      inputSchema,
    },
    async (args) => {
      try {
        const result = await runPaperclipJson(buildArgs(args));
        return toolSuccess(result);
      } catch (error) {
        return toolFailure(error);
      }
    },
  );
}

function registerCommandTool(server, name, description, inputSchema, buildArgs, options = {}) {
  server.registerTool(
    name,
    {
      description,
      inputSchema,
    },
    async (args) => {
      try {
        const result = await runPaperclipCommand(buildArgs(args), options);

        if (result.code !== 0) {
          throw new Error(
            result.stderr.trim() || result.stdout.trim() || `paperclipai exited with code ${result.code}`,
            { cause: { code: result.code, command: result.command } },
          );
        }

        return toolCommandSuccess(result);
      } catch (error) {
        return toolFailure(error);
      }
    },
  );
}

function createServer() {
  const server = new McpServer(
    {
      name: 'paperclip-local-mcp',
      version: packageJson.version,
    },
    {
      instructions:
        'Use these tools to manage a named local Paperclip instance through the paperclipai CLI. This server exposes a focused operator surface for status, companies, dashboard, activity, issues, agents, approvals, plugins, context, auth, and local diagnostics. It reads .env.local plus PAPERCLIP_* environment variables, defaults to ~/.paperclip and instance "default", and targets the local repo-installed paperclipai binary.',
    },
  );

  server.registerTool(
    'paperclip_status',
    {
      description:
        'Show the resolved local Paperclip CLI/MCP configuration, including which config and data paths this server will use.',
      inputSchema: {},
    },
    async () => {
      try {
        return toolSuccess(describeResolvedPaperclipContext());
      } catch (error) {
        return toolFailure(error);
      }
    },
  );

  registerJsonTool(
    server,
    'paperclip_company_list',
    'List companies from the configured local Paperclip instance.',
    {},
    () => ['company', 'list'],
  );

  registerJsonTool(
    server,
    'paperclip_company_get',
    'Get one company by ID.',
    {
      companyId: z.string(),
    },
    ({ companyId }) => ['company', 'get', companyId],
  );

  registerJsonTool(
    server,
    'paperclip_dashboard_get',
    'Get the Paperclip dashboard summary. Provide companyId when the local context does not already select a company.',
    {
      companyId: z.string().optional(),
    },
    ({ companyId }) => {
      const args = ['dashboard', 'get'];
      pushOption(args, '-C', companyId);
      return args;
    },
  );

  registerJsonTool(
    server,
    'paperclip_activity_list',
    'List activity log entries for the local Paperclip company, with optional agent and entity filters.',
    {
      companyId: z.string().optional(),
      agentId: z.string().optional(),
      entityType: z.string().optional(),
      entityId: z.string().optional(),
    },
    ({ companyId, agentId, entityType, entityId }) => {
      const args = ['activity', 'list'];
      pushOption(args, '-C', companyId);
      pushOption(args, '--agent-id', agentId);
      pushOption(args, '--entity-type', entityType);
      pushOption(args, '--entity-id', entityId);
      return args;
    },
  );

  registerJsonTool(
    server,
    'paperclip_issue_list',
    'List issues for a company with optional status, assignee, project, and text filters.',
    {
      companyId: z.string().optional(),
      statuses: z.array(z.string()).optional(),
      assigneeAgentId: z.string().optional(),
      projectId: z.string().optional(),
      match: z.string().optional(),
    },
    ({ companyId, statuses, assigneeAgentId, projectId, match }) => {
      const args = ['issue', 'list'];
      pushOption(args, '-C', companyId);
      pushCsvOption(args, '--status', statuses);
      pushOption(args, '--assignee-agent-id', assigneeAgentId);
      pushOption(args, '--project-id', projectId);
      pushOption(args, '--match', match);
      return args;
    },
  );

  registerJsonTool(
    server,
    'paperclip_company_export',
    'Export a company into a portable markdown package. This can write files when outPath is provided.',
    {
      companyId: z.string(),
      outPath: z.string().optional(),
      include: z.array(z.string()).optional(),
      skills: z.array(z.string()).optional(),
      projects: z.array(z.string()).optional(),
      issues: z.array(z.string()).optional(),
      projectIssues: z.array(z.string()).optional(),
      expandReferencedSkills: z.boolean().optional(),
    },
    ({
      companyId,
      outPath,
      include,
      skills,
      projects,
      issues,
      projectIssues,
      expandReferencedSkills,
    }) => {
      const args = ['company', 'export', companyId];
      pushOption(args, '--out', outPath);
      pushCsvOption(args, '--include', include);
      pushCsvOption(args, '--skills', skills);
      pushCsvOption(args, '--projects', projects);
      pushCsvOption(args, '--issues', issues);
      pushCsvOption(args, '--project-issues', projectIssues);
      pushFlag(args, '--expand-referenced-skills', expandReferencedSkills);
      return args;
    },
  );

  registerJsonTool(
    server,
    'paperclip_company_import',
    'Import a portable markdown company package from a local path, URL, or GitHub. Use dryRun to preview changes first.',
    {
      fromPathOrUrl: z.string(),
      include: z.array(z.string()).optional(),
      target: z.enum(['new', 'existing']).optional(),
      companyId: z.string().optional(),
      newCompanyName: z.string().optional(),
      agents: z.array(z.string()).optional(),
      collision: z.enum(['rename', 'skip', 'replace']).optional(),
      ref: z.string().optional(),
      paperclipUrl: z.string().optional(),
      yes: z.boolean().optional(),
      dryRun: z.boolean().optional(),
    },
    ({
      fromPathOrUrl,
      include,
      target,
      companyId,
      newCompanyName,
      agents,
      collision,
      ref,
      paperclipUrl,
      yes,
      dryRun,
    }) => {
      const args = ['company', 'import', fromPathOrUrl];
      pushCsvOption(args, '--include', include);
      pushOption(args, '--target', target);
      pushOption(args, '-C', companyId);
      pushOption(args, '--new-company-name', newCompanyName);
      pushCsvOption(args, '--agents', agents);
      pushOption(args, '--collision', collision);
      pushOption(args, '--ref', ref);
      pushOption(args, '--paperclip-url', paperclipUrl);
      pushFlag(args, '--yes', yes);
      pushFlag(args, '--dry-run', dryRun);
      return args;
    },
  );

  registerJsonTool(
    server,
    'paperclip_issue_get',
    'Get one issue by UUID or identifier such as PC-12.',
    {
      issue: z.string(),
    },
    ({ issue }) => ['issue', 'get', issue],
  );

  registerJsonTool(
    server,
    'paperclip_issue_create',
    'Create a new issue in Paperclip.',
    {
      companyId: z.string().optional(),
      title: z.string(),
      description: z.string().optional(),
      status: z.string().optional(),
      priority: z.union([z.string(), z.number().int()]).optional(),
      assigneeAgentId: z.string().optional(),
      projectId: z.string().optional(),
      goalId: z.string().optional(),
      parentId: z.string().optional(),
      requestDepth: z.number().int().optional(),
      billingCode: z.string().optional(),
    },
    ({
      companyId,
      title,
      description,
      status,
      priority,
      assigneeAgentId,
      projectId,
      goalId,
      parentId,
      requestDepth,
      billingCode,
    }) => {
      const args = ['issue', 'create'];
      pushOption(args, '-C', companyId);
      pushOption(args, '--title', title);
      pushOption(args, '--description', description);
      pushOption(args, '--status', status);
      pushOption(args, '--priority', priority);
      pushOption(args, '--assignee-agent-id', assigneeAgentId);
      pushOption(args, '--project-id', projectId);
      pushOption(args, '--goal-id', goalId);
      pushOption(args, '--parent-id', parentId);
      pushOption(args, '--request-depth', requestDepth);
      pushOption(args, '--billing-code', billingCode);
      return args;
    },
  );

  registerJsonTool(
    server,
    'paperclip_issue_update',
    'Update an existing issue.',
    {
      issueId: z.string(),
      title: z.string().optional(),
      description: z.string().optional(),
      status: z.string().optional(),
      priority: z.union([z.string(), z.number().int()]).optional(),
      assigneeAgentId: z.string().optional(),
      projectId: z.string().optional(),
      goalId: z.string().optional(),
      parentId: z.string().optional(),
      requestDepth: z.number().int().optional(),
      billingCode: z.string().optional(),
      comment: z.string().optional(),
      hiddenAt: z.string().nullable().optional(),
    },
    ({
      issueId,
      title,
      description,
      status,
      priority,
      assigneeAgentId,
      projectId,
      goalId,
      parentId,
      requestDepth,
      billingCode,
      comment,
      hiddenAt,
    }) => {
      const args = ['issue', 'update', issueId];
      pushOption(args, '--title', title);
      pushOption(args, '--description', description);
      pushOption(args, '--status', status);
      pushOption(args, '--priority', priority);
      pushOption(args, '--assignee-agent-id', assigneeAgentId);
      pushOption(args, '--project-id', projectId);
      pushOption(args, '--goal-id', goalId);
      pushOption(args, '--parent-id', parentId);
      pushOption(args, '--request-depth', requestDepth);
      pushOption(args, '--billing-code', billingCode);
      pushOption(args, '--comment', comment);
      pushOption(args, '--hidden-at', hiddenAt === null ? 'null' : hiddenAt);
      return args;
    },
  );

  registerJsonTool(
    server,
    'paperclip_issue_comment',
    'Add a comment to an issue, optionally reopening it if it is done or cancelled.',
    {
      issueId: z.string(),
      body: z.string(),
      reopen: z.boolean().optional(),
    },
    ({ issueId, body, reopen }) => {
      const args = ['issue', 'comment', issueId];
      pushOption(args, '--body', body);
      if (reopen) {
        args.push('--reopen');
      }
      return args;
    },
  );

  registerJsonTool(
    server,
    'paperclip_issue_checkout',
    'Checkout an issue for an agent.',
    {
      issueId: z.string(),
      agentId: z.string().optional(),
      expectedStatuses: z.array(z.string()).optional(),
    },
    ({ issueId, agentId, expectedStatuses }) => {
      const args = ['issue', 'checkout', issueId];
      pushOption(args, '--agent-id', agentId);
      pushCsvOption(args, '--expected-statuses', expectedStatuses);
      return args;
    },
  );

  registerJsonTool(
    server,
    'paperclip_issue_release',
    'Release an issue back to todo and clear its assignee.',
    {
      issueId: z.string(),
    },
    ({ issueId }) => ['issue', 'release', issueId],
  );

  registerJsonTool(
    server,
    'paperclip_agent_list',
    'List agents for a company.',
    {
      companyId: z.string().optional(),
    },
    ({ companyId }) => {
      const args = ['agent', 'list'];
      pushOption(args, '-C', companyId);
      return args;
    },
  );

  registerJsonTool(
    server,
    'paperclip_agent_get',
    'Get one agent by ID.',
    {
      agentId: z.string(),
    },
    ({ agentId }) => ['agent', 'get', agentId],
  );

  registerJsonTool(
    server,
    'paperclip_agent_local_cli',
    'Create an agent API key, optionally install local Paperclip skills into Codex and Claude, and return the local CLI bootstrap payload.',
    {
      agentRef: z.string(),
      companyId: z.string().optional(),
      keyName: z.string().optional(),
      installSkills: z.boolean().optional(),
    },
    ({ agentRef, companyId, keyName, installSkills }) => {
      const args = ['agent', 'local-cli', agentRef];
      pushOption(args, '-C', companyId);
      pushOption(args, '--key-name', keyName);
      if (installSkills === false) {
        args.push('--no-install-skills');
      }
      return args;
    },
  );

  registerJsonTool(
    server,
    'paperclip_approval_list',
    'List approvals for a company with an optional status filter.',
    {
      companyId: z.string().optional(),
      status: z.string().optional(),
    },
    ({ companyId, status }) => {
      const args = ['approval', 'list'];
      pushOption(args, '-C', companyId);
      pushOption(args, '--status', status);
      return args;
    },
  );

  registerJsonTool(
    server,
    'paperclip_approval_get',
    'Get one approval by ID.',
    {
      approvalId: z.string(),
    },
    ({ approvalId }) => ['approval', 'get', approvalId],
  );

  registerJsonTool(
    server,
    'paperclip_approval_create',
    'Create a Paperclip approval request.',
    {
      companyId: z.string().optional(),
      type: z.enum(['hire_agent', 'approve_ceo_strategy']),
      payload: z.record(z.unknown()),
      requestedByAgentId: z.string().optional(),
      issueIds: z.array(z.string()).optional(),
    },
    ({ companyId, type, payload, requestedByAgentId, issueIds }) => {
      const args = ['approval', 'create'];
      pushOption(args, '-C', companyId);
      pushOption(args, '--type', type);
      pushOption(args, '--payload', JSON.stringify(payload));
      pushOption(args, '--requested-by-agent-id', requestedByAgentId);
      pushCsvOption(args, '--issue-ids', issueIds);
      return args;
    },
  );

  for (const [name, subcommand, description] of [
    ['paperclip_approval_approve', 'approve', 'Approve a Paperclip approval request.'],
    ['paperclip_approval_reject', 'reject', 'Reject a Paperclip approval request.'],
    [
      'paperclip_approval_request_revision',
      'request-revision',
      'Request revision on a Paperclip approval request.',
    ],
  ]) {
    registerJsonTool(
      server,
      name,
      description,
      {
        approvalId: z.string(),
        decisionNote: z.string().optional(),
        decidedByUserId: z.string().optional(),
      },
      ({ approvalId, decisionNote, decidedByUserId }) => {
        const args = ['approval', subcommand, approvalId];
        pushOption(args, '--decision-note', decisionNote);
        pushOption(args, '--decided-by-user-id', decidedByUserId);
        return args;
      },
    );
  }

  registerJsonTool(
    server,
    'paperclip_approval_resubmit',
    'Resubmit a Paperclip approval request, optionally replacing its payload.',
    {
      approvalId: z.string(),
      payload: z.record(z.unknown()).optional(),
    },
    ({ approvalId, payload }) => {
      const args = ['approval', 'resubmit', approvalId];
      if (payload) {
        pushOption(args, '--payload', JSON.stringify(payload));
      }
      return args;
    },
  );

  registerJsonTool(
    server,
    'paperclip_approval_comment',
    'Add a comment to an approval request.',
    {
      approvalId: z.string(),
      body: z.string(),
    },
    ({ approvalId, body }) => {
      const args = ['approval', 'comment', approvalId];
      pushOption(args, '--body', body);
      return args;
    },
  );

  registerJsonTool(
    server,
    'paperclip_plugin_list',
    'List installed Paperclip plugins, with an optional status filter.',
    {
      status: z.string().optional(),
    },
    ({ status }) => {
      const args = ['plugin', 'list'];
      pushOption(args, '--status', status);
      return args;
    },
  );

  registerJsonTool(
    server,
    'paperclip_plugin_examples',
    'List bundled example plugins available for local install.',
    {},
    () => ['plugin', 'examples'],
  );

  registerJsonTool(
    server,
    'paperclip_plugin_inspect',
    'Inspect one installed Paperclip plugin in detail.',
    {
      pluginKey: z.string(),
    },
    ({ pluginKey }) => ['plugin', 'inspect', pluginKey],
  );

  registerJsonTool(
    server,
    'paperclip_plugin_install',
    'Install a Paperclip plugin from a local path or npm package.',
    {
      packageRef: z.string(),
      local: z.boolean().optional(),
      version: z.string().optional(),
    },
    ({ packageRef, local, version }) => {
      const args = ['plugin', 'install', packageRef];
      pushFlag(args, '--local', local);
      pushOption(args, '--version', version);
      return args;
    },
  );

  registerJsonTool(
    server,
    'paperclip_plugin_enable',
    'Enable a disabled or errored Paperclip plugin.',
    {
      pluginKey: z.string(),
    },
    ({ pluginKey }) => ['plugin', 'enable', pluginKey],
  );

  registerJsonTool(
    server,
    'paperclip_plugin_disable',
    'Disable a running Paperclip plugin without uninstalling it.',
    {
      pluginKey: z.string(),
    },
    ({ pluginKey }) => ['plugin', 'disable', pluginKey],
  );

  registerJsonTool(
    server,
    'paperclip_plugin_uninstall',
    'Uninstall a Paperclip plugin. Set force to hard-purge plugin state and config.',
    {
      pluginKey: z.string(),
      force: z.boolean().optional(),
    },
    ({ pluginKey, force }) => {
      const args = ['plugin', 'uninstall', pluginKey];
      pushFlag(args, '--force', force);
      return args;
    },
  );

  registerCommandTool(
    server,
    'paperclip_heartbeat_run',
    'Run one agent heartbeat and return the streamed logs.',
    {
      agentId: z.string().optional(),
      source: z.enum(['timer', 'assignment', 'on_demand', 'automation']).optional(),
      trigger: z.enum(['manual', 'ping', 'callback', 'system']).optional(),
      timeoutMs: z.number().int().nonnegative().optional(),
      debug: z.boolean().optional(),
    },
    ({ agentId, source, trigger, timeoutMs, debug }) => {
      const args = ['heartbeat', 'run'];
      pushOption(args, '-a', agentId);
      pushOption(args, '--source', source);
      pushOption(args, '--trigger', trigger);
      pushOption(args, '--timeout-ms', timeoutMs);
      pushFlag(args, '--debug', debug);
      return args;
    },
    { json: false },
  );

  registerJsonTool(
    server,
    'paperclip_context_show',
    'Show the current Paperclip CLI context and active profile.',
    {
      profile: z.string().optional(),
    },
    ({ profile }) => {
      const args = ['context', 'show'];
      pushOption(args, '--profile', profile);
      return args;
    },
  );

  registerJsonTool(
    server,
    'paperclip_context_list',
    'List available Paperclip CLI context profiles.',
    {},
    () => ['context', 'list'],
  );

  registerCommandTool(
    server,
    'paperclip_context_use',
    'Set the active Paperclip CLI context profile. This modifies the local context file.',
    {
      profile: z.string(),
    },
    ({ profile }) => ['context', 'use', profile],
    { json: false },
  );

  registerJsonTool(
    server,
    'paperclip_context_set',
    'Set values on a Paperclip CLI context profile and optionally make it active.',
    {
      profile: z.string().optional(),
      apiBase: z.string().optional(),
      companyId: z.string().optional(),
      apiKeyEnvVarName: z.string().optional(),
      useProfile: z.boolean().optional(),
    },
    ({ profile, apiBase, companyId, apiKeyEnvVarName, useProfile }) => {
      const args = ['context', 'set'];
      pushOption(args, '--profile', profile);
      pushOption(args, '--api-base', apiBase);
      pushOption(args, '--company-id', companyId);
      pushOption(args, '--api-key-env-var-name', apiKeyEnvVarName);
      pushFlag(args, '--use', useProfile);
      return args;
    },
  );

  registerJsonTool(
    server,
    'paperclip_auth_whoami',
    'Show the current Paperclip board-user identity for the selected API base.',
    {},
    () => ['auth', 'whoami'],
  );

  registerCommandTool(
    server,
    'paperclip_auth_bootstrap_ceo',
    'Create a one-time bootstrap invite URL for the first Paperclip instance admin.',
    {
      force: z.boolean().optional(),
      expiresHours: z.number().int().positive().optional(),
      baseUrl: z.string().optional(),
    },
    ({ force, expiresHours, baseUrl }) => {
      const args = ['auth', 'bootstrap-ceo'];
      pushFlag(args, '--force', force);
      pushOption(args, '--expires-hours', expiresHours);
      pushOption(args, '--base-url', baseUrl);
      return args;
    },
    { json: false },
  );

  registerCommandTool(
    server,
    'paperclip_doctor',
    'Run Paperclip diagnostics for the current local instance. repair requires yes to avoid interactive prompts.',
    {
      repair: z.boolean().optional(),
      yes: z.boolean().optional(),
    },
    ({ repair, yes }) => {
      if (repair && !yes) {
        throw new Error('paperclip_doctor repair mode requires yes=true to skip interactive confirmation.');
      }

      const args = ['doctor'];
      pushFlag(args, '--repair', repair);
      pushFlag(args, '--yes', yes);
      return args;
    },
    { json: false },
  );

  registerCommandTool(
    server,
    'paperclip_env',
    'Print environment variables for deployment from the current Paperclip config.',
    {},
    () => ['env'],
    { json: false },
  );

  return server;
}

function printHelp() {
  console.log(`paperclip-local-service MCP server

Usage:
  node src/paperclip-mcp.mjs
  node src/paperclip-mcp.mjs --help
  node src/paperclip-mcp.mjs --print-config

Environment:
  PAPERCLIP_HOME         Defaults to ~/.paperclip
  PAPERCLIP_INSTANCE_ID  Defaults to default
  PAPERCLIP_BIN          Defaults to ./node_modules/.bin/paperclipai
  PAPERCLIP_CONFIG       Optional explicit config.json path
  PAPERCLIP_DATA_DIR     Optional explicit Paperclip data root
  PAPERCLIP_CONTEXT      Optional CLI context path
  PAPERCLIP_PROFILE      Optional CLI context profile
  PAPERCLIP_API_BASE     Optional explicit Paperclip API base URL
  PAPERCLIP_API_KEY      Optional explicit Paperclip API key

The server also reads ${path.relative(REPO_DIR, path.join(REPO_DIR, '.env.local'))} if it exists.`);
}

export async function startServer() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  if (process.argv.includes('--print-config')) {
    console.log(stringify(describeResolvedPaperclipContext()));
    process.exit(0);
  }

  startServer().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exit(1);
  });
}

export { createServer };

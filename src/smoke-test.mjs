#!/usr/bin/env node

import assert from 'node:assert/strict';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { REPO_DIR } from './paperclip-cli.mjs';

const serverPath = path.join(REPO_DIR, 'src', 'paperclip-mcp.mjs');
const stderrChunks = [];

const client = new Client({
  name: 'paperclip-local-service-smoke',
  version: '0.1.0',
});

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [serverPath],
  cwd: REPO_DIR,
  env: {
    ...process.env,
  },
  stderr: 'pipe',
});

if (transport.stderr) {
  transport.stderr.on('data', (chunk) => {
    stderrChunks.push(chunk.toString());
  });
}

try {
  await client.connect(transport);

  const tools = await client.listTools();
  const toolNames = tools.tools.map((tool) => tool.name);

  for (const requiredTool of [
    'paperclip_status',
    'paperclip_company_list',
    'paperclip_company_export',
    'paperclip_company_import',
    'paperclip_issue_list',
    'paperclip_agent_list',
    'paperclip_agent_local_cli',
    'paperclip_approval_list',
    'paperclip_dashboard_get',
    'paperclip_activity_list',
    'paperclip_plugin_list',
    'paperclip_context_show',
    'paperclip_auth_whoami',
    'paperclip_doctor',
  ]) {
    assert(toolNames.includes(requiredTool), `Missing required tool: ${requiredTool}`);
  }

  const status = await client.callTool({
    name: 'paperclip_status',
    arguments: {},
  });

  const statusText = status.content.find((item) => item.type === 'text')?.text ?? '';
  assert(statusText.includes('"paperclipHome"'), 'paperclip_status should return resolved configuration');

  console.log('MCP smoke test passed');
} finally {
  await transport.close();
}

if (stderrChunks.length > 0) {
  process.stderr.write(stderrChunks.join(''));
}

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const REPO_DIR = path.resolve(__dirname, '..');
export const LOCAL_ENV_PATH = path.join(REPO_DIR, '.env.local');

let cachedLocalEnv;
const PATH_LIKE_ENV_KEYS = new Set([
  'PAPERCLIP_HOME',
  'PAPERCLIP_BIN',
  'PAPERCLIP_CONFIG',
  'PAPERCLIP_DATA_DIR',
  'PAPERCLIP_CONTEXT',
]);

function trimToUndefined(value) {
  if (typeof value !== 'string') {
    return value ?? undefined;
  }

  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function expandShellishPath(value) {
  let expanded = value;

  if (expanded === '~') {
    expanded = os.homedir();
  } else if (expanded.startsWith('~/')) {
    expanded = path.join(os.homedir(), expanded.slice(2));
  }

  return expanded.replace(/\$([A-Za-z_][A-Za-z0-9_]*)|\$\{([^}]+)\}/g, (match, simpleKey, wrappedKey) => {
    const key = simpleKey ?? wrappedKey;
    return process.env[key] ?? match;
  });
}

function normalizeEnvValue(key, value) {
  const trimmed = trimToUndefined(value);
  if (trimmed === undefined) {
    return undefined;
  }

  if (PATH_LIKE_ENV_KEYS.has(key)) {
    return expandShellishPath(trimmed);
  }

  return trimmed;
}

export function loadLocalEnv() {
  if (cachedLocalEnv !== undefined) {
    return cachedLocalEnv;
  }

  if (!fs.existsSync(LOCAL_ENV_PATH)) {
    cachedLocalEnv = {};
    return cachedLocalEnv;
  }

  cachedLocalEnv = dotenv.parse(fs.readFileSync(LOCAL_ENV_PATH, 'utf8'));
  return cachedLocalEnv;
}

function getEnvValue(overrides, localEnv, key) {
  return normalizeEnvValue(key, overrides[key] ?? process.env[key] ?? localEnv[key]);
}

export function resolvePaperclipContext(overrides = {}) {
  const localEnv = loadLocalEnv();
  const paperclipHome = getEnvValue(overrides, localEnv, 'PAPERCLIP_HOME') ?? path.join(os.homedir(), '.paperclip');
  const instanceId = getEnvValue(overrides, localEnv, 'PAPERCLIP_INSTANCE_ID') ?? 'default';
  const paperclipBin = getEnvValue(overrides, localEnv, 'PAPERCLIP_BIN') ?? path.join(REPO_DIR, 'node_modules', '.bin', 'paperclipai');
  const configExplicit =
    trimToUndefined(overrides.PAPERCLIP_CONFIG) !== undefined ||
    trimToUndefined(process.env.PAPERCLIP_CONFIG) !== undefined ||
    trimToUndefined(localEnv.PAPERCLIP_CONFIG) !== undefined;
  const configPath = getEnvValue(overrides, localEnv, 'PAPERCLIP_CONFIG') ?? path.join(paperclipHome, 'instances', instanceId, 'config.json');
  const dataDir = getEnvValue(overrides, localEnv, 'PAPERCLIP_DATA_DIR') ?? paperclipHome;
  const contextPath = getEnvValue(overrides, localEnv, 'PAPERCLIP_CONTEXT');
  const profile = getEnvValue(overrides, localEnv, 'PAPERCLIP_PROFILE');
  const apiBase = getEnvValue(overrides, localEnv, 'PAPERCLIP_API_BASE');
  const apiKey = getEnvValue(overrides, localEnv, 'PAPERCLIP_API_KEY');

  return {
    repoDir: REPO_DIR,
    localEnvPath: LOCAL_ENV_PATH,
    localEnvLoaded: fs.existsSync(LOCAL_ENV_PATH),
    paperclipHome,
    instanceId,
    paperclipBin,
    configExplicit,
    configPath,
    dataDir,
    contextPath,
    profile,
    apiBase,
    apiKey,
    environment: {
      ...localEnv,
      ...process.env,
      PAPERCLIP_HOME: paperclipHome,
      PAPERCLIP_INSTANCE_ID: instanceId,
      PAPERCLIP_BIN: paperclipBin,
    },
  };
}

export function describeResolvedPaperclipContext(overrides = {}) {
  const context = resolvePaperclipContext(overrides);

  return {
    repoDir: context.repoDir,
    localEnvPath: context.localEnvLoaded ? context.localEnvPath : null,
    paperclipBin: context.paperclipBin,
    paperclipBinExists: fs.existsSync(context.paperclipBin),
    paperclipHome: context.paperclipHome,
    instanceId: context.instanceId,
    configPath: context.configPath,
    configExists: fs.existsSync(context.configPath),
    dataDir: context.dataDir,
    contextPath: context.contextPath ?? null,
    profile: context.profile ?? null,
    apiBase: context.apiBase ?? null,
    apiKeyConfigured: Boolean(context.apiKey),
  };
}

function buildSharedArgs(context) {
  const args = [];

  if (context.configPath && (context.configExplicit || fs.existsSync(context.configPath))) {
    args.push('-c', context.configPath);
  }

  if (context.dataDir) {
    args.push('-d', context.dataDir);
  }

  if (context.contextPath) {
    args.push('--context', context.contextPath);
  }

  if (context.profile) {
    args.push('--profile', context.profile);
  }

  if (context.apiBase) {
    args.push('--api-base', context.apiBase);
  }

  if (context.apiKey) {
    args.push('--api-key', context.apiKey);
  }

  return args;
}

export function runPaperclipCommand(commandArgs, options = {}) {
  const context = resolvePaperclipContext(options.overrides);

  return new Promise((resolve, reject) => {
    const child = spawn(
      context.paperclipBin,
      [...commandArgs, ...buildSharedArgs(context), ...(options.json === false ? [] : ['--json'])],
      {
        cwd: REPO_DIR,
        env: context.environment,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      reject(
        new Error(
          `Failed to start paperclipai at ${context.paperclipBin}: ${error.message}`,
          { cause: error },
        ),
      );
    });

    child.on('close', (code) => {
      resolve({
        code: code ?? 0,
        stdout,
        stderr,
        context,
        command: [context.paperclipBin, ...commandArgs, ...buildSharedArgs(context), ...(options.json === false ? [] : ['--json'])],
      });
    });
  });
}

export async function runPaperclipJson(commandArgs, options = {}) {
  const result = await runPaperclipCommand(commandArgs, options);
  const stdout = result.stdout.trim();
  const stderr = result.stderr.trim();

  if (result.code !== 0) {
    throw new Error(
      stderr || stdout || `paperclipai exited with code ${result.code}`,
      { cause: { code: result.code, command: result.command } },
    );
  }

  if (stdout === '') {
    return null;
  }

  try {
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(
      `paperclipai returned non-JSON output: ${stdout}`,
      { cause: error },
    );
  }
}

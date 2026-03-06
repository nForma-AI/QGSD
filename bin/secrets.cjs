'use strict';
const os = require('os');
const fs = require('fs');
const path = require('path');
const SERVICE = 'nforma';

const INDEX_PATH = path.join(os.homedir(), '.claude', 'nf-key-index.json');

// Read the key index (no keychain access needed — just a JSON file)
function readIndex() {
  try {
    return new Set(JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8')).accounts || []);
  } catch (_) {
    return new Set();
  }
}

function writeIndex(accounts) {
  fs.mkdirSync(path.dirname(INDEX_PATH), { recursive: true });
  fs.writeFileSync(INDEX_PATH, JSON.stringify({ accounts: [...accounts] }, null, 2));
}

// Check if a key exists — no keychain prompt, reads local index only
function hasKey(key) {
  return readIndex().has(key);
}

// Lazy-load keytar with a graceful error if the native addon is missing
function getKeytar() {
  try {
    return require('keytar');
  } catch (e) {
    throw new Error(
      'keytar native addon not found. Run `npm install keytar` (requires libsecret-dev on Linux).\n' +
      'Original error: ' + e.message
    );
  }
}

async function set(service, key, value) {
  await getKeytar().setPassword(service, key, value);
  const idx = readIndex();
  idx.add(key);
  writeIndex(idx);
}

async function get(service, key) {
  return getKeytar().getPassword(service, key);
}

async function del(service, key) {
  const result = await getKeytar().deletePassword(service, key);
  const idx = readIndex();
  idx.delete(key);
  writeIndex(idx);
  return result;
}

async function list(service) {
  return getKeytar().findCredentials(service);
  // returns [{account, password}]
}

/**
 * Reads all secrets stored under `service` from the keychain,
 * then patches matching env keys in every mcpServers entry in ~/.claude.json.
 *
 * Algorithm:
 *   1. Load all credentials for the service (account = env var name, password = value)
 *   2. Read ~/.claude.json (parse JSON; if missing/corrupt, log warning and return)
 *   3. Iterate claudeJson.mcpServers — for each server with an `env` block,
 *      for each credential whose account name appears as a key in `env`,
 *      overwrite `env[account]` with the credential's password.
 *   4. Write the patched JSON back to ~/.claude.json with 2-space indent.
 */
async function syncToClaudeJson(service) {
  const os = require('os');
  const fs = require('fs');
  const path = require('path');

  const claudeJsonPath = path.join(os.homedir(), '.claude.json');

  let credentials;
  try {
    credentials = await list(service);
  } catch (e) {
    process.stderr.write('[nf-secrets] keytar unavailable: ' + e.message + '\n');
    return;
  }

  if (!credentials || credentials.length === 0) return;

  // Build a lookup map: { ACCOUNT_NAME: password }
  const credMap = {};
  for (const c of credentials) {
    credMap[c.account] = c.password;
  }

  let raw;
  try {
    raw = fs.readFileSync(claudeJsonPath, 'utf8');
  } catch (e) {
    process.stderr.write('[nf-secrets] ~/.claude.json not found, skipping sync\n');
    return;
  }

  let claudeJson;
  try {
    claudeJson = JSON.parse(raw);
  } catch (e) {
    process.stderr.write('[nf-secrets] ~/.claude.json is invalid JSON, skipping sync\n');
    return;
  }

  if (!claudeJson.mcpServers || typeof claudeJson.mcpServers !== 'object') return;

  let patched = 0;
  for (const serverName of Object.keys(claudeJson.mcpServers)) {
    const server = claudeJson.mcpServers[serverName];
    if (!server.env || typeof server.env !== 'object') continue;
    for (const envKey of Object.keys(server.env)) {
      if (credMap[envKey] !== undefined) {
        server.env[envKey] = credMap[envKey];
        patched++;
      }
    }
  }

  if (patched > 0) {
    fs.writeFileSync(claudeJsonPath, JSON.stringify(claudeJson, null, 2));
  }
}

module.exports = { set, get, delete: del, list, hasKey, syncToClaudeJson, SERVICE };

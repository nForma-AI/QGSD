---
phase: quick-51
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/secrets.cjs
  - bin/set-secret.cjs
  - hooks/qgsd-session-start.js
  - package.json
  - bin/install.js
autonomous: true
requirements: [QUICK-51]

must_haves:
  truths:
    - "node bin/set-secret.cjs API_KEY myvalue stores the value in the OS keychain under service 'qgsd'"
    - "node bin/set-secret.cjs API_KEY myvalue patches the matching env entry in ~/.claude.json mcpServers"
    - "qgsd-session-start.js runs syncToClaudeJson on every session start, keeping ~/.claude.json current"
    - "install.js registers qgsd-session-start.js as a SessionStart hook (alongside check-update)"
    - "install.js uninstall removes the session-start sync hook from SessionStart"
    - "If keytar is not installed, secrets.cjs throws a clear error rather than crashing with a native binding message"
  artifacts:
    - path: "bin/secrets.cjs"
      provides: "keytar wrapper with set/get/delete/list/syncToClaudeJson"
      exports: ["set", "get", "delete", "list", "syncToClaudeJson"]
    - path: "bin/set-secret.cjs"
      provides: "CLI entry: node bin/set-secret.cjs <KEY> <value>"
      contains: "syncToClaudeJson"
    - path: "hooks/qgsd-session-start.js"
      provides: "SessionStart hook that syncs keychain -> ~/.claude.json"
      contains: "syncToClaudeJson"
    - path: "package.json"
      provides: "keytar listed as dependency"
      contains: "keytar"
  key_links:
    - from: "bin/set-secret.cjs"
      to: "bin/secrets.cjs"
      via: "require('./secrets.cjs')"
      pattern: "require.*secrets"
    - from: "hooks/qgsd-session-start.js"
      to: "bin/secrets.cjs"
      via: "require from installed path"
      pattern: "syncToClaudeJson"
    - from: "bin/install.js"
      to: "hooks/qgsd-session-start.js"
      via: "SessionStart hook registration"
      pattern: "qgsd-session-start"
    - from: "bin/secrets.cjs syncToClaudeJson"
      to: "~/.claude.json mcpServers[*].env"
      via: "JSON read-patch-write"
      pattern: "mcpServers"
---

<objective>
Add keytar-based cross-platform secret management to QGSD so MCP API keys are stored in the OS keychain instead of plaintext in ~/.claude.json or ~/.zshrc.

Purpose: QGSD becomes the owner of MCP secrets — set once, synced automatically on every session start.
Output: bin/secrets.cjs, bin/set-secret.cjs, hooks/qgsd-session-start.js, package.json dep, install.js hook registration.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create bin/secrets.cjs keytar wrapper and bin/set-secret.cjs CLI</name>
  <files>bin/secrets.cjs, bin/set-secret.cjs, package.json</files>
  <action>
**package.json** — add `"keytar": "^7.9.0"` to `"dependencies": {}`. Keep all existing fields unchanged.

**bin/secrets.cjs** — create CJS module (no shebang, used as require'd library):

```js
'use strict';
const SERVICE = 'qgsd';

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
}

async function get(service, key) {
  return getKeytar().getPassword(service, key);
}

async function del(service, key) {
  return getKeytar().deletePassword(service, key);
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
    process.stderr.write('[qgsd-secrets] keytar unavailable: ' + e.message + '\n');
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
    process.stderr.write('[qgsd-secrets] ~/.claude.json not found, skipping sync\n');
    return;
  }

  let claudeJson;
  try {
    claudeJson = JSON.parse(raw);
  } catch (e) {
    process.stderr.write('[qgsd-secrets] ~/.claude.json is invalid JSON, skipping sync\n');
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

module.exports = { set, get, delete: del, list, syncToClaudeJson, SERVICE };
```

**bin/set-secret.cjs** — create CJS CLI entry point:

```js
#!/usr/bin/env node
'use strict';
/**
 * set-secret.cjs
 * Usage: node bin/set-secret.cjs <KEY_NAME> <value>
 *
 * Stores KEY_NAME=value in the OS keychain under service "qgsd",
 * then syncs all qgsd secrets into ~/.claude.json mcpServers env blocks.
 */
const { set, syncToClaudeJson, SERVICE } = require('./secrets.cjs');

const [,, keyName, ...valueParts] = process.argv;
if (!keyName || valueParts.length === 0) {
  console.error('Usage: node bin/set-secret.cjs <KEY_NAME> <value>');
  process.exit(1);
}
const value = valueParts.join(' ');

(async () => {
  try {
    await set(SERVICE, keyName, value);
    console.log(`[qgsd] Stored ${keyName} in keychain (service: ${SERVICE})`);
    await syncToClaudeJson(SERVICE);
    console.log('[qgsd] Synced keychain secrets to ~/.claude.json');
  } catch (e) {
    console.error('[qgsd] Error:', e.message);
    process.exit(1);
  }
})();
```
  </action>
  <verify>
    1. `node -e "const s = require('./bin/secrets.cjs'); console.log(typeof s.set, typeof s.syncToClaudeJson);"` from `/Users/jonathanborduas/code/QGSD` prints `function function`.
    2. `grep '"keytar"' package.json` outputs a line with keytar.
    3. `node bin/set-secret.cjs` (no args) prints usage and exits non-zero.
  </verify>
  <done>
    bin/secrets.cjs exports set/get/delete/list/syncToClaudeJson. bin/set-secret.cjs CLI accepts KEY VALUE and exits non-zero on missing args. package.json lists keytar as a dependency.
  </done>
</task>

<task type="auto">
  <name>Task 2: Create hooks/qgsd-session-start.js and wire into install.js</name>
  <files>hooks/qgsd-session-start.js, bin/install.js</files>
  <action>
**hooks/qgsd-session-start.js** — create SessionStart hook:

```js
#!/usr/bin/env node
// hooks/qgsd-session-start.js
// SessionStart hook — syncs QGSD keychain secrets into ~/.claude.json
// on every session start so mcpServers env blocks always reflect current keychain state.
//
// Runs synchronously (hook expects process to exit) — uses async IIFE with catch.

'use strict';

const path = require('path');
const os = require('os');

// Locate secrets.cjs — try installed global path first, then local dev path
function findSecrets() {
  const candidates = [
    path.join(os.homedir(), '.claude', 'qgsd', 'bin', 'secrets.cjs'),
    path.join(__dirname, '..', 'bin', 'secrets.cjs'),
  ];
  for (const p of candidates) {
    try {
      return require(p);
    } catch (_) {}
  }
  return null;
}

(async () => {
  const secrets = findSecrets();
  if (!secrets) {
    // silently skip — QGSD may not be installed yet or keytar absent
    process.exit(0);
  }
  try {
    await secrets.syncToClaudeJson(secrets.SERVICE);
  } catch (e) {
    // Non-fatal — write to stderr for debug logs, but never block session start
    process.stderr.write('[qgsd-session-start] sync error: ' + e.message + '\n');
  }
  process.exit(0);
})();
```

**bin/install.js** — add session-start sync hook registration and uninstall cleanup.

Locate the block starting at ~line 1726 (`const hasGsdUpdateHook = ...`). After the existing `if (!hasGsdUpdateHook)` block that pushes the update-check hook (around line 1739, after the `console.log` for "Configured update check hook"), add the session-start sync hook registration:

```js
    // Register QGSD session-start secret sync hook
    const hasGsdSessionStartHook = settings.hooks.SessionStart.some(entry =>
      entry.hooks && entry.hooks.some(h => h.command && h.command.includes('qgsd-session-start'))
    );
    if (!hasGsdSessionStartHook) {
      settings.hooks.SessionStart.push({
        hooks: [
          {
            type: 'command',
            command: buildHookCommand(targetDir, 'qgsd-session-start.js')
          }
        ]
      });
      console.log(`  ${green}✓${reset} Configured QGSD secret sync hook (SessionStart)`);
    }
```

Locate the uninstall block that filters SessionStart (~line 1076-1093). The filter predicate currently checks for `qgsd-check-update` and `qgsd-statusline`. Extend it to also remove `qgsd-session-start`:

```js
          const hasGsdHook = entry.hooks.some(h =>
            h.command && (
              h.command.includes('qgsd-check-update') ||
              h.command.includes('qgsd-statusline') ||
              h.command.includes('qgsd-session-start')
            )
          );
```

Also extend the "Removed GSD hooks from settings" log message to mention the sync hook (optional but useful for clarity — only if the log is a single generic message, leave it as-is to avoid drift).

The hook file must also be included in the installed `hooks/` directory. install.js copies hooks via a `copyDir` or file-by-file step. Verify the copy logic includes all `.js` files in the hooks/ directory; if it uses a glob or `fs.readdirSync`, it will pick up `qgsd-session-start.js` automatically without further changes. If it lists files explicitly, add `qgsd-session-start.js` to that list.
  </action>
  <verify>
    1. `node -e "require('./hooks/qgsd-session-start.js')"` exits 0 (secrets not installed → silently skips).
    2. `grep 'qgsd-session-start' bin/install.js` returns at least 2 matches (registration + uninstall filter).
    3. Run `node bin/install.js --help 2>&1 || true` — install.js parses without syntax errors.
  </verify>
  <done>
    hooks/qgsd-session-start.js exists and exits 0 when secrets are absent. install.js registers it as a SessionStart hook and removes it on uninstall. The hook file is automatically included in the installed hooks/ directory (no manual copy-list needed if install uses readdirSync).
  </done>
</task>

</tasks>

<verification>
After both tasks complete:
1. Module loads cleanly: `node -e "const s = require('./bin/secrets.cjs'); console.log(Object.keys(s))"` → `[ 'set', 'get', 'delete', 'list', 'syncToClaudeJson', 'SERVICE' ]`
2. CLI guards: `node bin/set-secret.cjs` exits 1 with usage message.
3. Hook is silent on missing keytar: `node hooks/qgsd-session-start.js` exits 0.
4. install.js registers and unregisters session-start hook: `grep -c 'qgsd-session-start' bin/install.js` ≥ 2.
5. package.json: `grep '"keytar"' package.json` shows the dependency.
</verification>

<success_criteria>
- bin/secrets.cjs: keytar wrapper with graceful fallback, syncToClaudeJson patches ~/.claude.json mcpServers env keys found in keychain
- bin/set-secret.cjs: CLI stores to keychain then syncs; validates args
- hooks/qgsd-session-start.js: SessionStart hook, silent on absent keytar, non-blocking on errors
- package.json: keytar listed under dependencies
- bin/install.js: registers session-start hook on install, removes it on uninstall
</success_criteria>

<output>
After completion, create `.planning/quick/51-add-keytar-based-cross-platform-secret-m/51-SUMMARY.md`
</output>

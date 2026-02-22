---
name: qgsd:mcp-setup
description: Configure quorum agents — first-run linear onboarding for new installs, live-status agent menu for re-runs
allowed-tools:
  - Bash
  - Read
---

<objective>
Configure QGSD quorum agents in `~/.claude.json`. Detects whether any MCP servers are configured and routes to the appropriate flow:
- **First-run** (zero configured entries): linear onboarding — select agent templates, collect API keys via keytar, write batch changes with backup, restart agents
- **Re-run** (existing entries): live-status agent roster menu — view model/provider/key status, select agent, choose action (set key / swap provider / remove)
</objective>

<process>

## Step 1: Detect first-run vs re-run

Run this Bash command and store the output as SETUP_INFO:

```bash
SETUP_INFO=$(node -e "
const fs = require('fs');
const path = require('path');
const os = require('os');

const claudeJsonPath = path.join(os.homedir(), '.claude.json');
let claudeJson = {};
try {
  claudeJson = JSON.parse(fs.readFileSync(claudeJsonPath, 'utf8'));
} catch (e) {
  // Missing or corrupt: treat as fresh install
}
const servers = claudeJson.mcpServers || {};
const configured = Object.entries(servers).filter(([k, v]) => v && v.command && v.args);
const isFirstRun = configured.length === 0;
const result = { isFirstRun, configuredCount: configured.length, agentKeys: configured.map(([k]) => k) };
process.stdout.write(JSON.stringify(result) + '\n');
")
```

Parse SETUP_INFO JSON for: `isFirstRun` (boolean), `configuredCount` (int), `agentKeys` (array).

**If `isFirstRun` is true:** Continue to Step 2 (first-run flow).

**If `isFirstRun` is false:** Skip to the Re-run Agent Menu section below.

---

## Step 2: First-run onboarding flow

Display the welcome banner:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► MCP SETUP — FIRST RUN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

No quorum agents configured. Let's set up your first agent.

Each agent is a claude-mcp-server instance connected to a
different LLM provider. You need at least one to use quorum.
```

**Provider template map** (reference throughout the first-run flow):

| Agent | Provider | Base URL | Model |
|---|---|---|---|
| claude-deepseek | AkashML | https://api.akashml.com/v1 | deepseek-ai/DeepSeek-V3 |
| claude-minimax | AkashML | https://api.akashml.com/v1 | MiniMaxAI/MiniMax-M2.5 |
| claude-qwen-coder | Together.xyz | https://api.together.xyz/v1 | Qwen/Qwen3-Coder-480B |
| claude-llama4 | Together.xyz | https://api.together.xyz/v1 | meta-llama/Llama-4-M |
| claude-kimi | Fireworks | https://api.fireworks.ai/inference/v1 | kimi |

### Step 2a: Select agent template

Use AskUserQuestion:
- header: "Choose an agent to configure"
- question: "Select an agent template to set up. You can add more after."
- options (omit agents already configured or skipped in this session):
  - "1 — claude-deepseek (AkashML, DeepSeek-V3)"
  - "2 — claude-minimax (AkashML, MiniMax-M2.5)"
  - "3 — claude-qwen-coder (Together.xyz, Qwen3-Coder-480B)"
  - "4 — claude-llama4 (Together.xyz, Llama-4-M)"
  - "5 — claude-kimi (Fireworks, kimi)"
  - "Skip — configure later via /qgsd:mcp-setup"

If "Skip" is chosen, display:

```
⚠ No agents configured. Run /qgsd:mcp-setup when ready.
```

Stop.

### Step 2b: Collect API key

Resolve agent name, provider name, base URL, and model from the selection using the template map above.

Use AskUserQuestion:
- header: "API Key — {agent-name}"
- question: "Enter your {provider-name} API key.\n\nThe key will be stored in your system keychain (keytar). It will not appear in any log or plain-text file."
- options:
  - "Continue (I have my key ready)"
  - "Skip this agent"

If "Skip this agent": add agent to skipped list, return to Step 2a.

If "Continue": use a second AskUserQuestion to collect the key:
- header: "Enter API Key"
- question: "Paste the API key for {agent-name} ({provider-name}):"
- options: (user types key and selects "Confirm")
  - "Confirm key"

Store the key using this Bash command (substitute AGENT_KEY and API_KEY):

```bash
KEY_RESULT=$(node -e "
const { set, SERVICE } = require('/Users/jonathanborduas/code/QGSD/bin/secrets.cjs');
const agentKey = process.env.AGENT_KEY;
const apiKey   = process.env.API_KEY;
(async () => {
  try {
    const keyName = 'ANTHROPIC_API_KEY_' + agentKey.toUpperCase().replace(/-/g,'_');
    await set(SERVICE, keyName, apiKey);
    process.stdout.write(JSON.stringify({ stored: true, method: 'keytar', keyName }) + '\n');
  } catch (e) {
    process.stdout.write(JSON.stringify({ stored: false, error: e.message }) + '\n');
  }
})();
" AGENT_KEY="{agent-name}" API_KEY="{user-key}")
```

Parse KEY_RESULT:
- `stored: true` — mark agent as `method: keytar` in pending batch
- `stored: false` (keytar unavailable) — handle fallback below

**Keytar unavailable fallback:**

Use AskUserQuestion:
- header: "Keychain Unavailable"
- question: "System keychain unavailable. API key will be stored unencrypted in ~/.claude.json (less secure). Confirm?\n\nLinux users: sudo apt install libsecret-1-dev gnome-keyring"
- options:
  - "Store unencrypted in ~/.claude.json (less secure)"
  - "Skip this agent"

If "Skip this agent": add to skipped list, return to Step 2a.

If "Store unencrypted": mark agent as `method: env_block` with the key value in pending batch. Write audit log:

```bash
mkdir -p ~/.claude/debug
node -e "
const fs = require('fs');
const ts = new Date().toISOString();
const msg = ts + ' QGSD mcp-setup: keytar unavailable for ' + process.env.AGENT_KEY + ' — API key stored unencrypted in env block\n';
fs.appendFileSync(require('os').homedir() + '/.claude/debug/mcp-setup-audit.log', msg);
" AGENT_KEY="{agent-name}"
```

### Step 2c: Add another or finish

Use AskUserQuestion:
- header: "Agent Added"
- question: "Agent {agent-name} configured. Add another or finish?"
- options:
  - "Add another agent"
  - "Finish setup"

If "Add another agent": return to Step 2a (omit already-configured agents).
If "Finish setup": continue to Step 3.

---

## Step 3: Apply pending changes

If pending batch is empty (all skipped):

```
⚠ No agents configured. Run /qgsd:mcp-setup when ready.
```

Stop.

Display pending summary:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► REVIEW PENDING CHANGES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Agents to add to ~/.claude.json:

  ◆ {agent-name}  →  {provider}  ({base-url})
    Key: {stored in system keychain | stored in env block (unencrypted)}
  [repeat for each pending agent]

Skipped:
  ○ {agent-name} — run /qgsd:mcp-setup to configure later
```

Use AskUserQuestion:
- header: "Apply Changes"
- question: "Apply changes to ~/.claude.json and restart configured agents?"
- options:
  - "Apply and restart agents"
  - "Cancel — discard all changes"

If "Cancel": display "Changes discarded." Stop.

If "Apply and restart agents":

### Step 3a: Backup ~/.claude.json

```bash
cp ~/.claude.json ~/.claude.json.backup-$(date +%Y-%m-%d-%H%M%S) 2>/dev/null || true
```

### Step 3b: Resolve claude-mcp-server path

```bash
CLAUDE_MCP_PATH=$(node -e "
const path = require('path');
const fs   = require('fs');
const os   = require('os');
const { spawnSync } = require('child_process');

// Strategy 1: read from existing ~/.claude.json entries
try {
  const cj = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.claude.json'), 'utf8'));
  for (const [, cfg] of Object.entries(cj.mcpServers || {})) {
    if ((cfg.args || []).some(a => String(a).includes('claude-mcp-server'))) {
      process.stdout.write(cfg.args[0]);
      process.exit(0);
    }
  }
} catch (e) {}

// Strategy 2: check global npm root
try {
  const r = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' });
  const npmRoot = (r.stdout || '').trim();
  const candidate = path.join(npmRoot, 'claude-mcp-server', 'dist', 'index.js');
  if (fs.existsSync(candidate)) { process.stdout.write(candidate); process.exit(0); }
} catch (e) {}

process.stdout.write('');
" 2>/dev/null)
```

### Step 3c: Write entries to ~/.claude.json

For each pending agent, add the mcpServers entry. Use this inline node script as a template (adapt for the actual pending agents in the session):

```bash
node -e "
const fs  = require('fs');
const path = require('path');
const os  = require('os');

const claudeJsonPath = path.join(os.homedir(), '.claude.json');
let claudeJson = {};
try { claudeJson = JSON.parse(fs.readFileSync(claudeJsonPath, 'utf8')); } catch (e) {}
if (!claudeJson.mcpServers) claudeJson.mcpServers = {};

// pendingAgents is an array of { name, baseUrl, model, method, apiKey }
// where method is 'keytar' or 'env_block'
const pendingAgents = JSON.parse(process.env.PENDING_AGENTS_JSON);
const mcpPath = process.env.CLAUDE_MCP_PATH || '';

for (const agent of pendingAgents) {
  claudeJson.mcpServers[agent.name] = {
    command: 'node',
    args: [mcpPath],
    env: {
      ANTHROPIC_API_KEY: agent.method === 'env_block' ? agent.apiKey : '',
      ANTHROPIC_BASE_URL: agent.baseUrl,
      CLAUDE_DEFAULT_MODEL: agent.model
    }
  };
}

fs.writeFileSync(claudeJsonPath, JSON.stringify(claudeJson, null, 2));
process.stdout.write(JSON.stringify({ written: true, count: pendingAgents.length }) + '\n');
" PENDING_AGENTS_JSON='...' CLAUDE_MCP_PATH="$CLAUDE_MCP_PATH"
```

### Step 3d: Sync keytar secrets to env blocks

```bash
node -e "
const { syncToClaudeJson, SERVICE } = require('/Users/jonathanborduas/code/QGSD/bin/secrets.cjs');
syncToClaudeJson(SERVICE)
  .then(() => process.stdout.write('synced\n'))
  .catch(e => process.stderr.write('sync warning: ' + e.message + '\n'));
"
```

### Step 3e: Restart each configured agent (sequential — one at a time)

For each agent in the pending batch:

Invoke `/qgsd:mcp-restart {agent-name}`.

If restart fails or times out, leave config in written state and display:

```
⚠ {agent-name}: restart failed. Config was written — agent will reload on next Claude Code restart.
  Manual retry: /qgsd:mcp-restart {agent-name}
```

### Step 3f: Closing summary

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► SETUP COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Changes applied and agents restarted.

  ✓ {agent-name} — restarted
  [repeat for each successfully restarted agent]

  ○ {agent-name} — skipped (run /qgsd:mcp-setup to configure later)
  [repeat for each skipped agent]

Run /qgsd:mcp-status to verify agent health.
```

---

## Re-run Agent Menu

Read the current agent roster from `~/.claude.json`:

```bash
ROSTER=$(node -e "
const fs   = require('fs');
const path = require('path');
const os   = require('os');

(async () => {
  let claudeJson = {};
  try {
    claudeJson = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.claude.json'), 'utf8'));
  } catch (e) {}

  const servers = claudeJson.mcpServers || {};
  const agents = [];

  for (const [name, cfg] of Object.entries(servers)) {
    const env      = cfg.env || {};
    const model    = env.CLAUDE_DEFAULT_MODEL || '—';
    const provider = env.ANTHROPIC_BASE_URL   || '—';

    let keyStatus = 'no key';
    try {
      const { get, SERVICE } = require('/Users/jonathanborduas/code/QGSD/bin/secrets.cjs');
      const keyName = 'ANTHROPIC_API_KEY_' + name.toUpperCase().replace(/-/g,'_');
      const stored  = await get(SERVICE, keyName);
      keyStatus = stored ? 'key stored' : (env.ANTHROPIC_API_KEY ? 'key in env' : 'no key');
    } catch (e) {
      keyStatus = env.ANTHROPIC_API_KEY ? 'key in env' : 'no key';
    }

    agents.push({ name, model, provider, keyStatus });
  }

  process.stdout.write(JSON.stringify({ agents }) + '\n');
})();
")
```

Parse ROSTER for `agents` array.

Display re-run banner:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► MCP SETUP — AGENT ROSTER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Render a numbered table with columns: #, Agent, Model, Provider, Key:

```
#   Agent                Model                       Provider                               Key
──  ───────────────────  ──────────────────────────  ─────────────────────────────────────  ──────────
1   claude-deepseek      deepseek-ai/DeepSeek-V3     https://api.akashml.com/v1             key stored
2   claude-minimax       MiniMaxAI/MiniMax-M2.5      https://api.akashml.com/v1             no key
```

Use AskUserQuestion:
- header: "Select Agent"
- question: "Enter the number of the agent to configure, or choose an option:"
- options:
  - "1 — {agent-name}" (one per agent)
  - "Add new agent (Phase 35)"
  - "Exit"

If "Exit": display "No changes made." Stop.

If "Add new agent":

```
⚠ Agent add/remove is implemented in Phase 35.
  Run /qgsd:mcp-setup after Phase 35 is complete to use this feature.
```

Return to roster display.

If agent selected: continue to Agent Sub-Menu.

---

## Agent Sub-Menu

Display agent detail banner:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► {agent-name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Model:    {model}
  Provider: {provider}
  Key:      {keyStatus}
```

Use AskUserQuestion:
- header: "Actions — {agent-name}"
- question: "Choose an action:"
- options:
  - "1 — Set / update API key (Phase 33)"
  - "2 — Swap provider (Phase 34)"
  - "3 — Remove agent (Phase 35)"
  - "Back — return to agent list"

**Option 1 — Set / update API key:**

```
⚠ Full API key management is implemented in Phase 33.

  Quick key update (available now):
    node /Users/jonathanborduas/code/QGSD/bin/set-secret.cjs \
      ANTHROPIC_API_KEY_{AGENT_UPPER} <your-key>

  Then restart:  /qgsd:mcp-restart {agent-name}
```

Return to sub-menu.

**Option 2 — Swap provider:**

```
⚠ Full provider swap with validation is implemented in Phase 34.

  To change provider manually:
    1. Edit ~/.claude.json
       Set: mcpServers["{agent-name}"].env.ANTHROPIC_BASE_URL to one of:
         AkashML    → https://api.akashml.com/v1
         Together   → https://api.together.xyz/v1
         Fireworks  → https://api.fireworks.ai/inference/v1
    2. Run /qgsd:mcp-restart {agent-name}
```

Return to sub-menu.

**Option 3 — Remove agent:**

```
⚠ Agent removal is implemented in Phase 35.

  To remove manually:
    1. Delete the "{agent-name}" key from ~/.claude.json mcpServers
    2. Restart Claude Code to deregister the agent
```

Return to sub-menu.

**Option "Back":** Return to Re-run Agent Menu.

---

## Confirm + Apply + Restart Flow

Used by actions that accumulate pending changes in a session.

Display pending summary:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► REVIEW PENDING CHANGES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ◆ {agent-name} — {description of change}
```

Use AskUserQuestion:
- header: "Apply Changes"
- question: "Apply changes to ~/.claude.json and restart affected agents?"
- options:
  - "Apply and restart"
  - "Cancel — discard changes"

If "Cancel": display "Changes discarded." Return to roster.

If "Apply and restart":

1. Backup:
```bash
cp ~/.claude.json ~/.claude.json.backup-$(date +%Y-%m-%d-%H%M%S) 2>/dev/null || true
```

2. Write changes to `~/.claude.json` (inline node — read current, apply patch, write with 2-space indent).

3. Sync keytar secrets:
```bash
node -e "
const { syncToClaudeJson, SERVICE } = require('/Users/jonathanborduas/code/QGSD/bin/secrets.cjs');
syncToClaudeJson(SERVICE).then(() => process.stdout.write('synced\n')).catch(e => process.stderr.write(e.message + '\n'));
"
```

4. For each affected agent (sequential, one at a time): invoke `/qgsd:mcp-restart {agent-name}`.

5. Display:
```
✓ Changes applied and agent(s) restarted.

  ✓ {agent-name} — restarted

Run /qgsd:mcp-status to verify agent health.
```

If a restart fails, leave config written and display:
```
⚠ {agent-name}: restart failed. Config applied — reload on next Claude Code restart.
  Manual retry: /qgsd:mcp-restart {agent-name}
```

</process>

<success_criteria>
- First-run (no mcpServers): welcome banner + agent template list + key collection (keytar/fallback) + batch-write + backup + restart + summary
- Re-run (existing entries): numbered agent roster with model/provider/key-status columns
- Sub-menu per agent: set key stub (Phase 33), swap provider stub (Phase 34), remove stub (Phase 35)
- Confirm+apply+restart: backup then write then sync keytar then mcp-restart per agent then confirmation
- No changes applied without explicit user confirmation
- Keytar failure: warning + Linux hint + confirmation before env-block fallback + audit log
</success_criteria>

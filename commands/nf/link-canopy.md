---
name: nf:link-canopy
description: Link nForma with an installed Canopy IDE — import agent config and optionally register quorum agents
allowed-tools:
  - Bash
  - Read
  - AskUserQuestion
---

<objective>
Discover a local Canopy IDE installation, import its agent and MCP configuration into nForma, and optionally register nForma's quorum agents back into Canopy's user agent registry. All writes require explicit user confirmation.

Three phases:
1. **Discover** — detect Canopy install, read config, display summary
2. **Import** (Path A) — write Canopy's MCP endpoint and agent info into `~/.claude/nf.json`
3. **Register** (Path B, optional) — write nForma quorum agents into Canopy's `userAgentRegistry`
</objective>

<process>

## Step 1: Discover Canopy installation

Run this Bash command and store the output as CANOPY_INFO:

```bash
CANOPY_INFO=$(node << 'NF_EVAL'
const fs = require('fs');
const path = require('path');
const os = require('os');

const platform = process.platform;
let configPath;
if (platform === 'darwin') {
  configPath = path.join(os.homedir(), 'Library', 'Application Support', 'canopy-app', 'config.json');
} else if (platform === 'win32') {
  configPath = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'canopy-app', 'config.json');
} else {
  configPath = path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'canopy-app', 'config.json');
}

const mcpPath = path.join(os.homedir(), '.canopy', 'mcp.json');
const pluginsDir = path.join(os.homedir(), '.canopy', 'plugins');

const result = {
  platform,
  configPath,
  configExists: false,
  mcpPath,
  mcpExists: false,
  pluginsDir,
  pluginsDirExists: false,
  mcp: null,
  agents: [],
  userAgents: [],
  agentSettings: {}
};

// Check config.json
try {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  result.configExists = true;

  // Extract built-in agent settings
  if (config.agentSettings && config.agentSettings.agents) {
    result.agentSettings = config.agentSettings.agents;
    result.agents = Object.keys(config.agentSettings.agents);
  }

  // Extract user-defined agents
  if (config.userAgentRegistry) {
    result.userAgents = Object.keys(config.userAgentRegistry);
  }
} catch (e) {
  // config.json not found or unreadable
}

// Check mcp.json
try {
  const mcp = JSON.parse(fs.readFileSync(mcpPath, 'utf8'));
  result.mcpExists = true;
  if (mcp.mcpServers && mcp.mcpServers.canopy) {
    result.mcp = mcp.mcpServers.canopy;
  }
} catch (e) {
  // mcp.json not found
}

// Check plugins dir
try {
  result.pluginsDirExists = fs.statSync(pluginsDir).isDirectory();
} catch (e) {}

process.stdout.write(JSON.stringify(result) + '\n');
NF_EVAL
)
```

Parse CANOPY_INFO JSON.

**If `configExists` is false:**

Display:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 nForma ► LINK CANOPY — NOT FOUND
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Canopy config not found at:
  {configPath}

Install Canopy IDE and run it once to generate config,
then re-run /nf:link-canopy.
```

Stop.

**If `configExists` is true:**

Display discovery banner:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 nForma ► LINK CANOPY — DISCOVERED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Platform:      {platform}
  Config:        {configPath}
  MCP Server:    {mcp.url or "not configured"}
  Plugins Dir:   {pluginsDir} ({pluginsDirExists ? "exists" : "not created yet"})

  Built-in Agents ({agents.length}):
    {comma-separated list of agent names from agents array}

  User Agents ({userAgents.length}):
    {comma-separated list or "none"}
```

Continue to Step 2.

---

## Step 2: Import Canopy config into nForma (Path A)

Use AskUserQuestion:
- header: "Import Canopy Config"
- question: "Import Canopy's MCP endpoint and agent configuration into nForma?\n\nThis writes a `canopy` section to ~/.claude/nf.json with the MCP URL and discovered agents. nForma commands will become Canopy-aware."
- options:
  - "Import — write to nf.json"
  - "Skip — do not import"

**If "Skip":** display "Import skipped." Continue to Step 3.

**If "Import":**

### Step 2a: Backup nf.json

```bash
cp ~/.claude/nf.json ~/.claude/nf.json.backup-$(date +%Y-%m-%d-%H%M%S) 2>/dev/null || true
```

### Step 2b: Write canopy section to nf.json

Pass all values via environment variables — never interpolate into the script body:

```bash
IMPORT_RESULT=$(node << 'NF_EVAL'
const fs = require('fs');
const path = require('path');
const os = require('os');

const nfPath = path.join(os.homedir(), '.claude', 'nf.json');
let nfCfg = {};
try { nfCfg = JSON.parse(fs.readFileSync(nfPath, 'utf8')); } catch(e) {}

const canopyInfo = JSON.parse(process.env.CANOPY_INFO);

nfCfg.canopy = {
  linked: true,
  linked_at: new Date().toISOString(),
  config_path: canopyInfo.configPath,
  mcp_url: canopyInfo.mcp ? canopyInfo.mcp.url : null,
  mcp_type: canopyInfo.mcp ? canopyInfo.mcp.type : null,
  agents: canopyInfo.agents,
  user_agents: canopyInfo.userAgents,
  plugins_dir: canopyInfo.pluginsDir
};

fs.writeFileSync(nfPath, JSON.stringify(nfCfg, null, 2) + '\n');
process.stdout.write(JSON.stringify({ written: true }) + '\n');
NF_EVAL
)
```

The `CANOPY_INFO` environment variable is the raw JSON output from Step 1.

Parse IMPORT_RESULT. If `written: true`:

```
✓ Canopy config imported into ~/.claude/nf.json

  MCP URL:    {mcp.url or "none"}
  Agents:     {agents list}
  User Agents: {userAgents list or "none"}
```

Continue to Step 3.

---

## Step 3: Register nForma agents in Canopy (Path B — optional)

### Step 3a: Read nForma quorum slots

```bash
QUORUM_SLOTS=$(node << 'NF_EVAL'
const fs = require('fs');
const path = require('path');
const os = require('os');

const claudeJsonPath = path.join(os.homedir(), '.claude.json');
let claudeJson = {};
try { claudeJson = JSON.parse(fs.readFileSync(claudeJsonPath, 'utf8')); } catch (e) {}
const servers = claudeJson.mcpServers || {};
const slots = [];
for (const [name, cfg] of Object.entries(servers)) {
  const env = cfg.env || {};
  slots.push({
    name,
    model: env.CLAUDE_DEFAULT_MODEL || 'unknown',
    provider: env.ANTHROPIC_BASE_URL || 'unknown',
    command: cfg.command || 'unknown'
  });
}
process.stdout.write(JSON.stringify({ slots, count: slots.length }) + '\n');
NF_EVAL
)
```

Parse QUORUM_SLOTS for `slots` array and `count`.

**If `count` is 0:**

Display:

```
No nForma quorum agents found in ~/.claude.json.
Run /nf:mcp-setup to configure agents first.
```

Continue to Step 4 (closing).

**If `count` > 0:**

Display the slots:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 nForma ► REGISTER AGENTS IN CANOPY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

nForma quorum agents found ({count}):

#   Slot              Model                       Provider
──  ────────────────  ──────────────────────────  ─────────────────────────────────────
{numbered table of slots}
```

Use AskUserQuestion:
- header: "Register in Canopy"
- question: "Register these nForma quorum agents in Canopy's user agent registry?\n\nThis writes to Canopy's config.json. Canopy will show these agents in its toolbar and agent palette. Requires Canopy restart to take effect."
- options:
  - "Register all — add all quorum agents to Canopy"
  - "Select — choose which agents to register"
  - "Skip — do not register"

**If "Skip":** display "Registration skipped." Continue to Step 4.

**If "Select":**

Use AskUserQuestion:
- header: "Select Agents"
- question: "Select agents to register (comma-separated numbers):"
- options: one option per slot: "{N} — {slot-name} ({model})"
  - Plus: "Cancel — back"

If "Cancel": display "Registration skipped." Continue to Step 4.

Otherwise: parse selected numbers, filter slots to only those selected. Continue to register flow below.

**If "Register all":** use all slots. Continue to register flow below.

### Step 3b: Confirm registration

Display pending summary:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 nForma ► REVIEW PENDING CHANGES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Will add to Canopy's userAgentRegistry:

  ◆ nf-{slot-name}  →  {model} via {provider}
  [repeat for each selected slot]

Target: {configPath}
```

Use AskUserQuestion:
- header: "Apply to Canopy"
- question: "Write these agents to Canopy's config.json?\n\nCanopy must be restarted for changes to take effect."
- options:
  - "Apply"
  - "Cancel — discard changes"

**If "Cancel":** display "Changes discarded." Continue to Step 4.

### Step 3c: Backup and write to Canopy config

**If "Apply":**

Backup Canopy config:

```bash
cp "$CANOPY_CONFIG_PATH" "${CANOPY_CONFIG_PATH}.backup-$(date +%Y-%m-%d-%H%M%S)" 2>/dev/null || true
```

Where `$CANOPY_CONFIG_PATH` is the `configPath` from Step 1.

Write user agents to Canopy's config. Pass slots and config path via env vars:

```bash
REGISTER_RESULT=$(node << 'NF_EVAL'
const fs = require('fs');

const configPath = process.env.CANOPY_CONFIG_PATH;
const selectedSlots = JSON.parse(process.env.SELECTED_SLOTS_JSON);

let config = {};
try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch(e) {
  process.stdout.write(JSON.stringify({ written: false, error: 'Cannot read Canopy config' }) + '\n');
  process.exit(1);
}

if (!config.userAgentRegistry) config.userAgentRegistry = {};

const registered = [];
for (const slot of selectedSlots) {
  const agentId = 'nf-' + slot.name;

  // Do not overwrite if already exists — user may have customized
  if (config.userAgentRegistry[agentId]) {
    registered.push({ id: agentId, status: 'skipped (already exists)' });
    continue;
  }

  config.userAgentRegistry[agentId] = {
    id: agentId,
    name: 'nForma: ' + slot.name,
    command: slot.command,
    color: '#6366f1',
    iconId: 'brain-circuit',
    supportsContextInjection: true,
    tooltip: 'nForma quorum agent — ' + slot.model
  };

  registered.push({ id: agentId, status: 'added' });
}

fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
process.stdout.write(JSON.stringify({ written: true, registered }) + '\n');
NF_EVAL
)
```

Parse REGISTER_RESULT. If `written: true`:

```
✓ Agents registered in Canopy

{for each registered entry:}
  {status === 'added' ? '✓' : '○'} {id} — {status}

⚠ Restart Canopy for changes to take effect.
```

Continue to Step 4.

---

## Step 4: Closing summary

Display:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 nForma ► LINK CANOPY — COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Import:   {imported ? "✓ Canopy config imported to nf.json" : "○ Skipped"}
  Register: {registered ? "✓ " + registeredCount + " agent(s) added to Canopy" : "○ Skipped"}

Re-run /nf:link-canopy any time to refresh the link.
```

</process>

<success_criteria>
- Canopy install detected via platform-specific config.json path (macOS/Windows/Linux)
- Discovery banner shows MCP URL, agents, user agents, plugins dir
- Not-found case handled gracefully with install instructions
- Import writes `canopy` section to ~/.claude/nf.json with MCP URL and agent list
- nf.json backup created before any write
- Registration writes to Canopy's userAgentRegistry with `nf-` prefixed agent IDs
- Canopy config.json backup created before any write
- Existing user agents in Canopy are never overwritten (skipped with notice)
- No changes applied without explicit user confirmation via AskUserQuestion
- All values passed via environment variables — never interpolated into script bodies
- Cross-platform: macOS (~/Library/Application Support), Windows (%APPDATA%), Linux (~/.config)
- Idempotent: safe to re-run — updates canopy section, skips existing agents
</success_criteria>

---
name: nf:mcp-restart
description: Restart a quorum agent's MCP server process — kills the running process and waits for Claude Code to reconnect automatically. Use "broken" to auto-detect and restart all non-responding agents.
argument-hint: "<agent|broken>"
allowed-tools:
  - Bash
  - mcp__codex-1__identity
  - mcp__gemini-1__identity
  - mcp__opencode-1__identity
  - mcp__copilot-1__identity
  - mcp__claude-1__identity
  - mcp__ccr-1__identity
  - mcp__ccr-2__identity
  - mcp__ccr-3__identity
  - mcp__ccr-4__identity
  - mcp__ccr-5__identity
  - mcp__ccr-6__identity
---

<objective>
Restart a named quorum agent's MCP server process. Reads `~/.claude.json` to identify the running process, kills it, and waits for Claude Code to automatically reconnect. Claude Code manages MCP server lifecycles — when a child process dies, Claude Code restarts it automatically. After killing the process, this command waits 2 seconds and calls the agent's identity tool to confirm reconnection.

Special argument `"broken"`: probes all configured agents via their identity tools, collects the ones that fail or don't respond, and restarts them all sequentially.
</objective>

<process>

## Step 1 — Parse arguments

Parse `$ARGUMENTS` as one token: `$AGENT`.

If `$AGENT` is missing, print usage and stop:
```
Usage: /nf:mcp-restart <agent|broken>

  broken   — probe all agents and restart any that are not responding

Valid agents (read from ~/.claude.json):
```
Then run:
```bash
node << 'NF_EVAL'
const fs=require('fs'),os=require('os'),path=require('path');
const SKIP=['canopy','sentry'];
try {
  const cfg=JSON.parse(fs.readFileSync(path.join(os.homedir(),'.claude.json'),'utf8'));
  const slots=Object.keys(cfg.mcpServers||{}).filter(s=>!SKIP.includes(s));
  console.log('  '+slots.join('  '));
} catch(e) { console.log('  (cannot read ~/.claude.json)'); }
NF_EVAL
```
Stop.

If `$AGENT` is `"broken"`, jump to **[Broken Mode]** below.

## Step 2 — Validate agent name

Run this to get valid slots:
```bash
node << 'NF_EVAL'
const fs=require('fs'),os=require('os'),path=require('path');
const SKIP=['canopy','sentry'];
try {
  const cfg=JSON.parse(fs.readFileSync(path.join(os.homedir(),'.claude.json'),'utf8'));
  const slots=Object.keys(cfg.mcpServers||{}).filter(s=>!SKIP.includes(s));
  console.log(JSON.stringify(slots));
} catch(e) { console.log('[]'); }
NF_EVAL
```

Parse output as `$VALID_SLOTS`. If `$AGENT` is not in `$VALID_SLOTS`, print error and stop:
```
Error: Unknown agent "$AGENT"

Valid agents: <$VALID_SLOTS joined with spaces>
```

## Step 3 — Read process identity from ~/.claude.json

```bash
AGENT="$AGENT" node << 'NF_EVAL'
const fs=require('fs'),path=require('path'),os=require('os');
const claudeJsonPath=path.join(os.homedir(),'.claude.json');
let claudeJson;
try { claudeJson=JSON.parse(fs.readFileSync(claudeJsonPath,'utf8')); }
catch(e) { process.stderr.write('Error: Cannot read ~/.claude.json: '+e.message+'\n'); process.exit(1); }
const servers=claudeJson.mcpServers||{};
const agent=process.env.AGENT;
const serverConfig=servers[agent];
if(!serverConfig){ process.stderr.write('Error: Agent "'+agent+'" is not configured in ~/.claude.json mcpServers\n'); process.exit(2); }
const command=serverConfig.command;
const args=serverConfig.args||[];
let result;
if(command==='node'&&args.length>0){
  result={type:'local',processPath:args[0]};
} else if(command==='npx'||command==='npm'){
  const packageName=args[args.length-1];
  result={type:'npx',packageName};
} else {
  result={type:'unknown',command};
}
process.stdout.write(JSON.stringify(result)+'\n');
NF_EVAL
```

Store output as `$PROCESS_INFO`.

If exit code 1 or 2: print the error message and stop.
If exit code 0: parse `$PROCESS_INFO` JSON.

## Step 4 — Kill the MCP server process

Based on the `type` field from `$PROCESS_INFO`:

**type = "local":**

Kill all node processes whose argv path matches the server path:
```bash
pkill -f "$PROCESS_PATH" 2>/dev/null || true
```
where `$PROCESS_PATH` is `process_info.processPath`.

Print: `Sending SIGTERM to processes matching: $PROCESS_PATH`

**type = "npx":**

Kill both the npm exec parent and the node child subprocess:
```bash
pkill -f "npm exec $PACKAGE_NAME" 2>/dev/null || true
sleep 0.5
pkill -f "$PACKAGE_NAME" 2>/dev/null || true
```
where `$PACKAGE_NAME` is `process_info.packageName`.

Print: `Sending SIGTERM to npm exec + node processes for: $PACKAGE_NAME`

**type = "unknown":**
Print:
```
Warning: Cannot determine process pattern for $AGENT (command: <command>).
Cannot restart automatically. Restart Claude Code session to reload this agent.
```
Stop.

## Step 5 — Wait for reconnection

Wait 2 seconds:
```bash
sleep 2
```

Print: `Waiting for Claude Code to reconnect...`

## Step 6 — Verify reconnection via identity tool

Call the identity tool for `$AGENT` — one sequential call:

`mcp__<$AGENT>__identity`

(Replace hyphens in the agent name with hyphens as-is: `codex-1` → `mcp__codex-1__identity`)

**If identity tool returns successfully:**
Parse response. Print:
```
Agent $AGENT restarted and responding

  Name:    <name from identity>
  Version: <version from identity>
  Model:   <model from identity>
```

**If identity tool errors or times out:**
Print:
```
Processes killed. Claude Code is reconnecting to $AGENT.
Check status in a few seconds: /nf:mcp-status
```

---

## [Broken Mode] — Detect and restart all non-responding agents

**BM-1. Get all configured agent slots:**

```bash
node << 'NF_EVAL'
const fs=require('fs'),os=require('os'),path=require('path');
const SKIP=['canopy','sentry'];
try {
  const cfg=JSON.parse(fs.readFileSync(path.join(os.homedir(),'.claude.json'),'utf8'));
  const slots=Object.keys(cfg.mcpServers||{}).filter(s=>!SKIP.includes(s));
  console.log(JSON.stringify(slots));
} catch(e) { console.log('[]'); }
NF_EVAL
```

Store as `$ALL_SLOTS`.

Print:
```
Broken mode — probing <N> agents for identity response...
```

**BM-2. Probe each agent sequentially:**

For each slot in `$ALL_SLOTS`, call its identity tool:

`mcp__<slot>__identity`

Record result as one of:
- `ok` — identity tool returned successfully
- `broken` — tool call errored, timed out, or tool is not available in this session

Build `$BROKEN_SLOTS` list (slots that returned `broken`).

Print probe summary table:
```
  codex-1     ✓ ok
  gemini-1    ✓ ok
  ccr-1       ✗ broken
  ccr-2       ✗ broken
  ...
```

If `$BROKEN_SLOTS` is empty:
```
All agents healthy — nothing to restart.
```
Stop.

**BM-3. Confirm before restarting (if shared process detected):**

Check if any broken slot shares a `processPath` with a healthy slot by running:

```bash
node << 'NF_EVAL'
const fs=require('fs'),path=require('path'),os=require('os');
const cfg=JSON.parse(fs.readFileSync(path.join(os.homedir(),'.claude.json'),'utf8'));
const servers=cfg.mcpServers||{};
const results={};
for(const [name,srv] of Object.entries(servers)){
  const args=srv.args||[];
  if(srv.command==='node'&&args.length>0) results[name]=args[0];
  else if(srv.command==='npx'||srv.command==='npm') results[name]=args[args.length-1];
}
process.stdout.write(JSON.stringify(results)+'\n');
NF_EVAL
```

If any broken slot shares a process path/package with a healthy slot, print a warning:
```
Warning: <broken-slot> shares its process with <healthy-slot>.
Killing it will briefly interrupt <healthy-slot> too (Claude Code will reconnect automatically).
```

**BM-4. Restart broken slots sequentially:**

For each slot in `$BROKEN_SLOTS`, run Steps 3–6 above (read config → kill → wait → verify), treating `$AGENT` as the current slot.

**BM-5. Print final summary:**

```
━━━ RESTART SUMMARY ━━━

  Restarted:  <N> slot(s) — <slot names>
  Responding: <list of slots confirmed via identity>
  Pending:    <list of slots that didn't respond yet — check /nf:mcp-status>
```

</process>

---
name: qgsd:mcp-status
description: Show status of all connected quorum agents — provider, model, health, and latency
allowed-tools:
  - Read
  - Bash
  - mcp__codex-1__identity
  - mcp__gemini-1__identity
  - mcp__opencode-1__identity
  - mcp__copilot-1__identity
  - mcp__claude-1__identity
  - mcp__claude-2__identity
  - mcp__claude-3__identity
  - mcp__claude-4__identity
  - mcp__claude-5__identity
  - mcp__claude-6__identity
  - mcp__claude-1__health_check
  - mcp__claude-2__health_check
  - mcp__claude-3__health_check
  - mcp__claude-4__health_check
  - mcp__claude-5__health_check
  - mcp__claude-6__health_check
---

<objective>
Display a clean status table of all connected MCP quorum agents. For CLI agents (codex-1, gemini-1, opencode-1, copilot-1): call their identity tool to confirm they are running. For HTTP agents (claude-1..6): call their identity tool then health_check for real-time endpoint health. Read provider URLs from ~/.claude.json.

This command is read-only (observation only). It does NOT invoke quorum and is NOT in quorum_commands.
</objective>

<process>

> **IMPORTANT: Run every Bash call in this workflow sequentially (one at a time). Never issue two Bash calls in parallel. A failure in one parallel sibling cancels all other parallel siblings — sequential execution isolates failures. For each numbered step below: run this Bash command alone, wait for its full output, store the result, then proceed to the next step.**

## Step 1: Read scoreboard + provider URLs (run this Bash command first, wait for output before proceeding to Step 2)

Run the following Bash command and store the output as INIT_INFO:

```bash
node << 'EOF'
const fs=require('fs'), path=require('path'), os=require('os');

// Scoreboard
const sbPath=path.join(process.cwd(),'.planning','quorum-scoreboard.json');
let totalRounds=0, lastUpdate=null;
if(fs.existsSync(sbPath)){
  const d=JSON.parse(fs.readFileSync(sbPath,'utf8'));
  totalRounds=(d.rounds||[]).length;
  lastUpdate=d.team?.captured_at||null;
}

// Provider URLs from ~/.claude.json
const URL_MAP={
  'https://api.akashml.com/v1':           'AkashML',
  'https://api.together.xyz/v1':          'Together.xyz',
  'https://api.fireworks.ai/inference/v1':'Fireworks',
};
const cfgPath=path.join(os.homedir(),'.claude.json');
const providers={};
if(fs.existsSync(cfgPath)){
  const cfg=JSON.parse(fs.readFileSync(cfgPath,'utf8'));
  for(const [key,val] of Object.entries(cfg.mcpServers||{})){
    const url=(val.env||{}).ANTHROPIC_BASE_URL||null;
    providers[key]=url?URL_MAP[url]||url:null;
  }
}

console.log(JSON.stringify({totalRounds,lastUpdate,providers}));
EOF
```

Parse `totalRounds`, `lastUpdate`, and `providers` (map of slot → provider name or null).

**Provider for CLI agents** — infer from model name when `providers[slot]` is null:
- `gpt-*` or `o[0-9]*` → OpenAI
- `gemini-*` → Google
- `claude-*` → Anthropic
- `opencode*` → OpenCode
- default → —

**Auth type** — read from identity response `auth_type` field if present. If absent, infer:
- CLI agents (codex-1, gemini-1, opencode-1, copilot-1) → `sub` (subscription — flat fee, no per-token cost)
- HTTP agents (claude-1..6) → `api` (API token — pay per request)

Display as `sub` or `api` in the Auth column.

## Step 2: Display banner (run this Bash command second, after Step 1 output is stored; wait for output before proceeding to Step 3)

Print:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► MCP STATUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Querying 4 CLI agents + 6 HTTP providers...
```

## Step 3: Collect identity + health_check results via sub-agent (run after Step 2 output is stored)

Invoke a Task() sub-agent to call all MCP tools. This prevents raw tool-result blocks from appearing in the main conversation.

```
Task(
  subagent_type: "general-purpose",
  model: "claude-haiku-4-5",
  prompt: """
You are a data-collection sub-agent. Your only job is to call the MCP tools listed below and return their results as a single JSON object. Do not explain or summarize — return only the JSON object.

Call each tool with {} as input. Wrap every call in try/catch — if a tool throws or is unavailable, record null for that field.

Tools to call in this order (call them one at a time, sequentially — never parallel):

1. mcp__codex-1__identity          — store result as codex_id
2. mcp__gemini-1__identity         — store result as gemini_id
3. mcp__opencode-1__identity       — store result as opencode_id
4. mcp__copilot-1__identity        — store result as copilot_id
5. mcp__claude-1__identity         — store result as claude1_id
6. mcp__claude-1__health_check     — store result as claude1_hc
7. mcp__claude-2__identity         — store result as claude2_id
8. mcp__claude-2__health_check     — store result as claude2_hc
9. mcp__claude-3__identity         — store result as claude3_id
10. mcp__claude-3__health_check    — store result as claude3_hc
11. mcp__claude-4__identity        — store result as claude4_id
12. mcp__claude-4__health_check    — store result as claude4_hc
13. mcp__claude-5__identity        — store result as claude5_id
14. mcp__claude-5__health_check    — store result as claude5_hc
15. mcp__claude-6__identity        — store result as claude6_id
16. mcp__claude-6__health_check    — store result as claude6_hc

Return ONLY this JSON structure (no markdown, no explanation):
{
  "codex-1":    { "identity": <codex_id or null>,    "hc": null },
  "gemini-1":   { "identity": <gemini_id or null>,   "hc": null },
  "opencode-1": { "identity": <opencode_id or null>, "hc": null },
  "copilot-1":  { "identity": <copilot_id or null>,  "hc": null },
  "claude-1":   { "identity": <claude1_id or null>,  "hc": <claude1_hc or null> },
  "claude-2":   { "identity": <claude2_id or null>,  "hc": <claude2_hc or null> },
  "claude-3":   { "identity": <claude3_id or null>,  "hc": <claude3_hc or null> },
  "claude-4":   { "identity": <claude4_id or null>,  "hc": <claude4_hc or null> },
  "claude-5":   { "identity": <claude5_id or null>,  "hc": <claude5_hc or null> },
  "claude-6":   { "identity": <claude6_id or null>,  "hc": <claude6_hc or null> }
}

Where each identity value is the raw object returned by the tool (with at minimum `version` and `model` fields), and each hc value is the raw object returned by health_check (with `healthy`, `latencyMs`, and optionally `model`, `via` fields).
"""
)
```

Store the sub-agent's returned JSON object as AGENT_RESULTS (parse from the sub-agent's text output).

For each slot in AGENT_RESULTS:
- `identity` = the identity result (or null if the sub-agent recorded null)
- `hc` = the health_check result (or null)

Use these values in Step 4 exactly as before — the shape is identical to what the old direct tool calls returned.

## Step 4: Derive health state per agent

**For CLI agents — identity-based (not scoreboard-based):**
- If identity call threw an exception → health = `error`, latency = `—`
- Else → health = `available`, latency = `—`

**For HTTP agents (claude-1 through claude-6) — live health_check result:**
- If identity call threw an exception → health = `error`, latency = `—`
- Else if `hc` is null (health_check threw or timed out) → health = `unreachable`, latency = `—`
- Else if `hc.healthy === false` → health = `unhealthy`, latency = `${hc.latencyMs}ms`
- Else if `hc.via === 'fallback'` → health = `fallback`, latency = `${hc.latencyMs}ms`
- Else → health = `available`, latency = `${hc.latencyMs}ms`

When `hc.via === 'fallback'`, the displayed Model should be `hc.model` (the fallback model) rather than the primary model from identity, since that's what actually responded.

## Step 5: Render formatted table

Collect all results then render **one table** via a single Bash call (do not print rows one at a time). Pass the collected data as a JSON string into the script.

Columns: **Agent | Auth | Provider | Model | Health | Latency**

Auto-size each column to the widest value (including header). Use box-drawing characters for borders.

Example output format:

```
┌────────────┬──────┬──────────────┬───────────────────────────────────────────────────┬────────────────┬─────────┐
│ Agent      │ Auth │ Provider     │ Model                                             │ Health         │ Latency │
├────────────┼──────┼──────────────┼───────────────────────────────────────────────────┼────────────────┼─────────┤
│ codex-1    │ sub  │ OpenAI       │ gpt-5.3-codex                                     │ available      │ —       │
│ gemini-1   │ sub  │ Google       │ gemini-3-pro-preview                              │ available      │ —       │
│ opencode-1 │ sub  │ OpenCode     │ opencode-managed                                  │ available      │ —       │
│ copilot-1  │ sub  │ OpenAI       │ gpt-4.1                                           │ available      │ —       │
│ claude-1   │ api  │ AkashML      │ deepseek-ai/DeepSeek-V3.2                         │ available      │ 686ms   │
│ claude-2   │ api  │ AkashML      │ MiniMaxAI/MiniMax-M2.5                            │ available      │ 735ms   │
│ claude-3   │ api  │ Together.xyz │ Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8           │ available      │ 761ms   │
│ claude-4   │ api  │ Fireworks    │ accounts/fireworks/models/kimi-k2p5               │ available      │ 1828ms  │
│ claude-5   │ api  │ Together.xyz │ meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8 │ available      │ 20601ms │
│ claude-6   │ api  │ Fireworks    │ accounts/fireworks/models/glm-5                   │ fallback       │ 312ms   │
└────────────┴──────┴──────────────┴───────────────────────────────────────────────────┴────────────────┴─────────┘

Scoreboard: 156 rounds recorded | Last update: 2026-02-23T14:23:52.301Z
```

If scoreboard file was absent, show instead:
```
Scoreboard: no data yet (run /qgsd:quorum first to populate)
```

Health legend:
- `available`   — agent responded (identity succeeded; for HTTP: health_check passed)
- `fallback`    — primary endpoint failed; fallback provider (ANTHROPIC_FALLBACK_BASE_URL) responded successfully
- `unhealthy`   — HTTP endpoint returned healthy=false
- `unreachable` — HTTP health_check call failed (timeout, connection error)
- `error`       — identity call failed (agent not running or crashed)

</process>

<success_criteria>
- All 10 agents shown in one clean table
- Columns: Agent | Auth | Provider | Model | Health | Latency (no UNAVAIL column)
- Provider derived from ~/.claude.json ANTHROPIC_BASE_URL for HTTP agents; inferred from model name for CLI agents
- Health for CLI agents reflects identity call success (available/error)
- Health for claude-1..6 is live from health_check result; `fallback` shown when primary failed but fallback responded
- Model column shows fallback model name (hc.model) when via=fallback, so it always reflects what actually served the check
- Latency shows ms for HTTP agents, — for CLI agents
- Command handles missing scoreboard gracefully (no crash)
- Command handles individual agent failures gracefully (no crash)
- Table rendered in a single Bash call at the end, not printed row-by-row
</success_criteria>

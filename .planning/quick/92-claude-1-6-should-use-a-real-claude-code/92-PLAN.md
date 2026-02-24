---
phase: quick-92
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/providers.json
  - ~/.claude.json
autonomous: false
requirements: [QUICK-92]

must_haves:
  truths:
    - "claude-1..6 slots each spawn a real claude CLI subprocess (not HTTP REST call) when invoked"
    - "Each slot's subprocess inherits ANTHROPIC_BASE_URL pointing to its assigned provider (akashml/together/fireworks)"
    - "Each slot's subprocess inherits ANTHROPIC_API_KEY and ANTHROPIC_MODEL for the correct backend model"
    - "health_check on any claude-1..6 slot returns { healthy: true, latencyMs, type: 'subprocess' } via --version probe"
    - "Quorum tool calls that invoke mcp__claude-N__claude dispatch to a real Claude Code reasoning agent"
  artifacts:
    - path: "bin/providers.json"
      provides: "claude-1..6 provider configs as type: subprocess with env blocks"
      contains: "\"type\": \"subprocess\""
    - path: "~/.claude.json"
      provides: "MCP server entries for claude-1..6 simplified to run unified-mcp-server without old HTTP env vars"
  key_links:
    - from: "unified-mcp-server.mjs handleSlotToolCall()"
      to: "runProvider() subprocess path"
      via: "slotProvider.type === 'subprocess' check at line 528"
      pattern: "slotProvider.type.*subprocess"
    - from: "providers.json claude-N entry"
      to: "claude CLI /opt/homebrew/bin/claude"
      via: "env.ANTHROPIC_BASE_URL + env.ANTHROPIC_MODEL inherited by spawned process"
      pattern: "ANTHROPIC_BASE_URL.*api\\.(akashml|together|fireworks)"
---

<objective>
Convert claude-1..6 slots from HTTP REST shims to real Claude Code CLI subprocesses, each pointed at a different alternative provider via ANTHROPIC_BASE_URL.

Purpose: Real claude CLI brings full Claude Code reasoning, tool use, and coding agent capability rather than plain-text chat completions. The backend stays OpenAI-compatible (akashml/together/fireworks), but the client is the actual Claude Code binary.

Output:
- bin/providers.json: claude-1..6 changed from type:http to type:subprocess with env blocks carrying ANTHROPIC_BASE_URL, ANTHROPIC_API_KEY, ANTHROPIC_MODEL
- ~/.claude.json: claude-1..6 MCP entries simplified (remove now-redundant HTTP env vars; keep only PROVIDER_SLOT)
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

Key architecture facts:
- unified-mcp-server.mjs dispatches based on slotProvider.type: 'subprocess' runs CLI via spawn(), 'http' calls REST
- subprocess providers use: cli, args_template, env, health_check_args, mainTool fields
- claude CLI at /opt/homebrew/bin/claude accepts: -p (non-interactive), --model, --dangerously-skip-permissions
- claude CLI respects env vars: ANTHROPIC_BASE_URL (base URL), ANTHROPIC_MODEL (model name), ANTHROPIC_API_KEY
- Provider assignments:
  - claude-1 (akashml): model deepseek-ai/DeepSeek-V3.2, key akml-NodRYQ-I4AoG1kDwtTVWBbGd1qbC5KbA
  - claude-2 (akashml): model MiniMaxAI/MiniMax-M2.5, same key
  - claude-3 (together): model Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8, key tgp_v1_WsoeKW05FB7ymwK7hjJrMKRgR0FB3UId-_etMVp7InE
  - claude-4 (fireworks): model accounts/fireworks/models/kimi-k2p5, key REDACTED_FIREWORKS_KEY
  - claude-5 (together): model meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8, same together key
  - claude-6 (fireworks): model accounts/fireworks/models/glm-5, same fireworks key
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update providers.json claude-1..6 from http to subprocess</name>
  <files>/Users/jonathanborduas/code/QGSD/bin/providers.json</files>
  <action>
Read bin/providers.json. Replace the 6 http-type claude-N entries with subprocess-type entries.

For each claude-N entry, use this structure:

```json
{
  "name": "claude-1",
  "type": "subprocess",
  "description": "DeepSeek-V3.2 via AkashML — real Claude Code CLI",
  "mainTool": "claude",
  "model": "deepseek-ai/DeepSeek-V3.2",
  "display_provider": "AkashML",
  "cli": "/opt/homebrew/bin/claude",
  "args_template": ["-p", "{prompt}", "--dangerously-skip-permissions"],
  "health_check_args": ["--version"],
  "helpArgs": ["--help"],
  "extraTools": [],
  "timeout_ms": 120000,
  "quorum_timeout_ms": 30000,
  "env": {
    "ANTHROPIC_BASE_URL": "https://api.akashml.com/v1",
    "ANTHROPIC_API_KEY": "akml-NodRYQ-I4AoG1kDwtTVWBbGd1qbC5KbA",
    "ANTHROPIC_MODEL": "deepseek-ai/DeepSeek-V3.2"
  }
}
```

Apply this pattern for each slot with the correct provider values:

- claude-1: AkashML, ANTHROPIC_BASE_URL=https://api.akashml.com/v1, ANTHROPIC_API_KEY=akml-NodRYQ-I4AoG1kDwtTVWBbGd1qbC5KbA, ANTHROPIC_MODEL=deepseek-ai/DeepSeek-V3.2, quorum_timeout_ms=20000
- claude-2: AkashML, ANTHROPIC_BASE_URL=https://api.akashml.com/v1, ANTHROPIC_API_KEY=akml-NodRYQ-I4AoG1kDwtTVWBbGd1qbC5KbA, ANTHROPIC_MODEL=MiniMaxAI/MiniMax-M2.5, quorum_timeout_ms=20000
- claude-3: Together.xyz, ANTHROPIC_BASE_URL=https://api.together.xyz/v1, ANTHROPIC_API_KEY=tgp_v1_WsoeKW05FB7ymwK7hjJrMKRgR0FB3UId-_etMVp7InE, ANTHROPIC_MODEL=Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8, quorum_timeout_ms=30000
- claude-4: Fireworks, ANTHROPIC_BASE_URL=https://api.fireworks.ai/inference/v1, ANTHROPIC_API_KEY=REDACTED_FIREWORKS_KEY, ANTHROPIC_MODEL=accounts/fireworks/models/kimi-k2p5, quorum_timeout_ms=30000
- claude-5: Together.xyz, ANTHROPIC_BASE_URL=https://api.together.xyz/v1, ANTHROPIC_API_KEY=tgp_v1_WsoeKW05FB7ymwK7hjJrMKRgR0FB3UId-_etMVp7InE, ANTHROPIC_MODEL=meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8, quorum_timeout_ms=10000
- claude-6: Fireworks, ANTHROPIC_BASE_URL=https://api.fireworks.ai/inference/v1, ANTHROPIC_API_KEY=REDACTED_FIREWORKS_KEY, ANTHROPIC_MODEL=accounts/fireworks/models/glm-5, quorum_timeout_ms=8000

Keep all other providers (codex-1, codex-2, gemini-1, gemini-2, opencode-1, copilot-1) unchanged.

IMPORTANT: The mainTool for these subprocess entries is "claude" — this is the tool name exposed by unified-mcp-server in slot mode. The existing http type exposed a tool named "claude" too (see unified-mcp-server.mjs line 146: name: 'claude'), so the MCP tool name is preserved — no change needed in quorum orchestrator call sites.
  </action>
  <verify>
    node -e "const p = JSON.parse(require('fs').readFileSync('/Users/jonathanborduas/code/QGSD/bin/providers.json','utf8')).providers; const claudes = p.filter(x=>x.name.startsWith('claude-')); console.log(claudes.map(c=>c.name+': '+c.type+' '+c.env.ANTHROPIC_BASE_URL).join('\n'));"
  </verify>
  <done>
    All 6 claude-N entries show type: "subprocess" and each shows the correct ANTHROPIC_BASE_URL for its provider group (akashml for 1+2, together for 3+5, fireworks for 4+6).
  </done>
</task>

<task type="auto">
  <name>Task 2: Simplify ~/.claude.json claude-1..6 MCP entries</name>
  <files>~/.claude.json</files>
  <action>
Read ~/.claude.json. Update each of the claude-1..6 mcpServer entries.

Currently each entry has a large env block carrying ANTHROPIC_BASE_URL, ANTHROPIC_API_KEY, CLAUDE_DEFAULT_MODEL, CLAUDE_MCP_TIMEOUT_MS, etc. These were needed when unified-mcp-server ran as an HTTP shim reading env vars at MCP-server startup.

Now that providers.json carries the env vars for subprocess dispatch, the MCP server env block only needs PROVIDER_SLOT (to tell unified-mcp-server which provider to activate). All other vars are no longer needed at the MCP server process level.

Simplify each entry to:

```json
"claude-1": {
  "type": "stdio",
  "command": "node",
  "args": ["/Users/jonathanborduas/code/QGSD/bin/unified-mcp-server.mjs"],
  "env": {
    "PROVIDER_SLOT": "claude-1"
  }
}
```

Apply this pattern for claude-1 through claude-6 (each with its own PROVIDER_SLOT value).

Keep all other mcpServer entries (codex-1, gemini-1, opencode-1, copilot-1, unified-1) unchanged.

Write the updated ~/.claude.json back to disk.
  </action>
  <verify>
    node -e "const j = JSON.parse(require('fs').readFileSync('/Users/jonathanborduas/.claude.json','utf8')); ['claude-1','claude-2','claude-3','claude-4','claude-5','claude-6'].forEach(k=>{ const e=j.mcpServers[k].env; console.log(k+': keys='+Object.keys(e).join(',')); });"
  </verify>
  <done>
    Each claude-1..6 entry shows only "PROVIDER_SLOT" in its env block (no ANTHROPIC_BASE_URL, no CLAUDE_DEFAULT_MODEL at the MCP process level).
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Verify claude-1..6 dispatch real Claude Code CLI</name>
  <files>n/a</files>
  <action>Human verifies that claude-1..6 MCP slots respond via real /opt/homebrew/bin/claude subprocess after restarting Claude Code.</action>
  <verify>Call mcp__claude-1__health_check and confirm { healthy: true, type: 'subprocess' }; call mcp__claude-1__claude with a prompt and confirm a real response.</verify>
  <done>User types "approved" after confirming at least one claude-N slot returns a real response from the alternative-backend Claude Code agent.</done>
  <what-built>
    Claude-1..6 slots reconfigured as real Claude Code CLI subprocesses. providers.json updated (type: subprocess with ANTHROPIC_BASE_URL/MODEL env), ~/.claude.json simplified (PROVIDER_SLOT only).

    Restart Claude Code to reload the MCP servers before verifying.
  </what-built>
  <how-to-verify>
    1. Restart Claude Code to reload ~/.claude.json (Cmd+R or close/reopen)
    2. Run: /mcp to confirm claude-1..6 show as connected
    3. Run: /qgsd:mcp-status — verify claude-1..6 appear in the table
    4. Test a single slot: ask Claude to call mcp__claude-1__health_check — expect { healthy: true, type: 'subprocess' }
    5. Test a prompt: call mcp__claude-1__claude with prompt "What is 2+2?" — expect a real response (not HTTP error)
    6. If any slot returns "[spawn error" or "TIMED OUT" immediately, the ANTHROPIC_BASE_URL or API key may be wrong for that provider
  </how-to-verify>
  <resume-signal>Type "approved" if claude-1..6 respond via real claude CLI, or describe which slots have errors</resume-signal>
</task>

</tasks>

<verification>
- bin/providers.json: 6 claude-N entries all have type: "subprocess", cli: "/opt/homebrew/bin/claude", args_template includes "-p" and "--dangerously-skip-permissions", env block has ANTHROPIC_BASE_URL + ANTHROPIC_API_KEY + ANTHROPIC_MODEL
- ~/.claude.json: claude-1..6 MCP entries each have only PROVIDER_SLOT in env (no legacy HTTP vars)
- unified-mcp-server.mjs handles subprocess dispatch at line 528 (type === 'subprocess' → runProvider) — no changes needed to the server binary
- Tool name "claude" is preserved for subprocess mode (mainTool: "claude") — quorum orchestrator call sites unchanged
</verification>

<success_criteria>
- All 6 claude-N slots dispatch to real /opt/homebrew/bin/claude subprocess with ANTHROPIC_BASE_URL override
- health_check returns { healthy: true, type: 'subprocess' } (via --version probe)
- A prompt call returns a substantive response from the alternative-backend Claude Code agent
- No "HTTP request error" or "unexpected response shape" errors (those indicate lingering http-type dispatch)
</success_criteria>

<output>
After completion, create .planning/quick/92-claude-1-6-should-use-a-real-claude-code/92-SUMMARY.md
</output>

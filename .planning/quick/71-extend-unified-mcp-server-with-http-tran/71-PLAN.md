---
phase: quick-71
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/providers.json
  - bin/unified-mcp-server.mjs
  - agents/qgsd-quorum-orchestrator.md
autonomous: true
requirements: [QUICK-71]

must_haves:
  truths:
    - "unified-mcp-server exposes tools for codex-1, codex-2, gemini-1, gemini-2, opencode-1, copilot-1 (CLI roster)"
    - "unified-mcp-server exposes tools for deepseek-1, minimax-1, qwen-1, kimi-1, llama4-1, glm-1 via HTTP transport"
    - "HTTP providers make POST /chat/completions using Node.js built-in https module, no new npm deps"
    - "quorum orchestrator calls mcp__unified-1__<slot> for all providers (CLI + HTTP)"
    - "claude-1 through claude-6 entries kept in ~/.claude.json as fallback"
    - "install sync runs after agents/qgsd-quorum-orchestrator.md changes"
  artifacts:
    - path: "bin/providers.json"
      provides: "Roster of 12 providers: 6 CLI (indexed) + 6 HTTP"
      contains: "deepseek-1"
    - path: "bin/unified-mcp-server.mjs"
      provides: "HTTP transport alongside existing subprocess transport"
      contains: "runHttpProvider"
    - path: "agents/qgsd-quorum-orchestrator.md"
      provides: "Updated tool call patterns for unified-1 slot names"
      contains: "mcp__unified-1__codex-1"
  key_links:
    - from: "bin/unified-mcp-server.mjs"
      to: "providers.json type field"
      via: "provider.type === 'http' branch in dispatch"
      pattern: "type.*http"
    - from: "agents/qgsd-quorum-orchestrator.md"
      to: "mcp__unified-1__ tool names"
      via: "Step 2 identity capture and Mode A/B dispatch"
      pattern: "mcp__unified-1__"
---

<objective>
Extend unified-mcp-server with HTTP transport and roster support, then update the quorum
orchestrator to use the unified tool names.

Purpose: Consolidate all 10 quorum providers (4 CLI + 6 HTTP) into a single MCP server,
eliminating the 6 separate claude-mcp-server processes and enabling roster scaling for
CLI providers.

Output:
- providers.json with 12 providers (CLI roster x2 + 6 HTTP)
- unified-mcp-server.mjs with HTTP transport branch (no new npm deps)
- qgsd-quorum-orchestrator.md updated to call mcp__unified-1__<slot>
- Install sync applied so agents/qgsd-quorum-orchestrator.md is live in ~/.claude/agents/
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/jonathanborduas/code/QGSD/bin/unified-mcp-server.mjs
@/Users/jonathanborduas/code/QGSD/bin/providers.json
@/Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-orchestrator.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extend providers.json with CLI roster and HTTP providers</name>
  <files>bin/providers.json</files>
  <action>
Replace the entire contents of bin/providers.json with an expanded providers array:

**CLI providers** — rename existing single entries to indexed names and add a -2 variant
for codex and gemini (gives 2-slot roster; opencode and copilot keep single slot for now):

```json
{ "name": "codex-1",   "type": "subprocess", "description": "...", "cli": "/opt/homebrew/bin/codex",   "args_template": ["exec", "{prompt}"],           "timeout_ms": 300000, "env": {} }
{ "name": "codex-2",   "type": "subprocess", "description": "...", "cli": "/opt/homebrew/bin/codex",   "args_template": ["exec", "{prompt}"],           "timeout_ms": 300000, "env": {} }
{ "name": "gemini-1",  "type": "subprocess", "description": "...", "cli": "/opt/homebrew/bin/gemini",  "args_template": ["-p", "{prompt}"],             "timeout_ms": 300000, "env": {} }
{ "name": "gemini-2",  "type": "subprocess", "description": "...", "cli": "/opt/homebrew/bin/gemini",  "args_template": ["-p", "{prompt}"],             "timeout_ms": 300000, "env": {} }
{ "name": "opencode-1","type": "subprocess", "description": "...", "cli": "/opt/homebrew/bin/opencode", "args_template": ["run", "{prompt}"],            "timeout_ms": 300000, "env": {} }
{ "name": "copilot-1", "type": "subprocess", "description": "...", "cli": "/opt/homebrew/bin/copilot",  "args_template": ["-p", "{prompt}", "--yolo"],   "timeout_ms": 300000, "env": {} }
```

**HTTP providers** — one entry per former claude-mcp-server instance:

```json
{ "name": "deepseek-1", "type": "http", "baseUrl": "https://api.akashml.com/v1",         "model": "deepseek-ai/DeepSeek-V3.2",                           "apiKeyEnv": "AKASHML_API_KEY",    "timeout_ms": 120000 }
{ "name": "minimax-1",  "type": "http", "baseUrl": "https://api.akashml.com/v1",         "model": "MiniMaxAI/MiniMax-M2.5",                              "apiKeyEnv": "AKASHML_API_KEY",    "timeout_ms": 120000 }
{ "name": "qwen-1",     "type": "http", "baseUrl": "https://api.together.xyz/v1",        "model": "Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8",             "apiKeyEnv": "TOGETHER_API_KEY",   "timeout_ms": 120000 }
{ "name": "kimi-1",     "type": "http", "baseUrl": "https://api.fireworks.ai/inference/v1","model": "accounts/fireworks/models/kimi-k2p5",                 "apiKeyEnv": "FIREWORKS_API_KEY",  "timeout_ms": 120000 }
{ "name": "llama4-1",   "type": "http", "baseUrl": "https://api.together.xyz/v1",        "model": "meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8",   "apiKeyEnv": "TOGETHER_API_KEY",   "timeout_ms": 120000 }
{ "name": "glm-1",      "type": "http", "baseUrl": "https://api.fireworks.ai/inference/v1","model": "accounts/fireworks/models/glm-5",                     "apiKeyEnv": "FIREWORKS_API_KEY",  "timeout_ms": 120000 }
```

Preserve `description` field on all providers — use descriptive strings like
"Execute Codex CLI agent non-interactively" for CLI and "DeepSeek-V3.2 via AkashML HTTP API"
for HTTP providers.

The `type` field on existing CLI providers was previously absent — add `"type": "subprocess"`
explicitly to all CLI entries for consistency (the server code will check this field).
  </action>
  <verify>node -e "const d=JSON.parse(require('fs').readFileSync('/Users/jonathanborduas/code/QGSD/bin/providers.json','utf8')); console.log('count:', d.providers.length); d.providers.forEach(p=>console.log(p.name, p.type));"</verify>
  <done>12 providers listed (codex-1, codex-2, gemini-1, gemini-2, opencode-1, copilot-1, deepseek-1, minimax-1, qwen-1, kimi-1, llama4-1, glm-1), each with correct type field.</done>
</task>

<task type="auto">
  <name>Task 2: Add HTTP transport to unified-mcp-server.mjs</name>
  <files>bin/unified-mcp-server.mjs</files>
  <action>
Add a `runHttpProvider` function and branch the dispatch in `tools/call` handling.

**Add import** at the top (alongside existing imports):
```js
import https from 'https';
import http from 'http';
```

**Add `runHttpProvider` function** after the existing `runProvider` function:

```js
async function runHttpProvider(provider, toolArgs) {
  const prompt = toolArgs.prompt;
  const timeoutMs = toolArgs.timeout_ms ?? provider.timeout_ms ?? 120000;
  const apiKey = process.env[provider.apiKeyEnv] ?? '';

  const body = JSON.stringify({
    model: provider.model,
    messages: [{ role: 'user', content: prompt }],
    stream: false,
  });

  const url = new URL(provider.baseUrl + '/chat/completions');
  const isHttps = url.protocol === 'https:';
  const transport = isHttps ? https : http;

  const options = {
    hostname: url.hostname,
    port: url.port || (isHttps ? 443 : 80),
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'Content-Length': Buffer.byteLength(body),
    },
  };

  return new Promise((resolve) => {
    let timedOut = false;
    const req = transport.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (timedOut) return;
        try {
          const parsed = JSON.parse(data);
          const content = parsed?.choices?.[0]?.message?.content;
          if (content) {
            resolve(content);
          } else {
            resolve(`[HTTP error: unexpected response shape] ${data.slice(0, 500)}`);
          }
        } catch (e) {
          resolve(`[HTTP error: JSON parse failed] ${data.slice(0, 500)}`);
        }
      });
    });

    const timer = setTimeout(() => {
      timedOut = true;
      req.destroy();
      resolve(`[TIMED OUT after ${timeoutMs}ms]`);
    }, timeoutMs);

    req.on('error', (err) => {
      clearTimeout(timer);
      resolve(`[HTTP request error: ${err.message}]`);
    });

    req.on('close', () => clearTimeout(timer));

    req.write(body);
    req.end();
  });
}
```

**Update the dispatch in `handleRequest`** — replace the single `runProvider(provider, toolArgs)` call in the `tools/call` block with a branch:

```js
const output = provider.type === 'http'
  ? await runHttpProvider(provider, toolArgs)
  : await runProvider(provider, toolArgs);
```

The existing `runProvider` function uses `provider.args_template` which only applies to
subprocess providers — the `type === 'http'` check routes correctly without any changes to
the subprocess path. The `buildTools` function already works for all providers since it only
reads `name`, `description`, and `timeout_ms` — no change needed there.
  </action>
  <verify>node -e "import('/Users/jonathanborduas/code/QGSD/bin/unified-mcp-server.mjs').catch(e=>{ if(e.message.includes('stdin')) process.exit(0); console.error(e.message); process.exit(1); })" 2>&1 | head -5</verify>
  <done>
    - Server starts without syntax errors (stderr shows "[unified-mcp-server] started")
    - tools/list response includes all 12 tools
    - HTTP providers have type "http" in providers.json and server branches correctly
  </done>
</task>

<task type="auto">
  <name>Task 3: Update quorum orchestrator to use mcp__unified-1__ tool names + install sync</name>
  <files>
    agents/qgsd-quorum-orchestrator.md
  </files>
  <action>
Update `agents/qgsd-quorum-orchestrator.md` to call unified-1 tools instead of the
separate CLI MCP servers and claude-mcp instances.

**Step 2 — Team identity capture section:**

Replace the native CLI agent identity calls:
```
OLD:
1. `mcp__codex-cli-1__identity`
2. `mcp__gemini-cli-1__identity`
3. `mcp__opencode-1__identity`
4. `mcp__copilot-1__identity`

NEW:
1. `mcp__unified-1__codex-1` with prompt "identity"
2. `mcp__unified-1__gemini-1` with prompt "identity"
3. `mcp__unified-1__opencode-1` with prompt "identity"
4. `mcp__unified-1__copilot-1` with prompt "identity"
```

Also remove the "claude-mcp-server instances" block in Step 2 (the health_check loop) —
unified HTTP providers do not have a separate health_check tool. Replace it with: for each
HTTP provider slot in providers.json (deepseek-1, minimax-1, qwen-1, kimi-1, llama4-1, glm-1),
mark as participating (availability checked at call time via timeout guard rather than pre-flight).

**Mode A — Query models section:**

Update the "Call order" block to list all unified-1 tools:

```
Native CLI slots (call sequentially):
- `mcp__unified-1__codex-1`, `mcp__unified-1__codex-2`
- `mcp__unified-1__gemini-1`, `mcp__unified-1__gemini-2`
- `mcp__unified-1__opencode-1`
- `mcp__unified-1__copilot-1`

HTTP slots (call sequentially):
- `mcp__unified-1__deepseek-1`
- `mcp__unified-1__minimax-1`
- `mcp__unified-1__qwen-1`
- `mcp__unified-1__kimi-1`
- `mcp__unified-1__llama4-1`
- `mcp__unified-1__glm-1`
```

For all unified-1 tools, the field name is `prompt` (matching the unified-mcp-server
inputSchema). Remove the separate "Native CLI slots" vs "claude-mcp slots" distinction
— all go through unified-1 now.

Update the timeout guard note to reference `mcp__unified-1__<slotName>` rather than
`mcp__<serverName>__claude` or per-agent tool names.

**Mode B — Dispatch workers section:**

Update all Task dispatch calls to use unified-1:
```
OLD:
- Task(..., "Call mcp__gemini-cli-1__gemini with: ...")
- Task(..., "Call mcp__opencode-1__opencode with: ...")
- Task(..., "Call mcp__copilot-1__ask with: ...")
- Task(..., "Call mcp__codex-cli-1__review with: ...")
- Task(..., "Call mcp__<serverName>__claude with prompt=...")

NEW (all use unified-1 with prompt field):
- Task(..., "Call mcp__unified-1__gemini-1 with prompt=...")
- Task(..., "Call mcp__unified-1__opencode-1 with prompt=...")
- Task(..., "Call mcp__unified-1__copilot-1 with prompt=...")
- Task(..., "Call mcp__unified-1__codex-1 with prompt=...")
- Task(..., "Call mcp__unified-1__deepseek-1 with prompt=...")
- Task(..., "Call mcp__unified-1__minimax-1 with prompt=...")
- Task(..., "Call mcp__unified-1__qwen-1 with prompt=...")
- Task(..., "Call mcp__unified-1__kimi-1 with prompt=...")
- Task(..., "Call mcp__unified-1__llama4-1 with prompt=...")
- Task(..., "Call mcp__unified-1__glm-1 with prompt=...")
```

**Scoreboard update section:**

Scoreboard calls for HTTP providers: use `--slot <slotName>` (e.g. `deepseek-1`) and
`--model-id <fullModelId>` (same pattern as existing claude-mcp entries). For CLI providers,
continue using `--model <shortName>` (codex, gemini, opencode, copilot) — these map to the
existing scoreboard family keys.

**After editing agents/qgsd-quorum-orchestrator.md, run install sync:**

```bash
node /Users/jonathanborduas/code/QGSD/bin/install.js --claude --global
```

This copies updated agents/qgsd-quorum-orchestrator.md to ~/.claude/agents/.
  </action>
  <verify>
    grep -c "mcp__unified-1__" /Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-orchestrator.md
    grep "mcp__codex-cli-1\|mcp__gemini-cli-1\|mcp__opencode-1__opencode\|mcp__copilot-1__ask\|mcp__claude-" /Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-orchestrator.md | wc -l
    grep -c "mcp__unified-1__" /Users/jonathanborduas/.claude/agents/qgsd-quorum-orchestrator.md
  </verify>
  <done>
    - agents/qgsd-quorum-orchestrator.md has 10+ occurrences of "mcp__unified-1__"
    - Zero occurrences of old per-agent tool names (mcp__codex-cli-1__, mcp__gemini-cli-1__, mcp__opencode-1__opencode, mcp__copilot-1__ask, mcp__claude-)
    - ~/.claude/agents/qgsd-quorum-orchestrator.md matches source (install sync succeeded)
    - ~/.claude.json still has claude-1 through claude-6 entries (fallback preserved — no changes to ~/.claude.json)
  </done>
</task>

</tasks>

<verification>
```bash
# 1. Verify providers.json has 12 providers with correct types
node -e "
const d=JSON.parse(require('fs').readFileSync('/Users/jonathanborduas/code/QGSD/bin/providers.json','utf8'));
const cli = d.providers.filter(p=>p.type==='subprocess');
const http = d.providers.filter(p=>p.type==='http');
console.log('CLI:', cli.map(p=>p.name).join(', '));
console.log('HTTP:', http.map(p=>p.name).join(', '));
console.log('Total:', d.providers.length);
"

# 2. Verify unified-mcp-server loads and lists 12 tools
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","clientInfo":{"name":"test","version":"1"},"capabilities":{}}}
{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' | node /Users/jonathanborduas/code/QGSD/bin/unified-mcp-server.mjs 2>/dev/null | grep -c '"name"'

# 3. Verify quorum orchestrator references unified-1
grep "mcp__unified-1__" /Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-orchestrator.md | wc -l

# 4. Verify installed copy is updated
diff /Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-orchestrator.md /Users/jonathanborduas/.claude/agents/qgsd-quorum-orchestrator.md && echo "IN SYNC" || echo "DIFF"
```
</verification>

<success_criteria>
- providers.json: 12 entries — codex-1/2, gemini-1/2, opencode-1, copilot-1 (subprocess) + deepseek-1, minimax-1, qwen-1, kimi-1, llama4-1, glm-1 (http)
- unified-mcp-server.mjs: runHttpProvider() using Node.js built-in https module, dispatches on provider.type === 'http'
- Sending tools/list via stdin returns 12 tool definitions
- qgsd-quorum-orchestrator.md: all quorum calls reference mcp__unified-1__<slotName>
- ~/.claude/agents/qgsd-quorum-orchestrator.md is in sync with source (install ran)
- ~/.claude.json claude-1 through claude-6 entries untouched (fallback preserved)
- Zero new npm dependencies added
</success_criteria>

<output>
After completion, create `.planning/quick/71-extend-unified-mcp-server-with-http-tran/71-SUMMARY.md`
</output>

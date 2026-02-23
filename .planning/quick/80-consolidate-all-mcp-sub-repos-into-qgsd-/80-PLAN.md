---
phase: quick-80
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/providers.json
  - bin/unified-mcp-server.mjs
  - ~/.claude.json
autonomous: true
requirements: []

must_haves:
  truths:
    - "PROVIDER_SLOT=codex-1 node bin/unified-mcp-server.mjs starts and lists exactly: codex, review, help, ping, identity"
    - "PROVIDER_SLOT=claude-1 node bin/unified-mcp-server.mjs starts and lists exactly: claude, health_check, ping, identity"
    - "node bin/unified-mcp-server.mjs (no PROVIDER_SLOT) still lists all 12 unified provider tools unchanged"
    - "All 10 ~/.claude.json entries (codex-1, gemini-1, opencode-1, copilot-1, claude-1..6) point to QGSD unified-mcp-server.mjs with correct PROVIDER_SLOT"
    - "unified-1 entry in ~/.claude.json is untouched"
    - "No API keys removed or truncated from ~/.claude.json"
  artifacts:
    - path: "bin/providers.json"
      provides: "Per-provider mainTool, helpArgs, extraTools fields"
      contains: "mainTool"
    - path: "bin/unified-mcp-server.mjs"
      provides: "PROVIDER_SLOT mode dispatch + per-type tool implementations"
      contains: "PROVIDER_SLOT"
  key_links:
    - from: "unified-mcp-server.mjs PROVIDER_SLOT mode"
      to: "providers.json slotProvider"
      via: "providers.find(p => p.name === SLOT)"
      pattern: "PROVIDER_SLOT"
    - from: "~/.claude.json claude-1..6 env blocks"
      to: "unified-mcp-server.mjs runHttpProvider + runHealthCheck"
      via: "process.env.ANTHROPIC_BASE_URL / ANTHROPIC_API_KEY / CLAUDE_DEFAULT_MODEL"
      pattern: "ANTHROPIC_BASE_URL"
---

<objective>
Evolve `bin/unified-mcp-server.mjs` to support PROVIDER_SLOT mode, enabling it to replace all 5 external MCP sub-repos. Update `~/.claude.json` to point all 10 entries at the QGSD binary. No changes to quorum commands or tool names.

Purpose: One codebase for all MCP providers. Eliminates dependency on 5 separate repos that must be kept in sync.
Output: Extended unified-mcp-server.mjs + updated providers.json + updated ~/.claude.json
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/jonathanborduas/code/QGSD/.planning/STATE.md
@/Users/jonathanborduas/code/QGSD/bin/unified-mcp-server.mjs
@/Users/jonathanborduas/code/QGSD/bin/providers.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extend providers.json with per-provider slot metadata</name>
  <files>/Users/jonathanborduas/code/QGSD/bin/providers.json</files>
  <action>
Add three new fields to each provider entry in providers.json:

- `mainTool` (string): the primary tool name this slot exposes
- `helpArgs` (array): CLI args to invoke for the `help` tool (subprocess providers only)
- `extraTools` (array): additional tools beyond mainTool+help+ping+identity

Exact values per provider:

**codex-1 and codex-2:**
- mainTool: "codex"
- helpArgs: ["--help"]
- extraTools: [{ "name": "review", "description": "Review code changes via Codex", "args_template": ["review", "{prompt}"] }]

**gemini-1 and gemini-2:**
- mainTool: "gemini"
- helpArgs: ["--help"]
- extraTools: []

**opencode-1:**
- mainTool: "opencode"
- helpArgs: ["--help"]
- extraTools: [{ "name": "opencode_check_update", "description": "Check for OpenCode updates", "checkUpdate": true }]

**copilot-1:**
- mainTool: "ask"
- helpArgs: ["--help"]
- extraTools: [
    { "name": "suggest", "description": "Suggest a shell command", "args_template": ["suggest", "--shell", "--", "{prompt}"] },
    { "name": "explain", "description": "Explain a shell command", "args_template": ["explain", "--", "{prompt}"] }
  ]

**claude-1 through claude-6 (all HTTP type):**
- mainTool: "claude"
- (no helpArgs — HTTP providers have no CLI)
- extraTools: [] (health_check is built-in for HTTP type, not in extraTools)

All existing fields (name, type, description, cli, args_template, baseUrl, model, apiKeyEnv, timeout_ms, quorum_timeout_ms, env) remain unchanged.
  </action>
  <verify>node -e "const p=JSON.parse(require('fs').readFileSync('/Users/jonathanborduas/code/QGSD/bin/providers.json','utf8')).providers; p.forEach(x=>{ if(!x.mainTool) throw new Error('missing mainTool on '+x.name); }); console.log('OK:', p.map(x=>x.name+':'+x.mainTool).join(', '));"</verify>
  <done>All 12 provider entries have mainTool field. Subprocess providers have helpArgs. codex-1/2 have review in extraTools. copilot-1 has suggest+explain in extraTools. opencode-1 has opencode_check_update in extraTools.</done>
</task>

<task type="auto">
  <name>Task 2: Add PROVIDER_SLOT mode to unified-mcp-server.mjs</name>
  <files>/Users/jonathanborduas/code/QGSD/bin/unified-mcp-server.mjs</files>
  <action>
After the providers config is loaded (after line 25), add PROVIDER_SLOT detection:

```javascript
// ─── PROVIDER_SLOT mode ────────────────────────────────────────────────────────
const SLOT = process.env.PROVIDER_SLOT ?? null;
const slotProvider = SLOT ? providers.find(p => p.name === SLOT) : null;
if (SLOT && !slotProvider) {
  process.stderr.write(`[unified-mcp-server] Unknown PROVIDER_SLOT: ${SLOT}\n`);
  process.exit(1);
}
```

Add a `runHealthCheck(provider)` function after `runHttpProvider`:

```javascript
async function runHealthCheck(provider) {
  const baseUrl = (process.env.ANTHROPIC_BASE_URL ?? provider.baseUrl).replace(/\/$/, '');
  const apiKey = process.env.ANTHROPIC_API_KEY ?? process.env[provider.apiKeyEnv] ?? '';
  const model = process.env.CLAUDE_DEFAULT_MODEL ?? provider.model;
  const timeoutMs = parseInt(process.env.CLAUDE_MCP_HEALTH_TIMEOUT_MS ?? '30000');

  const body = JSON.stringify({
    model,
    messages: [{ role: 'user', content: 'ping' }],
    max_tokens: 1,
    stream: false,
  });

  const url = new URL(baseUrl + '/chat/completions');
  const isHttps = url.protocol === 'https:';
  const transport = isHttps ? https : http;
  const options = {
    hostname: url.hostname,
    port: url.port || (isHttps ? 443 : 80),
    path: url.pathname + url.search,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'Content-Length': Buffer.byteLength(body),
    },
  };

  const start = Date.now();
  return new Promise((resolve) => {
    let timedOut = false;
    const req = transport.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (timedOut) return;
        const latencyMs = Date.now() - start;
        try {
          const parsed = JSON.parse(data);
          // Success if 2xx or if we got a JSON response back (even error JSON = endpoint alive)
          const healthy = res.statusCode >= 200 && res.statusCode < 500;
          resolve(JSON.stringify({ healthy, latencyMs, model, status: res.statusCode }));
        } catch (e) {
          resolve(JSON.stringify({ healthy: false, latencyMs, error: `JSON parse failed: ${data.slice(0, 200)}` }));
        }
      });
    });

    const timer = setTimeout(() => {
      timedOut = true;
      req.destroy();
      resolve(JSON.stringify({ healthy: false, latencyMs: timeoutMs, error: `Timed out after ${timeoutMs}ms` }));
    }, timeoutMs);

    req.on('error', (err) => {
      clearTimeout(timer);
      resolve(JSON.stringify({ healthy: false, latencyMs: Date.now() - start, error: err.message }));
    });

    req.on('close', () => clearTimeout(timer));
    req.write(body);
    req.end();
  });
}
```

Add a `buildIdentityResult(provider)` function:

```javascript
function buildIdentityResult(provider) {
  let pkgVersion = '0.0.0';
  try {
    const pkg = JSON.parse(fs.readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));
    pkgVersion = pkg.version;
  } catch (_) {}
  const model = provider.type === 'http'
    ? (process.env.CLAUDE_DEFAULT_MODEL ?? provider.model)
    : (provider.mainTool ?? provider.name);
  return JSON.stringify({
    name: 'unified-mcp-server',
    version: pkgVersion,
    slot: provider.name,
    type: provider.type,
    model,
    provider: provider.description,
    install_method: 'qgsd-monorepo',
  });
}
```

Replace the existing `buildTools()` function with a version that dispatches:

```javascript
function buildTools() {
  if (slotProvider) return buildSlotTools(slotProvider);
  return buildAllProviderTools();
}

function buildAllProviderTools() {
  // existing logic — renamed from original buildTools()
  return providers.map(p => ({
    name: p.name,
    description: p.description,
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'The prompt or task to send to the provider CLI',
        },
        timeout_ms: {
          type: 'number',
          description: `Timeout in milliseconds (default: ${p.timeout_ms ?? 300000})`,
        },
      },
      required: ['prompt'],
    },
  }));
}

function buildSlotTools(provider) {
  const tools = [];

  // ping — all providers
  tools.push({
    name: 'ping',
    description: `Echo ping for ${provider.name}`,
    inputSchema: { type: 'object', properties: {}, required: [] },
  });

  // identity — all providers
  tools.push({
    name: 'identity',
    description: `Return identity info for ${provider.name}`,
    inputSchema: { type: 'object', properties: {}, required: [] },
  });

  if (provider.type === 'http') {
    // claude tool
    tools.push({
      name: 'claude',
      description: provider.description,
      inputSchema: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'Prompt to send' },
          timeout_ms: { type: 'number', description: `Timeout ms (default: ${provider.timeout_ms ?? 120000})` },
        },
        required: ['prompt'],
      },
    });
    // health_check tool
    tools.push({
      name: 'health_check',
      description: `Check health of ${provider.name} HTTP endpoint`,
      inputSchema: { type: 'object', properties: {}, required: [] },
    });
  } else {
    // mainTool
    tools.push({
      name: provider.mainTool,
      description: provider.description,
      inputSchema: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'Prompt or task to send' },
          timeout_ms: { type: 'number', description: `Timeout ms (default: ${provider.timeout_ms ?? 300000})` },
        },
        required: ['prompt'],
      },
    });
    // help tool
    if (provider.helpArgs) {
      tools.push({
        name: 'help',
        description: `Show help for ${provider.mainTool ?? provider.name} CLI`,
        inputSchema: { type: 'object', properties: {}, required: [] },
      });
    }
    // extraTools
    for (const extra of (provider.extraTools ?? [])) {
      if (extra.checkUpdate) {
        tools.push({
          name: extra.name,
          description: extra.description,
          inputSchema: { type: 'object', properties: {}, required: [] },
        });
      } else {
        tools.push({
          name: extra.name,
          description: extra.description,
          inputSchema: {
            type: 'object',
            properties: {
              prompt: { type: 'string', description: 'Prompt or task to send' },
            },
            required: ['prompt'],
          },
        });
      }
    }
  }

  return tools;
}
```

Replace the `tools/call` handler section to dispatch slot tool calls. The current handler uses `toolMap.get(toolName)` which maps tool name → provider. In PROVIDER_SLOT mode, tool names are NOT the provider name, so the existing dispatch breaks. Replace the `tools/call` block in `handleRequest` with:

```javascript
  if (method === 'tools/call') {
    const toolName = params?.name;
    const toolArgs = params?.arguments ?? {};

    if (slotProvider) {
      // PROVIDER_SLOT mode: dispatch by tool name within this slot
      try {
        const output = await handleSlotToolCall(slotProvider, toolName, toolArgs);
        sendResult(id, { content: [{ type: 'text', text: output }], isError: false });
      } catch (err) {
        sendResult(id, { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true });
      }
      return;
    }

    // All-providers mode (original behavior)
    const provider = toolMap.get(toolName);
    if (!provider) {
      sendResult(id, { content: [{ type: 'text', text: `Unknown tool: ${toolName}` }], isError: true });
      return;
    }
    try {
      const output = provider.type === 'http'
        ? await runHttpProvider(provider, toolArgs)
        : await runProvider(provider, toolArgs);
      sendResult(id, { content: [{ type: 'text', text: output }], isError: false });
    } catch (err) {
      sendResult(id, { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true });
    }
    return;
  }
```

Add `handleSlotToolCall(provider, toolName, toolArgs)` function after `buildSlotTools`:

```javascript
async function handleSlotToolCall(provider, toolName, toolArgs) {
  if (toolName === 'ping') {
    return `pong from ${provider.name}`;
  }

  if (toolName === 'identity') {
    return buildIdentityResult(provider);
  }

  if (provider.type === 'http') {
    if (toolName === 'claude') {
      return runHttpProvider(provider, toolArgs);
    }
    if (toolName === 'health_check') {
      return runHealthCheck(provider);
    }
    return `Unknown tool for HTTP provider: ${toolName}`;
  }

  // Subprocess provider
  if (toolName === provider.mainTool) {
    return runProvider(provider, toolArgs);
  }

  if (toolName === 'help') {
    return runProvider({ ...provider, args_template: provider.helpArgs }, { prompt: '' });
  }

  // Check extraTools
  for (const extra of (provider.extraTools ?? [])) {
    if (extra.name === toolName) {
      if (extra.checkUpdate) {
        // opencode_check_update: run npm view opencode version
        return runProvider(
          { ...provider, cli: 'npm', args_template: ['view', 'opencode', 'version'] },
          {}
        );
      }
      return runProvider({ ...provider, args_template: extra.args_template }, toolArgs);
    }
  }

  return `Unknown tool for subprocess provider: ${toolName}`;
}
```

Note on help invocation: `runProvider` expects `args_template` with `{prompt}` substitution. For `helpArgs` (e.g. `["--help"]`), there is no `{prompt}` placeholder. The `{prompt}` substitution logic already handles missing placeholder (the arg is returned as-is when it's not `{prompt}`). Pass `{ prompt: '' }` as toolArgs and use `args_template: provider.helpArgs` — this works because the map replaces `{prompt}` literal only, leaving other args untouched.
  </action>
  <verify>
# Test 1: all-providers mode still works (no PROVIDER_SLOT)
node /Users/jonathanborduas/code/QGSD/bin/unified-mcp-server.mjs &lt;&lt;&lt; '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' 2>/dev/null | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); const r=JSON.parse(d); console.log('all-tools count:', r.result.tools.length, r.result.tools.map(t=>t.name).join(', '));"

# Test 2: PROVIDER_SLOT=codex-1 lists correct tools
PROVIDER_SLOT=codex-1 node /Users/jonathanborduas/code/QGSD/bin/unified-mcp-server.mjs &lt;&lt;&lt; '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' 2>/dev/null | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); const r=JSON.parse(d); const names=r.result.tools.map(t=>t.name).sort(); console.log('codex-1 tools:', names.join(', '));"
# Expected: codex, help, identity, ping, review

# Test 3: PROVIDER_SLOT=claude-1 lists correct tools
PROVIDER_SLOT=claude-1 node /Users/jonathanborduas/code/QGSD/bin/unified-mcp-server.mjs &lt;&lt;&lt; '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' 2>/dev/null | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); const r=JSON.parse(d); const names=r.result.tools.map(t=>t.name).sort(); console.log('claude-1 tools:', names.join(', '));"
# Expected: claude, health_check, identity, ping

# Test 4: ping works in slot mode
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"ping","arguments":{}}}' | PROVIDER_SLOT=codex-1 node /Users/jonathanborduas/code/QGSD/bin/unified-mcp-server.mjs 2>/dev/null | grep pong
  </verify>
  <done>
All 4 verification tests pass:
1. all-providers mode: 12 tools listed (codex-1, codex-2, gemini-1, gemini-2, opencode-1, copilot-1, claude-1..6)
2. codex-1 slot mode: exactly [codex, help, identity, ping, review]
3. claude-1 slot mode: exactly [claude, health_check, identity, ping]
4. ping in slot mode returns "pong from codex-1"
  </done>
</task>

<task type="auto">
  <name>Task 3: Update ~/.claude.json to point all 10 entries at QGSD unified-mcp-server</name>
  <files>~/.claude.json</files>
  <action>
Use a Node.js script (run via Bash) to update ~/.claude.json in-place. Read the full JSON, mutate only the `args` and `env.PROVIDER_SLOT` fields for the 10 affected entries, then write back. Do NOT use the Write tool — it risks truncating API keys.

The script must:
1. Parse the full ~/.claude.json
2. For each of the 10 entries (codex-1, gemini-1, opencode-1, copilot-1, claude-1..6):
   - Set `args` to `["/Users/jonathanborduas/code/QGSD/bin/unified-mcp-server.mjs"]`
   - Ensure `env` object exists
   - Set `env.PROVIDER_SLOT` to the entry key name (e.g. "claude-1" for the claude-1 entry)
   - For subprocess providers (codex-1, gemini-1, opencode-1, copilot-1): no other env changes
   - For HTTP providers (claude-1..6): preserve ALL existing env vars verbatim, only add PROVIDER_SLOT
3. Leave `unified-1` entry completely untouched
4. Write the full mutated JSON back to ~/.claude.json with 2-space indentation

Run as:
```bash
node -e "
const fs = require('fs');
const path = process.env.HOME + '/.claude.json';
const config = JSON.parse(fs.readFileSync(path, 'utf8'));
const QGSD_PATH = '/Users/jonathanborduas/code/QGSD/bin/unified-mcp-server.mjs';
const slots = ['codex-1','gemini-1','opencode-1','copilot-1','claude-1','claude-2','claude-3','claude-4','claude-5','claude-6'];
for (const slot of slots) {
  const entry = config.mcpServers[slot];
  if (!entry) { console.error('Missing slot: ' + slot); continue; }
  entry.args = [QGSD_PATH];
  if (!entry.env) entry.env = {};
  entry.env.PROVIDER_SLOT = slot;
}
fs.writeFileSync(path, JSON.stringify(config, null, 2) + '\n');
console.log('Done. Updated slots:', slots.join(', '));
"
```

After writing, verify unified-1 is untouched and claude-1 still has all its env vars:
```bash
node -e "
const c = JSON.parse(require('fs').readFileSync(process.env.HOME+'/.claude.json','utf8'));
const u = c.mcpServers['unified-1'];
console.log('unified-1 args:', u.args);
const cl1 = c.mcpServers['claude-1'];
console.log('claude-1 PROVIDER_SLOT:', cl1.env.PROVIDER_SLOT);
console.log('claude-1 ANTHROPIC_BASE_URL:', cl1.env.ANTHROPIC_BASE_URL);
console.log('claude-1 ANTHROPIC_API_KEY present:', !!cl1.env.ANTHROPIC_API_KEY);
console.log('claude-6 ANTHROPIC_FALLBACK_BASE_URL:', c.mcpServers['claude-6'].env.ANTHROPIC_FALLBACK_BASE_URL);
"
```
  </action>
  <verify>
node -e "
const c = JSON.parse(require('fs').readFileSync(process.env.HOME+'/.claude.json','utf8'));
const QGSD = '/Users/jonathanborduas/code/QGSD/bin/unified-mcp-server.mjs';
const slots = ['codex-1','gemini-1','opencode-1','copilot-1','claude-1','claude-2','claude-3','claude-4','claude-5','claude-6'];
let ok = true;
for (const s of slots) {
  const e = c.mcpServers[s];
  if (e.args[0] !== QGSD) { console.error('FAIL args: '+s, e.args[0]); ok=false; }
  if (e.env.PROVIDER_SLOT !== s) { console.error('FAIL slot: '+s, e.env.PROVIDER_SLOT); ok=false; }
}
// unified-1 unchanged
if (c.mcpServers['unified-1'].args[0] !== QGSD || c.mcpServers['unified-1'].env.PROVIDER_SLOT) {
  // unified-1 should point to same path but have NO PROVIDER_SLOT
  if (c.mcpServers['unified-1'].env && c.mcpServers['unified-1'].env.PROVIDER_SLOT) { console.error('FAIL unified-1 has PROVIDER_SLOT'); ok=false; }
}
// claude-1 key vars preserved
const cl1 = c.mcpServers['claude-1'];
if (!cl1.env.ANTHROPIC_API_KEY) { console.error('FAIL claude-1 missing API key'); ok=false; }
if (!cl1.env.ANTHROPIC_BASE_URL) { console.error('FAIL claude-1 missing base url'); ok=false; }
// claude-6 fallback vars preserved
const cl6 = c.mcpServers['claude-6'];
if (!cl6.env.ANTHROPIC_FALLBACK_BASE_URL) { console.error('FAIL claude-6 missing fallback url'); ok=false; }
if (ok) console.log('ALL OK — 10 slots updated, unified-1 untouched, API keys preserved');
"
  </verify>
  <done>
All 10 MCP server entries in ~/.claude.json point to /Users/jonathanborduas/code/QGSD/bin/unified-mcp-server.mjs with correct PROVIDER_SLOT env var. unified-1 is untouched. All API keys (ANTHROPIC_API_KEY, TOGETHER_API_KEY, FIREWORKS_API_KEY, fallback keys for claude-6) are preserved verbatim.
  </done>
</task>

<task type="auto">
  <name>Task 4: Commit and verify end-to-end</name>
  <files>/Users/jonathanborduas/code/QGSD/bin/providers.json
/Users/jonathanborduas/code/QGSD/bin/unified-mcp-server.mjs</files>
  <action>
Commit the two QGSD file changes (providers.json + unified-mcp-server.mjs). ~/.claude.json is gitignored — no commit needed for it.

Run smoke tests before committing:
1. All-providers mode lists 12 tools (unchanged behavior)
2. PROVIDER_SLOT=gemini-1 lists [gemini, help, ping, identity]
3. PROVIDER_SLOT=copilot-1 lists [ask, suggest, explain, help, ping, identity]
4. PROVIDER_SLOT=opencode-1 lists [opencode, opencode_check_update, help, ping, identity]

Commit with:
```bash
node /Users/jonathanborduas/code/QGSD/bin/gsd-tools.cjs commit "feat(quick-80): add PROVIDER_SLOT mode to unified-mcp-server — replaces 5 external MCP repos" --files bin/providers.json bin/unified-mcp-server.mjs
```

After commit, instruct user to restart Claude Code (Cmd+R or `/quit` + reopen) so the MCP servers reconnect with the new binary. After restart, run `/qgsd:mcp-status` to verify all slots show as connected.

NOTE: Do NOT restart Claude Code via script — this must be done manually by the user. Leave a clear instruction.
  </action>
  <verify>
# Smoke test — gemini-1 slot
PROVIDER_SLOT=gemini-1 node /Users/jonathanborduas/code/QGSD/bin/unified-mcp-server.mjs &lt;&lt;&lt; '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' 2>/dev/null | node -e "const r=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(r.result.tools.map(t=>t.name).sort().join(', '));"
# Expected: gemini, help, identity, ping

# Smoke test — copilot-1 slot
PROVIDER_SLOT=copilot-1 node /Users/jonathanborduas/code/QGSD/bin/unified-mcp-server.mjs &lt;&lt;&lt; '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' 2>/dev/null | node -e "const r=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(r.result.tools.map(t=>t.name).sort().join(', '));"
# Expected: ask, explain, help, identity, ping, suggest

# Verify git commit exists
git -C /Users/jonathanborduas/code/QGSD log --oneline -1
  </verify>
  <done>
Both smoke tests pass (correct tool lists for gemini-1 and copilot-1 slots). Git commit created for providers.json + unified-mcp-server.mjs. User has been instructed to restart Claude Code and run /qgsd:mcp-status.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
PROVIDER_SLOT mode in unified-mcp-server.mjs + updated ~/.claude.json pointing all 10 MCP entries at QGSD binary. Claude Code must be restarted for MCP servers to reconnect.
  </what-built>
  <how-to-verify>
1. Restart Claude Code (Cmd+R or /quit and reopen)
2. Run: /qgsd:mcp-status
3. Verify all 11 slots (codex-1, gemini-1, opencode-1, copilot-1, claude-1..6, unified-1) show as connected
4. Optionally run: /qgsd:quorum test — to confirm end-to-end quorum still works
  </how-to-verify>
  <resume-signal>Type "approved" if all slots connected, or describe which slots failed to connect</resume-signal>
</task>

</tasks>

<verification>
- `node bin/unified-mcp-server.mjs` (no env): still lists all 12 unified tools by provider name
- `PROVIDER_SLOT=codex-1 node bin/unified-mcp-server.mjs tools/list`: returns [codex, review, help, ping, identity]
- `PROVIDER_SLOT=claude-1 node bin/unified-mcp-server.mjs tools/list`: returns [claude, health_check, ping, identity]
- `~/.claude.json`: all 10 entries point to QGSD binary; unified-1 untouched; all API keys intact
- After Claude Code restart: /qgsd:mcp-status shows all slots connected
</verification>

<success_criteria>
- All 5 external MCP repos eliminated from ~/.claude.json (replaced by QGSD unified binary)
- Tool names identical to original servers — zero changes needed to quorum commands or workflows
- unified-1 (all-providers mode) continues to work unchanged
- No API keys lost or truncated in ~/.claude.json
- PROVIDER_SLOT=&lt;slot&gt; mode dispatches correct tools for both subprocess and HTTP provider types
</success_criteria>

<output>
After completion, create `/Users/jonathanborduas/code/QGSD/.planning/quick/80-consolidate-all-mcp-sub-repos-into-qgsd-/80-SUMMARY.md`
</output>

---
phase: quick-395
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/manage-agents-core.cjs
  - bin/unified-mcp-server.mjs
autonomous: true
requirements: [INTENT-01]
formal_artifacts: none

must_haves:
  truths:
    - "Slots whose CLI binary cannot be found/executed are excluded from the active provider list at server startup"
    - "Slots whose CLI binary IS found remain available exactly as before — no regression in behavior"
    - "HTTP-only slots (type=http, no cli field) are always included regardless of detection"
    - "Multiple slots sharing the same CLI binary (e.g., ccr-1 through ccr-6 all use /opt/homebrew/bin/ccr) perform only one filesystem/which probe per unique binary path"
    - "The detection is fail-open: if probing throws unexpectedly, the full providers list is used rather than crashing"
  artifacts:
    - path: "bin/manage-agents-core.cjs"
      provides: "detectInstalledProviders(providers) exported via module.exports._pure"
      contains: "detectInstalledProviders"
    - path: "bin/unified-mcp-server.mjs"
      provides: "Filters providers to installed-only after resolveCli loop, before toolMap is built"
      contains: "detectInstalledProviders"
  key_links:
    - from: "bin/unified-mcp-server.mjs"
      to: "bin/manage-agents-core.cjs"
      via: "require('./manage-agents-core.cjs')._pure.detectInstalledProviders"
      pattern: "detectInstalledProviders"
    - from: "detectInstalledProviders"
      to: "bin/resolve-cli.cjs"
      via: "resolveCli() already called before providers array is passed in; detection uses fs.accessSync on resolvedCli"
      pattern: "fs\\.accessSync"
---

<objective>
Add a `detectInstalledProviders(providers)` function to `manage-agents-core.cjs` that filters a providers array to only those whose CLI binary is present on the system, then apply it in `unified-mcp-server.mjs` right after the existing CLI-resolution loop so that only installed providers are exposed as MCP tools.

Purpose: Slots defined in providers.json but not installed on the machine produce confusing errors at dispatch time. Filtering at startup lets the MCP server surface a truthful tool list — only what actually works.

Output: Filtered `providers` array in `unified-mcp-server.mjs` startup; `detectInstalledProviders` available in `manage-agents-core.cjs` _pure namespace for future reuse.
</objective>

<execution_context>
@./.claude/nf/workflows/execute-plan.md
@./.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@bin/providers.json
@bin/manage-agents-core.cjs
@bin/unified-mcp-server.mjs
@bin/resolve-cli.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add detectInstalledProviders() to manage-agents-core.cjs</name>
  <files>bin/manage-agents-core.cjs</files>
  <action>
Add the following pure function immediately after the `readProvidersJson` / `writeProvidersJson` block (around line 334), before the nForma JSON helpers section:

```js
/**
 * detectInstalledProviders(providers) — filter providers to those whose CLI binary is present.
 *
 * Rules:
 * - HTTP-only slots (no `cli` field OR type === 'http') are always included.
 * - For subprocess/ccr slots, use the already-resolved `resolvedCli` field if present,
 *   otherwise fall back to `cli`. Test with fs.accessSync(path, fs.constants.X_OK).
 * - De-duplicate probes: slots sharing the same binary path (e.g. ccr-1..ccr-6 all use
 *   /opt/homebrew/bin/ccr) check the filesystem only once per unique path.
 * - Fail-open: any unexpected error returns the full providers list unchanged.
 *
 * @param {Array} providers - array of provider objects from providers.json
 * @returns {Array} filtered array containing only providers with installed CLIs
 */
function detectInstalledProviders(providers) {
  if (!Array.isArray(providers)) return providers || [];
  try {
    const checked = new Map(); // binaryPath -> boolean (installed)
    return providers.filter(p => {
      // HTTP-only slots have no CLI to probe
      if (!p.cli || p.type === 'http') return true;
      const binaryPath = p.resolvedCli || p.cli;
      if (checked.has(binaryPath)) return checked.get(binaryPath);
      let installed = false;
      try {
        fs.accessSync(binaryPath, fs.constants.X_OK);
        installed = true;
      } catch (_) {
        // binary not found or not executable — slot excluded
      }
      checked.set(binaryPath, installed);
      if (!installed) {
        process.stderr.write(`[manage-agents-core] detectInstalledProviders: ${p.name} excluded — CLI not found: ${binaryPath}\n`);
      }
      return installed;
    });
  } catch (err) {
    // Fail-open: unexpected error — return full list
    process.stderr.write(`[manage-agents-core] detectInstalledProviders: unexpected error, using full list: ${err.message}\n`);
    return providers;
  }
}
```

Then export it by adding `detectInstalledProviders` to the `module.exports._pure` block near the bottom of the file (after `probeProviderUrl`):

```js
detectInstalledProviders,
```
  </action>
  <verify>
node -e "const c=require('./bin/manage-agents-core.cjs');console.log(typeof c._pure.detectInstalledProviders)"
Expected output: `function`

Also run: node -e "const c=require('./bin/manage-agents-core.cjs');const p=c._pure.readProvidersJson();const filtered=c._pure.detectInstalledProviders(p.providers);console.log('total:',p.providers.length,'installed:',filtered.length,filtered.map(x=>x.name))"
Expected output: total count >= installed count, installed list is a subset of total names.
  </verify>
  <done>
`detectInstalledProviders` is exported from `manage-agents-core.cjs._pure`, accepts a providers array, returns only slots with reachable CLI binaries (plus all HTTP slots), deduplicates binary checks, and fails open.
  </done>
</task>

<task type="auto">
  <name>Task 2: Wire detectInstalledProviders into unified-mcp-server.mjs startup</name>
  <files>bin/unified-mcp-server.mjs</files>
  <action>
In `bin/unified-mcp-server.mjs`, after the existing CLI resolution loop (lines 42-62, the `for (const provider of providers)` loop that sets `provider.resolvedCli`), add a filtering step that calls `detectInstalledProviders`.

Import the function at the top of the require block (alongside the existing `resolveCli` require):

```js
const { resolveCli } = require('./resolve-cli.cjs');
const { _pure: { detectInstalledProviders } } = require('./manage-agents-core.cjs');
```

NOTE: `manage-agents-core.cjs` uses `require('./update-agents.cjs')` which may pull in additional deps — this is fine since unified-mcp-server.mjs already uses CommonJS require via `createRequire`. Verify no circular deps arise.

After the CLI resolution loop ends (after the closing brace of `for (const provider of providers) { ... }` at around line 62), add:

```js
// ─── Filter to installed CLIs only (DYNAMIC-SLOTS-01) ──────────────────────────
// resolvedCli was set in the loop above; detectInstalledProviders uses it for probing.
// HTTP-only slots and slots with missing resolvedCli fall back to provider.cli.
providers = detectInstalledProviders(providers);
if (providers.length === 0) {
  process.stderr.write('[unified-mcp-server] WARNING: No installed providers found after CLI detection — server will start with zero tools\n');
}
```

IMPORTANT: `providers` is declared with `let` (it is re-assigned inside the Guard block: `providers = providers || []`). Confirm the variable is declared as `let providers` — if it is declared as `const`, change `const providers` to `let providers` on the line where it is assigned (line 29: `let providers;` — already a `let` per the file).

The `toolMap` on line 808 is built as `new Map(providers.map(p => [p.name, p]))` — this runs after the module-level code so it will automatically reflect the filtered list.
  </action>
  <verify>
1. Start the server in a dry-run: node bin/unified-mcp-server.mjs <<< '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' 2>/dev/null | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8');const r=JSON.parse(d);console.log('tools:',r.result.tools.map(t=>t.name))"
   Confirm the tool list only contains providers whose CLI binary is actually on the system.

2. Grep for the integration: grep -n 'detectInstalledProviders' bin/unified-mcp-server.mjs
   Expected: at least 2 lines (import + call-site).

3. No regression: node -e "const {createRequire}=require('module');const r=createRequire(import.meta ? import.meta.url : __filename);r('./bin/manage-agents-core.cjs')" 2>&1 | head -5
   Expected: no error output (module loads cleanly).
  </verify>
  <done>
`unified-mcp-server.mjs` calls `detectInstalledProviders(providers)` after the CLI resolution loop. Slots without installed CLIs are excluded from `providers`, `buildAllProviderTools()`, `toolMap`, and all dispatch paths. HTTP-only slots remain included. Server starts without crashing even when all CLI slots are missing.
  </done>
</task>

</tasks>

<verification>
After both tasks complete:

1. `grep -n 'detectInstalledProviders' bin/manage-agents-core.cjs` returns the function definition and export line.
2. `grep -n 'detectInstalledProviders' bin/unified-mcp-server.mjs` returns the require import and the call-site.
3. `npm run test:ci` passes (no regressions in existing test suite).
4. Start server with `PROVIDER_SLOT=codex-1 node bin/unified-mcp-server.mjs` — if codex binary absent, server logs `detectInstalledProviders: codex-1 excluded` on stderr and starts with zero tools (or just codex-1 is the only provider so it exits or emits warning).
5. Start server without PROVIDER_SLOT — tools/list only returns tools for providers with installed CLIs.
</verification>

<success_criteria>
- `detectInstalledProviders` exported from `manage-agents-core.cjs._pure`
- `unified-mcp-server.mjs` tool list reflects only installed CLIs at startup
- Dedup: ccr-1 through ccr-6 share one binary probe (one `fs.accessSync` call for `/opt/homebrew/bin/ccr`)
- Fail-open: unexpected errors during detection return full provider list
- HTTP slots always included
- `npm run test:ci` green
</success_criteria>

<output>
After completion, create `.planning/quick/395-make-providers-slot-list-dynamic-detect-/395-SUMMARY.md`
</output>

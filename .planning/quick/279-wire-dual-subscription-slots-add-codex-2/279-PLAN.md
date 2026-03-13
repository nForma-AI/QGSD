---
phase: quick-279
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/install.js
autonomous: true
formal_artifacts: none

must_haves:
  truths:
    - "codex-2 and gemini-2 appear as MCP server entries in ~/.claude.json after install"
    - "codex-2 and gemini-2 appear in quorum_active array in ~/.claude/nf.json after install"
    - "Existing MCP entries (codex-1, gemini-1, etc.) are preserved unchanged"
    - "Each new entry uses unified-mcp-server.mjs with correct PROVIDER_SLOT env var"
  artifacts:
    - path: "bin/install.js"
      provides: "ensureMcpSlotsFromProviders function that syncs providers.json slots to ~/.claude.json"
      contains: "ensureMcpSlotsFromProviders"
  key_links:
    - from: "bin/install.js"
      to: "bin/providers.json"
      via: "JSON.parse read of providers array"
      pattern: "providers\\.json"
    - from: "bin/install.js"
      to: "~/.claude.json"
      via: "mcpServers write for missing slots"
      pattern: "mcpServers"
---

<objective>
Add codex-2 and gemini-2 MCP server entries to ~/.claude.json and quorum_active by making the installer auto-generate MCP entries for all slots defined in providers.json.

Purpose: providers.json already defines codex-2 and gemini-2 (with full config, auth, pool support), but ~/.claude.json has no MCP entries for them, so Claude cannot dispatch quorum calls to these slots. The installer should ensure every provider slot has a corresponding MCP entry.

Output: Updated bin/install.js with ensureMcpSlotsFromProviders() that creates missing MCP entries, wired into install flow before quorum_active discovery.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@bin/install.js
@bin/providers.json
@bin/migrate-to-slots.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add ensureMcpSlotsFromProviders to installer and wire into install flow</name>
  <files>bin/install.js</files>
  <action>
Add a new function `ensureMcpSlotsFromProviders()` near the existing `buildActiveSlots()` function (around line 238). The function must:

1. Read `bin/providers.json` from the repo root (use `path.join(__dirname, 'providers.json')`)
2. Read `~/.claude.json` — preserve all existing top-level keys. If the file is missing, start with `{ mcpServers: {} }`. If it exists but `mcpServers` is missing or not an object, normalize it to `{}` before proceeding. This keeps fail-open behavior robust against partial or user-edited config files while honoring the "add only, never modify existing entries" invariant.
3. For each provider in providers.json, check if `mcpServers[provider.name]` exists
4. If missing, create the entry with this exact structure:
   ```json
   {
     "type": "stdio",
     "command": "node",
     "args": ["<absolute path to bin/unified-mcp-server.mjs>"],
     "env": { "PROVIDER_SLOT": "<provider.name>" }
   }
   ```
   Use `path.join(__dirname, 'unified-mcp-server.mjs')` for the args path.
5. If any entries were added, write ~/.claude.json back and log each added slot
6. Fail-open: wrap in try/catch, never abort install. Use differentiated error logging:
   - File read errors (providers.json, ~/.claude.json) → WARN + log the path that failed
   - JSON parse errors → WARN + suggest manual edit
   - File write errors → WARN + suggest backup
   - Missing unified-mcp-server.mjs → ERROR (hard fail with helpful message, since slots would be non-functional)

Then wire `ensureMcpSlotsFromProviders()` into the `install()` function. It must run BEFORE the nf.json config section (before line ~2242 where `buildActiveSlots()` is called). Find the section that starts with `// ── nForma config ──` or the `nfConfigPath` usage block, and call `ensureMcpSlotsFromProviders()` just before it. Add an inline code comment at the call site explaining the MULTI-03 orchestration dependency: `// MULTI-03: ensureMcpSlotsFromProviders() MUST run before buildActiveSlots() because buildActiveSlots() discovers slots from existing mcpServers keys`.

IMPORTANT: Do NOT modify existing MCP entries — only add missing ones. This preserves user customizations (e.g. custom env vars on existing slots). Log with the existing color helpers (green checkmark for additions, dim for skips).

Relevant invariants:
- OverridesPreserved (installer): existing project overrides must not be cleared — satisfied because we only ADD missing entries, never modify existing ones
- COMP-04: quorum_active populated from discovered slots — satisfied because we add MCP entries before buildActiveSlots() runs, so MULTI-03 incremental update will auto-discover codex-2/gemini-2
  </action>
  <verify>
Run: `node bin/install.js --claude --global 2>&1 | grep -E 'codex-2|gemini-2|ensureMcp'`
Expected: Lines showing codex-2 and gemini-2 were added as MCP entries.

Then verify MCP entries exist:
`node -e "const d = JSON.parse(require('fs').readFileSync(require('os').homedir() + '/.claude.json', 'utf8')); console.log('codex-2:', !!d.mcpServers['codex-2'], 'gemini-2:', !!d.mcpServers['gemini-2'])"`
Expected: `codex-2: true gemini-2: true`

Then verify quorum_active:
`node -e "const d = JSON.parse(require('fs').readFileSync(require('os').homedir() + '/.claude/nf.json', 'utf8')); console.log(d.quorum_active.filter(s => s.includes('-2')))"`
Expected: Array containing codex-2 and gemini-2.

Then verify idempotency with BEFORE/AFTER MCP entry count comparison:
`node -e "const d=JSON.parse(require('fs').readFileSync(require('os').homedir()+'/.claude.json','utf8'));console.log('BEFORE count:',Object.keys(d.mcpServers).length)"`
Then run install again:
`node bin/install.js --claude --global 2>&1 | grep -E 'codex-2|gemini-2'`
Expected: No "added" messages (entries already exist), possibly dim skip messages.
Then verify count unchanged:
`node -e "const d=JSON.parse(require('fs').readFileSync(require('os').homedir()+'/.claude.json','utf8'));console.log('AFTER count:',Object.keys(d.mcpServers).length)"`
Expected: BEFORE and AFTER counts are identical — no entries added or removed.

Run existing tests to confirm no regressions:
`node --test bin/manage-agents.test.cjs 2>&1 | tail -5`
  </verify>
  <done>
codex-2 and gemini-2 have MCP entries in ~/.claude.json with correct unified-mcp-server.mjs path and PROVIDER_SLOT env vars. Both appear in quorum_active in ~/.claude/nf.json. All pre-existing MCP entries unchanged. Install is idempotent (second run adds nothing). Existing tests pass.
  </done>
</task>

</tasks>

<verification>
- `node -e "const d=JSON.parse(require('fs').readFileSync(require('os').homedir()+'/.claude.json','utf8'));const s=d.mcpServers;console.log(Object.keys(s).length,'slots');['codex-2','gemini-2'].forEach(k=>{const e=s[k];console.log(k,e?'OK':'MISSING',e&&e.env.PROVIDER_SLOT===k?'slot-ok':'slot-bad')})"` — both slots present with correct PROVIDER_SLOT
- `node -e "const d=JSON.parse(require('fs').readFileSync(require('os').homedir()+'/.claude/nf.json','utf8'));console.log('quorum_active includes codex-2:',d.quorum_active.includes('codex-2'),'gemini-2:',d.quorum_active.includes('gemini-2'))"` — both in quorum_active
- Running `node bin/install.js --claude --global` twice produces same result (idempotent)
</verification>

<success_criteria>
- codex-2 and gemini-2 MCP entries exist in ~/.claude.json with type:stdio, command:node, unified-mcp-server.mjs path, and correct PROVIDER_SLOT
- quorum_active in ~/.claude/nf.json includes codex-2 and gemini-2
- All 11 pre-existing MCP entries preserved unchanged
- Installer is idempotent — re-running does not duplicate or modify entries
- Existing test suite passes
</success_criteria>

<output>
After completion, create `.planning/quick/279-wire-dual-subscription-slots-add-codex-2/279-SUMMARY.md`
</output>

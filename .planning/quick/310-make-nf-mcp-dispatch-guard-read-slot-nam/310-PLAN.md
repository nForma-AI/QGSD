---
phase: quick-310
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - hooks/nf-mcp-dispatch-guard.js
  - hooks/nf-mcp-dispatch-guard.test.js
  - hooks/dist/nf-mcp-dispatch-guard.js
autonomous: true
requirements: [QUICK-310]
formal_artifacts: none

must_haves:
  truths:
    - "Guard blocks direct MCP calls to any slot listed in bin/providers.json"
    - "Guard passes through admin tools (ping, health_check, deep_health_check, identity, help) regardless of slot"
    - "Guard passes through MCP servers NOT listed in providers.json (non-quorum servers)"
    - "Guard fails open if providers.json is missing or malformed"
    - "SLOT_TOOL_SUFFIX in config-loader.js is NOT modified (other hooks depend on it)"
  artifacts:
    - path: "hooks/nf-mcp-dispatch-guard.js"
      provides: "Dynamic slot family discovery from providers.json"
      contains: "providers.json"
    - path: "hooks/nf-mcp-dispatch-guard.test.js"
      provides: "Tests validating dynamic discovery behavior"
      min_lines: 150
  key_links:
    - from: "hooks/nf-mcp-dispatch-guard.js"
      to: "bin/providers.json"
      via: "fs.readFileSync + JSON.parse at module load"
      pattern: "providers\\.json"
    - from: "hooks/nf-mcp-dispatch-guard.js"
      to: "hooks/config-loader.js"
      via: "require for loadConfig, shouldRunHook, validateHookInput (NOT SLOT_TOOL_SUFFIX)"
      pattern: "require.*config-loader"
---

<objective>
Replace the hardcoded KNOWN_FAMILIES set in nf-mcp-dispatch-guard.js with dynamic discovery from bin/providers.json. Currently the guard derives known quorum slot families from the SLOT_TOOL_SUFFIX map in config-loader.js, which is a static list of 8 family names. When users add new provider types via /nf:mcp-setup, the guard silently lets direct calls through because the new family is unknown.

Purpose: Ensure R3.2 enforcement covers ALL configured quorum slots, not just the ones hardcoded at development time.
Output: Updated hook + tests + dist copy, all using providers.json as the authoritative slot family source.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@hooks/nf-mcp-dispatch-guard.js
@hooks/nf-mcp-dispatch-guard.test.js
@hooks/config-loader.js
@bin/providers.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace hardcoded KNOWN_FAMILIES with dynamic providers.json discovery</name>
  <files>hooks/nf-mcp-dispatch-guard.js</files>
  <action>
Modify hooks/nf-mcp-dispatch-guard.js to dynamically discover quorum slot families:

1. Remove the import of SLOT_TOOL_SUFFIX from config-loader (keep loadConfig, shouldRunHook, validateHookInput).

2. Add a `loadKnownFamilies()` function that:
   - Reads `bin/providers.json` from the project root (use `path.resolve(__dirname, '..', 'bin', 'providers.json')` since hooks/ is sibling to bin/).
   - Parses the JSON and extracts `.providers[].name` (e.g. "codex-1", "gemini-2", "claude-4").
   - Strips trailing `-N` from each name to derive the family (e.g. "codex", "gemini", "claude").
   - Returns a `Set` of unique family strings.
   - On ANY error (file missing, malformed JSON, missing .providers array): returns an empty Set and writes a warning to stderr. This is fail-open -- if families can't be loaded, the guard won't block anything, which is safer than blocking everything.

3. Replace `const KNOWN_FAMILIES = new Set(Object.keys(SLOT_TOOL_SUFFIX));` with `const KNOWN_FAMILIES = loadKnownFamilies();` at module scope (loaded once at require time, same as before).

4. Also add `const fs = require('fs');` and `const path = require('path');` at the top (they are not currently imported in the guard).

5. Update the `module.exports` -- keep exporting `ALLOWLISTED_SUFFIXES`, `KNOWN_FAMILIES`, `MCP_TOOL_RE`, and also export `loadKnownFamilies` for testing.

6. The rest of the hook logic (MCP_TOOL_RE, family derivation via slotName.replace(/-\d+$/, ''), ALLOWLISTED_SUFFIXES check, block decision) stays exactly the same.

Key constraint: Do NOT touch config-loader.js. SLOT_TOOL_SUFFIX remains there for slotToToolCall() and other consumers. The guard simply stops depending on it.
  </action>
  <verify>
Run: `node -e "const g = require('./hooks/nf-mcp-dispatch-guard.js'); console.log('families:', [...g.KNOWN_FAMILIES]); console.log('has codex:', g.KNOWN_FAMILIES.has('codex')); console.log('has gemini:', g.KNOWN_FAMILIES.has('gemini')); console.log('has opencode:', g.KNOWN_FAMILIES.has('opencode')); console.log('has copilot:', g.KNOWN_FAMILIES.has('copilot')); console.log('has claude:', g.KNOWN_FAMILIES.has('claude'));"`

All 5 families must be `true`. The families set should NOT contain numbered entries like "codex-1" -- only base families.

Also verify SLOT_TOOL_SUFFIX is NOT imported: `grep 'SLOT_TOOL_SUFFIX' hooks/nf-mcp-dispatch-guard.js` should return nothing.
  </verify>
  <done>
KNOWN_FAMILIES is populated dynamically from bin/providers.json. The guard no longer imports SLOT_TOOL_SUFFIX from config-loader. All existing families (codex, gemini, opencode, copilot, claude) are discovered. Fail-open on missing/malformed providers.json.
  </done>
</task>

<task type="auto">
  <name>Task 2: Update tests and sync dist copy</name>
  <files>hooks/nf-mcp-dispatch-guard.test.js, hooks/dist/nf-mcp-dispatch-guard.js</files>
  <action>
Update hooks/nf-mcp-dispatch-guard.test.js:

1. Add a new test TC18 that validates loadKnownFamilies returns a Set containing the expected families by requiring the module and inspecting the export:
   ```
   const { KNOWN_FAMILIES, loadKnownFamilies } = require('./nf-mcp-dispatch-guard');
   ```
   Assert KNOWN_FAMILIES.has('codex'), .has('gemini'), .has('opencode'), .has('copilot'), .has('claude') are all true.
   Assert KNOWN_FAMILIES.size >= 5 (at least the 5 known families).

2. Add TC19 that validates KNOWN_FAMILIES does NOT contain numbered slots (e.g. "codex-1" should NOT be in the set -- only "codex").

3. Update TC14 comment to clarify that "unknown MCP server" means a server whose family is not listed in providers.json (not just "not in SLOT_TOOL_SUFFIX").

4. All existing tests TC1-TC17 must still pass unchanged -- the behavioral contract is identical.

After tests pass, sync the dist copy:
   `cp hooks/nf-mcp-dispatch-guard.js hooks/dist/nf-mcp-dispatch-guard.js`

Then install:
   `node bin/install.js --claude --global`
  </action>
  <verify>
Run: `node hooks/nf-mcp-dispatch-guard.test.js`
All tests must pass (17 existing + 2 new = 19 total, 0 failures).

Verify dist is synced: `diff hooks/nf-mcp-dispatch-guard.js hooks/dist/nf-mcp-dispatch-guard.js` should show no differences.
  </verify>
  <done>
All 19 tests pass. Dist copy is synced. Hook is installed globally via bin/install.js. The guard now dynamically discovers quorum slots from providers.json instead of depending on the hardcoded SLOT_TOOL_SUFFIX map.
  </done>
</task>

</tasks>

<verification>
1. `node hooks/nf-mcp-dispatch-guard.test.js` -- 19/19 pass
2. `grep 'SLOT_TOOL_SUFFIX' hooks/nf-mcp-dispatch-guard.js` -- no matches (removed dependency)
3. `grep 'providers.json' hooks/nf-mcp-dispatch-guard.js` -- at least 1 match (new dependency)
4. `diff hooks/nf-mcp-dispatch-guard.js hooks/dist/nf-mcp-dispatch-guard.js` -- no diff
5. `node -e "const {SLOT_TOOL_SUFFIX} = require('./hooks/config-loader'); console.log(Object.keys(SLOT_TOOL_SUFFIX).length)"` -- still 8 (config-loader unchanged)
</verification>

<success_criteria>
- Guard blocks direct MCP calls for all providers in bin/providers.json (codex, gemini, opencode, copilot, claude families)
- Guard passes through admin tools and unknown MCP servers
- Guard fails open if providers.json is missing/malformed
- config-loader.js is completely untouched
- All 19 tests pass
- Dist copy synced and installed
</success_criteria>

<output>
After completion, create `.planning/quick/310-make-nf-mcp-dispatch-guard-read-slot-nam/310-SUMMARY.md`
</output>

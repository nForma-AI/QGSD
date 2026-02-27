# Phase 39: Rename and Migration - Research

**Researched:** 2026-02-23
**Domain:** Codebase-wide identifier refactoring + `~/.claude.json` key migration
**Confidence:** HIGH

## Summary

Phase 39 is a pure internal rename with no new runtime behavior — it replaces all model-based agent names (`claude-deepseek`, `copilot-cli`, `codex-cli`, etc.) with slot-based names (`claude-1`, `copilot-1`, `codex-cli-1`, etc.) across three surfaces: `~/.claude.json` (runtime config), QGSD source files (code and commands), and installed hook files (dist/ and `~/.claude/hooks/`).

The scope is well-contained. All 10 existing mcpServers keys and their corresponding string literals in source must be updated. The migration script must be idempotent (running twice is a no-op) and non-destructive (all existing env fields — `ANTHROPIC_BASE_URL`, `ANTHROPIC_API_KEY`, `CLAUDE_DEFAULT_MODEL`, timeout vars — must be preserved). The update-scoreboard.cjs `VALID_MODELS` list and `emptyData()` skeleton are intentionally NOT migrated in Phase 39 — scoreboard slot tracking is Phase 40 (SCBD-01..03).

The critical implementation risk is MCP tool-name derivation: Claude Code names tools as `mcp__<mcpServers-key>__<toolname>`. After rename, `opencode` becomes `opencode-1` and all tool calls must use `mcp__opencode-1__identity`, not `mcp__opencode__identity`. This propagates through: allowed-tools frontmatter, AGENT_TOOL_MAP in qgsd-prompt.js, required_models tool_prefix strings, mcp-status table, and orchestrator call patterns.

**Primary recommendation:** Implement in two plans — Plan A: migration script + `~/.claude.json` rename + update-scoreboard VALID_MODELS alias prep; Plan B: source file sweeps (hooks, commands, orchestrator, install.js). Commit dist/ sync as part of Plan B. Keep scoreboard schema untouched (Phase 40 handles SCBD-01..03).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SLOT-01 | User sees all quorum agents referred to by slot name in all QGSD output and commands | All user-facing surfaces identified: mcp-status.md table, mcp-set-model.md valid-agents list, mcp-restart.md valid-agents list, mcp-update.md valid-agents list, mcp-setup.md claude-mcp-server roster, quorum.md team display, quorum-test.md worker calls, qgsd-quorum-orchestrator.md display-name logic |
| SLOT-02 | Migration script renames existing `~/.claude.json` mcpServers entries from model-based names to slot names — non-destructive, invertible, idempotent | `~/.claude.json` structure confirmed: 10 keys, each with `command`, `args`, `env` fields. Rename = JSON key swap only; all fields preserved. Idempotency = detect if key already matches `<family>-<N>` pattern |
| SLOT-03 | All QGSD source files updated to use new slot names — no old names remain | Full file inventory completed (see Architecture Patterns section). 8 source JS files + 8 command .md files + 1 agent .md file need updating |
| SLOT-04 | `mcp-status`, `mcp-set-model`, `mcp-update`, `mcp-restart` accept and display slot names correctly | All 4 commands have hardcoded agent lists in Step 1-2 validation and table display. These lists must be replaced with slot names |
</phase_requirements>

## Standard Stack

### Core

| Component | Version | Purpose | Why Standard |
|-----------|---------|---------|--------------|
| Node.js fs | built-in | Read/write `~/.claude.json` atomically | Already used throughout bin/ |
| JSON.parse / JSON.stringify | built-in | Parse and rewrite claude.json | All config I/O uses this pattern |
| Bash grep | system | Verification that no old names remain | Success criterion is a grep returning zero matches |

### Supporting

| Component | Purpose | When to Use |
|-----------|---------|-------------|
| `bin/install.js` pattern | Write config patches using inline `node -e` scripts | Migration script should follow same pattern as apply flows in mcp-setup.md |
| `hooks/dist/` rebuild | Keep dist in sync with source | After any change to hooks/*.js, rebuild with `cp` or existing build step |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual key-by-key rename in migration script | Regex substitution on raw JSON text | Key-swap via JSON parse/stringify is safer — no risk of partial match |
| Introducing a mapping table in config-loader.js | Hardcode new names directly | Direct replacement is simpler for Phase 39 scope; mapping table would be needed only if backward compatibility is required (it is not, per SLOT-03) |

## Architecture Patterns

### Slot Name Scheme

The naming convention, derived from REQUIREMENTS.md SLOT-01, MULTI-01, MULTI-02, WIZ-10:

| Family | Current names | Slot names |
|--------|---------------|------------|
| claude | claude-deepseek, claude-minimax, claude-qwen-coder, claude-kimi, claude-llama4, claude-glm | claude-1, claude-2, claude-3, claude-4, claude-5, claude-6 |
| copilot | copilot-cli | copilot-1 |
| opencode | opencode | opencode-1 |
| codex-cli | codex-cli | codex-cli-1 |
| gemini-cli | gemini-cli | gemini-cli-1 |

**Numbering within claude family:** assignment is by current discovery order in `~/.claude.json`. Based on actual `~/.claude.json` at time of research:
- claude-deepseek → claude-1
- claude-minimax → claude-2
- claude-qwen-coder → claude-3
- claude-kimi → claude-4
- claude-llama4 → claude-5
- claude-glm → claude-6

The claude family numbering corresponds to current order — it is not semantically tied to the model. Phase 41 (MULTI) will establish that models are per-slot config, not name.

**Note on copilot family:** `copilot-cli` → `copilot-1` (family name is `copilot`, not `copilot-cli`). This aligns with REQUIREMENTS.md MULTI-02 which says `copilot-N` not `copilot-cli-N`. Confirmed by SLOT-01 examples listing `copilot-1`.

### Tool Name Impact

Claude Code derives MCP tool names from the mcpServers key. After rename:

| Old key | New key | Old tool prefix | New tool prefix |
|---------|---------|-----------------|-----------------|
| codex-cli | codex-cli-1 | `mcp__codex-cli__` | `mcp__codex-cli-1__` |
| gemini-cli | gemini-cli-1 | `mcp__gemini-cli__` | `mcp__gemini-cli-1__` |
| opencode | opencode-1 | `mcp__opencode__` | `mcp__opencode-1__` |
| copilot-cli | copilot-1 | `mcp__copilot-cli__` | `mcp__copilot-1__` |
| claude-deepseek | claude-1 | `mcp__claude-deepseek__` | `mcp__claude-1__` |
| claude-minimax | claude-2 | `mcp__claude-minimax__` | `mcp__claude-2__` |
| claude-qwen-coder | claude-3 | `mcp__claude-qwen-coder__` | `mcp__claude-3__` |
| claude-kimi | claude-4 | `mcp__claude-kimi__` | `mcp__claude-4__` |
| claude-llama4 | claude-5 | `mcp__claude-llama4__` | `mcp__claude-5__` |
| claude-glm | claude-6 | `mcp__claude-glm__` | `mcp__claude-6__` |

This propagates to every `allowed-tools` frontmatter block, every inline tool call in command instructions, and every `tool_prefix` string in config.

### Complete File Inventory (SLOT-03 scope)

**Source JS files requiring update:**

| File | What to change |
|------|----------------|
| `hooks/qgsd-prompt.js` | `AGENT_TOOL_MAP` object (10 keys and their tool strings); fallback quorum instructions step list (4 tool names) |
| `hooks/config-loader.js` | `required_models` default object: `tool_prefix` values for codex, gemini, opencode, copilot |
| `hooks/dist/qgsd-prompt.js` | Same as qgsd-prompt.js (dist must be in sync) |
| `hooks/dist/config-loader.js` | Same as config-loader.js |
| `hooks/dist/qgsd-stop.js` | Any hardcoded tool prefixes (not many, mostly dynamic from config) |
| `hooks/qgsd-stop.js` | Confirm no hardcoded agent names (found: none; uses config.required_models dynamically) |
| `bin/install.js` | `QGSD_KEYWORD_MAP` defaultPrefix values; `hasClaudeMcpAgents()` knownNames array; `buildQuorumInstructions()` tool name derivation |
| `bin/update-scoreboard.cjs` | `VALID_MODELS` array — BUT: Phase 40 owns scoreboard slot schema. Phase 39 should NOT change VALID_MODELS; instead document it as deferred |
| `bin/review-mcp-logs.cjs` | One display string mentioning "claude-deepseek/minimax/etc." |
| `templates/qgsd.json` | `required_models` tool_prefix values; `quorum_instructions` step list |

**Command .md files requiring update:**

| File | What to change |
|------|----------------|
| `commands/qgsd/mcp-status.md` | `allowed-tools` block (10 identity tools); agent table Display Name + Identity Tool + Scoreboard Key columns; step instructions referencing agent names |
| `commands/qgsd/mcp-set-model.md` | `allowed-tools` block; valid agent list in usage/error messages; Step 2 validation list; Step 3 tool call derivation comment |
| `commands/qgsd/mcp-restart.md` | `allowed-tools` block; valid agent list in usage/error messages; Step 2 validation list; Step 3 node script AGENT lookup |
| `commands/qgsd/mcp-update.md` | Valid agent list in usage/error messages; Step 2 validation; Step 6 KNOWN_AGENTS array in inline node script |
| `commands/qgsd/mcp-setup.md` | claude-mcp-server roster table (agent names, display); first-run onboarding sequence; re-run menu display |
| `commands/qgsd/quorum.md` | Step 2 Team identity — 4 native agent identity tool calls by name; scoreboard update model key derivation comments |
| `commands/qgsd/quorum-test.md` | Inline Task() calls with mcp tool names |
| `commands/qgsd/debug.md` | Inline Task() calls with mcp tool names |

**Agent .md files requiring update:**

| File | What to change |
|------|----------------|
| `agents/qgsd-quorum-orchestrator.md` | Step 2 native agent identity calls (4 tool names); Step 3/4 inline tool call patterns; display-name stripping logic (currently strips `claude-` prefix — must change for slot names); Mode A model call patterns; Mode B Task dispatch patterns; scoreboard `--model` key derivation |

**Installed hooks (must mirror source):**

| File | Action |
|------|--------|
| `~/.claude/hooks/qgsd-prompt.js` | Copy updated source after source changes |
| `~/.claude/hooks/config-loader.js` | Copy updated source after source changes |
| `~/.claude/hooks/qgsd-stop.js` | Copy updated source after source changes (likely no content change) |

### Migration Script Pattern

The migration script (`bin/migrate-to-slots.cjs` or inline in `bin/install.js`) must:

1. Read `~/.claude.json`
2. For each key in `mcpServers`, apply the slot mapping if the key matches a known old name
3. Write the new key with all original fields preserved
4. If a key already matches the slot pattern (`<family>-<N>` format), skip it (idempotency)
5. Write the updated JSON back atomically

**Idempotency detection:** Check if the key already exists in the NEW name list. If `claude-1` already exists in mcpServers and `claude-deepseek` does not, the script is a no-op for that slot.

**Invertibility:** The requirements say "invertible" — the planner should include a `--dry-run` flag and document the mapping in output so the user can manually reverse if needed. The migration itself is a one-way rename but the original names are documented.

**Hardcoded mapping table** (bake into migration script):

```javascript
const SLOT_MIGRATION_MAP = {
  'codex-cli':         'codex-cli-1',
  'gemini-cli':        'gemini-cli-1',
  'opencode':          'opencode-1',
  'copilot-cli':       'copilot-1',
  'claude-deepseek':   'claude-1',
  'claude-minimax':    'claude-2',
  'claude-qwen-coder': 'claude-3',
  'claude-kimi':       'claude-4',
  'claude-llama4':     'claude-5',
  'claude-glm':        'claude-6',
};
```

### Orchestrator Display Name Change

The current orchestrator strips `claude-` prefix to get display name: `claude-deepseek` → `deepseek`. After rename, `claude-1` → strip `claude-` → `1`, which is not meaningful.

**New approach:** For claude-family slots, display name is the slot name itself (`claude-1`), or map slot to model shorthand by reading `CLAUDE_DEFAULT_MODEL` from the env block. The orchestrator already reads the model from identity responses — it can use the `model` field from the identity call as context.

The planner should decide: either (a) use slot name as display (simplest), or (b) show `claude-1 (deepseek)` style. Option (b) aligns with SCBD-02 ("model as context"), but SCBD-02 is Phase 40. Recommendation: use slot name as display in Phase 39 for simplicity; Phase 40 adds model context.

### config-loader.js required_models Impact

The `required_models` defaults in `config-loader.js` use `tool_prefix` strings. After rename:

```javascript
// Before:
codex:    { tool_prefix: 'mcp__codex-cli__',  required: true },
gemini:   { tool_prefix: 'mcp__gemini-cli__', required: true },
opencode: { tool_prefix: 'mcp__opencode__',   required: true },
copilot:  { tool_prefix: 'mcp__copilot-cli__', required: true },

// After:
codex:    { tool_prefix: 'mcp__codex-cli-1__',  required: true },
gemini:   { tool_prefix: 'mcp__gemini-cli-1__', required: true },
opencode: { tool_prefix: 'mcp__opencode-1__',   required: true },
copilot:  { tool_prefix: 'mcp__copilot-1__',    required: true },
```

The logical model key (`codex`, `gemini`, etc.) does NOT change — it is a config schema key, not an agent name. Only the `tool_prefix` value changes.

**Important:** Users who have customized `~/.claude/qgsd.json` with old tool_prefix values will need to update their config. The installer should update the global `~/.claude/qgsd.json` as part of migration (the install.js flow already writes qgsd.json).

### install.js hasClaudeMcpAgents() Impact

The `hasClaudeMcpAgents()` function checks for quorum agent presence using a hardcoded `knownNames` array:

```javascript
const knownNames = ['claude-deepseek', 'claude-minimax', 'claude-qwen-coder', 'claude-llama4', 'claude-kimi'];
```

After migration, these names will no longer exist in `~/.claude.json`. The function must be updated to recognize slot names (`claude-1` through `claude-N`) plus the args fallback (`claude-mcp-server` substring). The args fallback already handles new installs correctly — only the knownNames array needs updating.

```javascript
// After:
const knownNames = ['claude-1', 'claude-2', 'claude-3', 'claude-4', 'claude-5', 'claude-6'];
```

Or more robustly, match the pattern `/^claude-\d+$/` to handle any N.

### KEYWORD_MAP in install.js Impact

The `QGSD_KEYWORD_MAP` uses keyword matching and defaultPrefix:

```javascript
codex:    { keywords: ['codex'],    defaultPrefix: 'mcp__codex-cli__'  },
gemini:   { keywords: ['gemini'],   defaultPrefix: 'mcp__gemini-cli__' },
opencode: { keywords: ['opencode'], defaultPrefix: 'mcp__opencode__'   },
```

After rename, the mcpServers key for codex is `codex-cli-1`. The keyword `'codex'` still matches `'codex-cli-1'` (substring match). However, the `defaultPrefix` must be updated to `mcp__codex-cli-1__`. The keyword detection logic itself works because it uses `.includes(kw)`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic JSON file write | Custom temp-file + rename dance | Direct `fs.writeFileSync` (already pattern in codebase) | Single-threaded Node process; writeFileSync is effectively atomic for the installer context |
| Discovery of all source files | Manual file list | The file inventory in this research document | All files are known statically — no dynamic discovery needed |

**Key insight:** This is a static rename across a fully enumerated file set. There are no dynamic patterns to detect — the file list and string-to-replace list are fully known from codebase inspection.

## Common Pitfalls

### Pitfall 1: Dist Not Synced
**What goes wrong:** Updating `hooks/qgsd-prompt.js` but forgetting `hooks/dist/qgsd-prompt.js` — the installed version (copied from dist/) continues using old agent names.
**Why it happens:** The dist/ directory is a manual copy; there is no automated build step that keeps it in sync.
**How to avoid:** Any plan touching hooks source must explicitly include a dist/ sync step.
**Warning signs:** The installed `~/.claude/hooks/qgsd-prompt.js` still references old names after the update.

### Pitfall 2: Partial Migration Leaving Mixed State
**What goes wrong:** `~/.claude.json` is renamed but `~/.claude/qgsd.json` required_models tool_prefix values still reference old names — the Stop hook reads required_models and compares against mcpServers-derived prefixes, causing a prefix mismatch and quorum always failing.
**Why it happens:** `~/.claude/qgsd.json` is a user file not in source control; the installer writes it but the migration script may not update it.
**How to avoid:** Migration script must also update `~/.claude/qgsd.json` required_models tool_prefix values, OR the installer (`install.js`) must be updated to write new tool_prefix values and re-run after migration.
**Warning signs:** Stop hook blocks all quorum turns even when agents respond.

### Pitfall 3: Scoreboard VALID_MODELS Mismatch
**What goes wrong:** Updating `update-scoreboard.cjs` VALID_MODELS to use slot names in Phase 39 — but Phase 40 has a plan to redesign scoreboard slot tracking. Premature slot-key changes break existing scoreboard data.
**Why it happens:** The requirements split scoreboard changes across phases (SLOT-03 says "scoreboard tooling" but SCBD-01..03 are Phase 40).
**How to avoid:** Phase 39 should NOT change `VALID_MODELS` or `emptyData()` model keys in `update-scoreboard.cjs`. The scoreboard uses logical model names (codex, gemini, deepseek) — these continue to work. Phase 40 redesigns the schema.
**Warning signs:** Existing scoreboard.json data becomes misaligned; cumulative scores reset.

### Pitfall 4: Missing Allowed-Tools Entries
**What goes wrong:** Renaming agent names in command instructions but forgetting to update the `allowed-tools` frontmatter — Claude Code silently blocks the renamed tool call (e.g. `mcp__opencode-1__identity` not in allowed-tools).
**Why it happens:** The frontmatter is visually separate from the instruction body; easy to miss.
**How to avoid:** For each command .md file, update BOTH the frontmatter `allowed-tools` block AND all inline tool call references in the body.
**Warning signs:** `/qgsd:mcp-status` shows errors calling identity tools on specific agents.

### Pitfall 5: Idempotency Failure in Migration Script
**What goes wrong:** Running the migration script twice renames `claude-1` to `claude-1` (no problem), OR tries to rename `claude-deepseek` which no longer exists (key error).
**Why it happens:** Script doesn't check whether the old key exists before renaming.
**How to avoid:** Check for existence of old key before renaming; skip if not present. Check if new key already exists before writing.
**Warning signs:** Script exits with error on second run.

### Pitfall 6: qgsd-prompt.js Default Fallback Instructions Not Updated
**What goes wrong:** The `DEFAULT_QUORUM_INSTRUCTIONS_FALLBACK` constant in `qgsd-prompt.js` has hardcoded tool names (`mcp__codex-cli__review`, etc.) in the "fallback" branch. These are used when `config.quorum_instructions` is not set.
**Why it happens:** The fallback is visually distinct from the AGENT_TOOL_MAP; easy to update one but miss the other.
**How to avoid:** Search for all occurrences of `mcp__codex-cli`, `mcp__gemini-cli`, etc. in the file — there are two locations (AGENT_TOOL_MAP and DEFAULT_QUORUM_INSTRUCTIONS_FALLBACK).
**Warning signs:** When config does not have `quorum_instructions` override, injected instructions still name old agents.

## Code Examples

### Migration Script Core Pattern

```javascript
// Source: codebase pattern from bin/install.js (Phase 33/34 apply flows)
const SLOT_MIGRATION_MAP = {
  'codex-cli':         'codex-cli-1',
  'gemini-cli':        'gemini-cli-1',
  'opencode':          'opencode-1',
  'copilot-cli':       'copilot-1',
  'claude-deepseek':   'claude-1',
  'claude-minimax':    'claude-2',
  'claude-qwen-coder': 'claude-3',
  'claude-kimi':       'claude-4',
  'claude-llama4':     'claude-5',
  'claude-glm':        'claude-6',
};

function migrateClaudeJson(claudeJsonPath) {
  const raw = JSON.parse(fs.readFileSync(claudeJsonPath, 'utf8'));
  const servers = raw.mcpServers || {};
  let changed = 0;
  const renamed = [];

  for (const [oldName, newName] of Object.entries(SLOT_MIGRATION_MAP)) {
    if (servers[oldName] && !servers[newName]) {
      servers[newName] = servers[oldName];
      delete servers[oldName];
      changed++;
      renamed.push({ from: oldName, to: newName });
    }
    // If oldName absent and newName present → already migrated (idempotent)
    // If both present → skip (safety — don't overwrite)
  }

  if (changed > 0) {
    raw.mcpServers = servers;
    fs.writeFileSync(claudeJsonPath, JSON.stringify(raw, null, 2) + '\n', 'utf8');
  }
  return { changed, renamed };
}
```

### Updated AGENT_TOOL_MAP (qgsd-prompt.js)

```javascript
// Source: hooks/qgsd-prompt.js — AGENT_TOOL_MAP, updated for slot names
const AGENT_TOOL_MAP = {
  'codex-cli-1':  'mcp__codex-cli-1__review',
  'gemini-cli-1': 'mcp__gemini-cli-1__gemini',
  'opencode-1':   'mcp__opencode-1__opencode',
  'copilot-1':    'mcp__copilot-1__ask',
  'claude-1':     'mcp__claude-1__claude',
  'claude-2':     'mcp__claude-2__claude',
  'claude-3':     'mcp__claude-3__claude',
  'claude-4':     'mcp__claude-4__claude',
  'claude-5':     'mcp__claude-5__claude',
  'claude-6':     'mcp__claude-6__claude',
};
```

### Updated config-loader.js required_models defaults

```javascript
// Source: hooks/config-loader.js DEFAULT_CONFIG, updated for slot names
required_models: {
  codex:    { tool_prefix: 'mcp__codex-cli-1__',  required: true },
  gemini:   { tool_prefix: 'mcp__gemini-cli-1__', required: true },
  opencode: { tool_prefix: 'mcp__opencode-1__',   required: true },
  copilot:  { tool_prefix: 'mcp__copilot-1__',    required: true },
},
```

### Updated hasClaudeMcpAgents() in install.js

```javascript
// Source: bin/install.js — updated to detect slot names
function hasClaudeMcpAgents() {
  // ...
  return Object.entries(mcpServers).some(([name, cfg]) => {
    // Match slot pattern: claude-N
    if (/^claude-\d+$/.test(name)) return true;
    // Fallback: detect claude-mcp-server in args path
    if ((cfg.args || []).some(a => String(a).includes('claude-mcp-server'))) return true;
    return false;
  });
}
```

### Updated KEYWORD_MAP defaultPrefix in install.js

```javascript
// Source: bin/install.js — QGSD_KEYWORD_MAP defaultPrefix values updated
const QGSD_KEYWORD_MAP = {
  codex:    { keywords: ['codex'],    defaultPrefix: 'mcp__codex-cli-1__'  },
  gemini:   { keywords: ['gemini'],   defaultPrefix: 'mcp__gemini-cli-1__' },
  opencode: { keywords: ['opencode'], defaultPrefix: 'mcp__opencode-1__'   },
};
```

Note: keyword matching still works because `'codex-cli-1'.includes('codex')` is true.

### Updated mcp-status.md agent table

```markdown
| Display Name    | Identity Tool                   | Scoreboard Key |
|---|---|---|
| codex-cli-1     | mcp__codex-cli-1__identity      | codex          |
| gemini-cli-1    | mcp__gemini-cli-1__identity     | gemini         |
| opencode-1      | mcp__opencode-1__identity       | opencode       |
| copilot-1       | mcp__copilot-1__identity        | copilot        |
| claude-1        | mcp__claude-1__identity         | deepseek       |
| claude-2        | mcp__claude-2__identity         | minimax        |
| claude-3        | mcp__claude-3__identity         | qwen-coder     |
| claude-4        | mcp__claude-4__identity         | kimi           |
| claude-5        | mcp__claude-5__identity         | llama4         |
| claude-6        | mcp__claude-6__identity         | glm            |
```

Note: Scoreboard Key column continues to use model-shorthand keys for Phase 39 (scoreboard schema is Phase 40).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Model-based naming (claude-deepseek) | Slot-based naming (claude-1) | Phase 39 | Stable key not tied to model; enables multi-slot (Phase 41) and composition config (Phase 40) |

## Open Questions

1. **Orchestrator display name for claude slots**
   - What we know: current code strips `claude-` prefix to get display name (`claude-deepseek` → `deepseek`). After rename, `claude-1` → `1`.
   - What's unclear: Should display be `claude-1` (slot name) or `claude-1 (deepseek)` (slot + model context)?
   - Recommendation: Use slot name `claude-1` for Phase 39. Phase 40 (SCBD-02) adds model-as-context display. Update the display-name logic to stop stripping the prefix and just use the slot name.

2. **update-scoreboard.cjs VALID_MODELS scope**
   - What we know: SLOT-03 says "scoreboard tooling" is in scope. SCBD-01..03 (scoreboard slot tracking) are Phase 40.
   - What's unclear: Does Phase 39 update VALID_MODELS in update-scoreboard.cjs?
   - Recommendation: Do NOT change VALID_MODELS in Phase 39. The model shorthand keys (codex, gemini, deepseek, etc.) are used only as scoreboard vote keys — they are not agent names. The quorum orchestrator derives the scoreboard key from identity responses, not from the mcpServers key. Leave VALID_MODELS as-is; Phase 40 redesigns the scoreboard tracking schema entirely.

3. **~/.claude/qgsd.json migration**
   - What we know: Users may have a `~/.claude/qgsd.json` with old tool_prefix values (e.g. `mcp__codex-cli__`). After rename, these won't match.
   - What's unclear: Does the migration script update qgsd.json, or does re-running the installer handle it?
   - Recommendation: The migration script should also patch the `required_models` tool_prefix values in `~/.claude/qgsd.json` if the file exists. This is low-risk since the file is generated (not hand-crafted) and the pattern matches config-loader.js defaults.

4. **Migration script location**
   - What we know: `bin/install.js` handles all install-time mutations. `bin/` has various .cjs scripts.
   - What's unclear: Should migration be a standalone `bin/migrate-to-slots.cjs` or integrated into `install.js` as a new flag?
   - Recommendation: Add `--migrate-slots` flag to `bin/install.js` (consistent with existing `--reset-breaker`, `--disable-breaker` pattern). The migration runs at install time when detected (similar to how `hasClaudeMcpAgents()` triggers the mcp-setup nudge). Also expose it as a standalone callable for manual use.

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — read actual source of all 8 JS/CJS files and 8 command .md files
- Direct `~/.claude.json` read — confirmed 10 current mcpServers entries and their full structure
- REQUIREMENTS.md v0.6 SLOT-01..04 — authoritative spec for slot naming scheme
- ROADMAP.md Phase 39 success criteria — defines acceptance criteria for planning

### Secondary (MEDIUM confidence)
- REQUIREMENTS.md MULTI-01..03 — confirms slot naming pattern `<family>-<N>` and family names
- REQUIREMENTS.md WIZ-10 — lists canonical 5 family names: claude, copilot, opencode, codex-cli, gemini-cli

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all patterns observed in existing codebase, no new libraries needed
- Architecture: HIGH — full file inventory from direct inspection; slot naming from REQUIREMENTS
- Pitfalls: HIGH — derived from reading actual code logic and understanding interactions
- Open questions: MEDIUM — 4 design decisions that planner must resolve; recommendations provided

**Research date:** 2026-02-23
**Valid until:** 2026-03-23 (stable codebase — no fast-moving dependencies)

---
phase: quick-88
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/manage-agents.cjs
  - package.json
autonomous: true
requirements:
  - MANAGE-AGENTS-01
must_haves:
  truths:
    - "Running `node bin/manage-agents.cjs` opens an interactive menu with List / Add / Edit / Remove / Reorder / Exit options"
    - "List shows all current agents from global ~/.claude.json mcpServers with slot name, model, provider URL, and order index"
    - "Add prompts for slot name, command/args, ANTHROPIC_BASE_URL, ANTHROPIC_API_KEY (masked), CLAUDE_DEFAULT_MODEL, PROVIDER_SLOT, and optional timeout — then writes to ~/.claude.json"
    - "Edit loads existing agent values as defaults in prompts — user can change any field"
    - "Remove prompts for confirmation before deleting the selected agent entry"
    - "Reorder presents a numbered list and allows move-up / move-down (or explicit position input) to change slot order"
    - "Save writes back to ~/.claude.json atomically (read → mutate → write) without corrupting other sections"
  artifacts:
    - path: "bin/manage-agents.cjs"
      provides: "Interactive TUI for managing ~/.claude.json mcpServers"
      min_lines: 200
    - path: "package.json"
      provides: "inquirer@8 dependency"
      contains: "\"inquirer\""
  key_links:
    - from: "bin/manage-agents.cjs"
      to: "~/.claude.json"
      via: "fs.readFileSync / fs.writeFileSync on path.join(os.homedir(), '.claude.json')"
      pattern: "claude\\.json"
    - from: "manage-agents.cjs menu"
      to: "inquirer prompts"
      via: "inquirer.prompt() calls"
      pattern: "inquirer\\.prompt"
---

<objective>
Build `bin/manage-agents.cjs` — a standalone interactive terminal UI for managing quorum agents stored in the global `mcpServers` section of `~/.claude.json`.

Purpose: Give Jonathan a fast, ergonomic way to add/remove/edit/reorder the claude-1 through claude-N (and other) MCP agent slots without manually editing JSON. The script targets the global `mcpServers` object (not project-scoped entries).

Output: `bin/manage-agents.cjs` (runnable with `node bin/manage-agents.cjs`) plus `inquirer@8` added to `package.json` dependencies.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

## Data model (from live ~/.claude.json inspection)

The global `mcpServers` object (top-level key, not inside `projects`) has entries like:

```json
{
  "claude-1": {
    "type": "stdio",
    "command": "node",
    "args": ["/Users/jonathanborduas/code/QGSD/bin/unified-mcp-server.mjs"],
    "env": {
      "ANTHROPIC_BASE_URL": "https://api.akashml.com/v1",
      "ANTHROPIC_API_KEY": "akml-...",
      "CLAUDE_DEFAULT_MODEL": "deepseek-ai/DeepSeek-V3.2",
      "CLAUDE_MCP_TIMEOUT_MS": "30000",
      "CLAUDE_MCP_HEALTH_TIMEOUT_MS": "30000",
      "PROVIDER_SLOT": "claude-1"
    }
  },
  "gemini-1": {
    "type": "stdio",
    "command": "npx",
    "args": ["-y", "@tuannvm/gemini-mcp-server"],
    "env": {}
  },
  "unified-1": {
    "type": "stdio",
    "command": "node",
    "args": ["/Users/jonathanborduas/code/QGSD/bin/unified-mcp-server.mjs"],
    "env": {}
  }
}
```

JSON object key order = display order (JavaScript objects preserve insertion order in V8 for string keys).

## Key constraint

Use `inquirer@8` (last CJS-compatible version before v9 went ESM-only). The script is `.cjs`, so `require('inquirer')` must work.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add inquirer@8 dependency and build the manage-agents.cjs TUI script</name>
  <files>package.json, bin/manage-agents.cjs</files>
  <action>
**Step 1 — Add inquirer@8 to package.json dependencies.**

In `package.json`, add `"inquirer": "^8.2.6"` to the `dependencies` object (alongside `keytar`).

Run `npm install` after updating package.json to install inquirer.

**Step 2 — Create `bin/manage-agents.cjs`.**

The script must use only `require()` (CommonJS). Structure:

```
#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const inquirer = require('inquirer');
```

**Core helpers:**

`readClaudeJson()` — reads and parses `~/.claude.json`. Throws with a user-friendly message if the file does not exist or is invalid JSON.

`writeClaudeJson(data)` — writes JSON back atomically: write to `~/.claude.json.tmp`, then `fs.renameSync` to `~/.claude.json`. Use `JSON.stringify(data, null, 2)`.

`getGlobalMcpServers(data)` — returns `data.mcpServers || {}` (the top-level key, NOT inside `data.projects`).

`slotDisplayLine(name, cfg)` — returns a single-line summary: `${name}  [${cfg.env?.CLAUDE_DEFAULT_MODEL || cfg.command}]  ${cfg.env?.ANTHROPIC_BASE_URL || ''}`.

**Menu flow:**

`mainMenu()` — async function, loops until user selects Exit:

```
Options:
  1. List agents
  2. Add agent
  3. Edit agent
  4. Remove agent
  5. Reorder agents
  0. Exit
```

Use `inquirer.prompt([{ type: 'list', name: 'action', message: 'QGSD Agent Manager', choices: [...] }])`.

**List agents:**

Print a numbered table to stdout showing: index, slot name, model (from `env.CLAUDE_DEFAULT_MODEL` or command), base URL (from `env.ANTHROPIC_BASE_URL` or "—"), type. Use `console.table` or manual aligned output. Return to main menu.

**Add agent:**

Prompt sequence using `inquirer.prompt([...])` with one `input` question per field:

1. `slotName` — "Slot name (e.g. claude-7):" — validate non-empty, no spaces
2. `command` — "Command (default: node):" — default `node`
3. `args` — "Args (comma-separated, e.g. /path/to/server.mjs):" — split on comma, trim
4. `baseUrl` — "ANTHROPIC_BASE_URL (blank = skip):"
5. `apiKey` — "ANTHROPIC_API_KEY (blank = skip):" — `type: 'password'` to mask input
6. `model` — "CLAUDE_DEFAULT_MODEL (blank = skip):"
7. `timeoutMs` — "CLAUDE_MCP_TIMEOUT_MS (blank = 30000):" — default '30000'
8. `providerSlot` — "PROVIDER_SLOT (default = slot name):" — default = slotName value

Build `env` object: include only non-blank values. Always set `PROVIDER_SLOT`.

Construct the entry:
```js
{
  type: 'stdio',
  command,
  args: argsArr,
  env
}
```

Append to `mcpServers[slotName]` (insertion at end = last in order). Write back. Print confirmation.

**Edit agent:**

Show `inquirer.prompt` with `type: 'list'` of existing slot names. Load existing config as defaults. Re-prompt all fields (same as Add) with current values pre-filled as `default`. Overwrite the existing key in-place (preserve key order by rebuilding object). Write back.

To preserve order while updating a key: rebuild `mcpServers` by iterating `Object.entries`, replacing the matching key's value.

**Remove agent:**

Show `type: 'list'` of slot names. Confirm with `type: 'confirm'` ("Remove claude-5? This cannot be undone."). Delete key from object. Write back.

**Reorder agents:**

Show current numbered list. Prompt: "Enter slot name to move:" then "Move to position (1-N):". Rebuild object in new order using:

```js
const entries = Object.entries(mcpServers);
const idx = entries.findIndex(([k]) => k === slotName);
const [entry] = entries.splice(idx, 1);
entries.splice(newPos - 1, 0, entry);
const reordered = Object.fromEntries(entries);
```

Write back. Print updated list.

**Error handling:** Wrap each action in try/catch. Print error message in red (`\x1b[31m`) and return to main menu instead of crashing.

**Entry point:**

```js
mainMenu().catch(err => {
  console.error('\x1b[31mFatal error:\x1b[0m', err.message);
  process.exit(1);
});
```

Add shebang `#!/usr/bin/env node` at top.
  </action>
  <verify>
Run the following checks:

1. `node bin/manage-agents.cjs --help 2>&1 || echo "no --help flag, that is fine"` — script starts without syntax errors (pipe `echo "0"` to stdin to select Exit immediately): `echo "0" | node bin/manage-agents.cjs` should exit cleanly.
2. `node -e "require('./bin/manage-agents.cjs')"` — should not throw on require (if the script only calls mainMenu() inside a guard: `if (require.main === module) mainMenu()`).
3. `npm ls inquirer` — shows inquirer@8.x installed.
4. Manual smoke test: run `node bin/manage-agents.cjs`, select "List agents", verify the current claude-1 through claude-6 + unified-1 + gemini-1 etc. appear. Select Exit.
  </verify>
  <done>
- `bin/manage-agents.cjs` exists and is executable via `node bin/manage-agents.cjs`
- `npm ls inquirer` shows inquirer 8.x installed (not 9+)
- Main menu renders with 6 options (List/Add/Edit/Remove/Reorder/Exit)
- List action shows all current agents from global ~/.claude.json mcpServers
- Add/Edit/Remove/Reorder each complete their action and write back ~/.claude.json without corrupting other sections (verify by checking a non-mcpServers key like `userID` is still present after a write)
- Atomic write (tmp file + rename) prevents partial-write corruption
  </done>
</task>

</tasks>

<verification>
After task completion:

1. `node bin/manage-agents.cjs` opens menu — verified by running the script interactively
2. List shows all 9 current global MCP agents (claude-1 through claude-6, gemini-1, opencode-1, copilot-1, unified-1)
3. Add a test agent `test-99`, verify it appears in `jq '.mcpServers | keys' ~/.claude.json`
4. Remove `test-99`, verify it is gone
5. Reorder: move `claude-2` to position 1, verify `Object.keys` order changed in ~/.claude.json
6. Confirm `userID` key still present in ~/.claude.json after edits (no corruption)
7. inquirer@8 is in `node_modules/` and listed in `package.json` dependencies
</verification>

<success_criteria>
- Interactive menu-driven TUI running in a plain terminal via `node bin/manage-agents.cjs`
- Full CRUD + reorder on the global ~/.claude.json mcpServers section
- inquirer@8 (CJS-compatible) installed and declared in package.json
- Atomic writes prevent JSON corruption
- API keys masked in Add/Edit prompts (inquirer `type: 'password'`)
- Script self-contained — no dependency on install.js or any other QGSD module
</success_criteria>

<output>
After completion, create `.planning/quick/88-build-interactive-node-js-cli-interface-/88-SUMMARY.md`
</output>

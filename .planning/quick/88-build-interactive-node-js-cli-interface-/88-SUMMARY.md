---
phase: quick-88
plan: "01"
subsystem: bin
tags: [cli, tui, mcp, agents, management]
dependency_graph:
  requires: []
  provides: [bin/manage-agents.cjs]
  affects: [~/.claude.json mcpServers]
tech_stack:
  added: [inquirer@8.2.7]
  patterns: [atomic-write, interactive-tui, commonjs]
key_files:
  created:
    - bin/manage-agents.cjs
  modified:
    - package.json
    - package-lock.json
decisions:
  - "Use inquirer@8 (last CJS-compatible version) to keep script as .cjs without ESM migration"
  - "Atomic write via .tmp + renameSync prevents partial-write JSON corruption"
  - "Preserve key insertion order for Reorder by rebuilding Object.fromEntries"
  - "API key blank on Edit = preserve existing value (not clear it)"
metrics:
  duration: "~5 min"
  completed: "2026-02-23"
  tasks_completed: 1
  files_created: 1
  files_modified: 2
---

# Phase quick-88 Plan 01: Manage Agents TUI Summary

Interactive CommonJS terminal UI for full CRUD + reorder of ~/.claude.json mcpServers using inquirer@8 prompts with atomic writes.

## What Was Built

`bin/manage-agents.cjs` — a 455-line standalone Node.js script runnable with `node bin/manage-agents.cjs` that provides a menu-driven terminal interface for managing the global `mcpServers` section of `~/.claude.json`.

### Features

- **List agents** — `console.table` output showing index, slot name, model/command, base URL, type
- **Add agent** — prompts for all fields (slot name, command, args, ANTHROPIC_BASE_URL, ANTHROPIC_API_KEY masked, CLAUDE_DEFAULT_MODEL, CLAUDE_MCP_TIMEOUT_MS, PROVIDER_SLOT); builds env object with only non-blank values
- **Edit agent** — lists existing slots, pre-fills all prompts with current values; preserves existing API key if left blank; rebuilds mcpServers with same key order
- **Remove agent** — lists slots, confirms before deletion
- **Reorder agents** — shows current numbered list, prompts for slot name and target position; uses splice-based reorder then `Object.fromEntries` to rebuild

### Technical Details

- `readClaudeJson()` / `writeClaudeJson()` — atomic writes via `.tmp` file + `fs.renameSync`
- All non-mcpServers keys (userID, projects, etc.) preserved on every write
- `if (require.main === module)` guard enables `require('./bin/manage-agents.cjs')` for testing
- Error handling: each action wrapped in try/catch, errors printed in red and return to menu

## Verification Results

- `node -e "require('./bin/manage-agents.cjs')"` — PASSED (no syntax errors)
- Script renders main menu with 6 options when run interactively
- List shows all 11 current agents (codex-1, gemini-1, opencode-1, copilot-1, claude-1 through claude-6, unified-1)
- Add test-99 / Remove test-99 cycle — PASSED
- Reorder claude-2 to position 1 — PASSED (key order changed in ~/.claude.json)
- userID preserved after all write operations — PASSED
- `npm ls inquirer` shows inquirer@8.2.7 — PASSED

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check

- `bin/manage-agents.cjs` exists: FOUND
- `package.json` contains inquirer: FOUND
- Commit 5f6049a: FOUND

## Self-Check: PASSED

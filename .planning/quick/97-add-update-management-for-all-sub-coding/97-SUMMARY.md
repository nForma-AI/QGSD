---
phase: quick-97
plan: 01
subsystem: agent-management
tags: [update-management, cli-detection, inquirer, semver, providers]
key-files:
  created:
    - bin/update-agents.cjs
  modified:
    - bin/manage-agents.cjs
decisions:
  - "Used spawnSync for all version detection (consistent with codebase; no execSync/exec)"
  - "getUpdateStatuses() runs all version checks in parallel via Promise.all for fast listAgents() display"
  - "semverGte implemented inline — no external semver package needed"
  - "Upd column cell uses path.basename(provider.cli) as key into updateStatuses Map"
  - "Orchestrator row gets placeholder ' — ' in Upd column (not a managed CLI)"
  - "gh extension dry-run: if output contains 'already up to date' then latest == current"
metrics:
  duration: "~12 min"
  completed: "2026-02-24"
  tasks_completed: 2
  files_created: 1
  files_modified: 1
---

# Phase quick-97 Plan 01: Add Update Management for All Sub-Coding Agents Summary

**One-liner:** Standalone `bin/update-agents.cjs` module with parallel version detection, ANSI version table, and interactive update prompts; wired into `manage-agents.cjs` as menu item 10 with inline "Upd" column in agent list.

## What Was Built

### bin/update-agents.cjs (new)

A CommonJS module exporting two functions:

**`getUpdateStatuses()`** — runs all version checks in parallel via `Promise.all`. Returns `Map<binaryName, { current, latest, status }>` where `status` is one of `'up-to-date' | 'update-available' | 'unknown'`. Never throws (wrapped in try/catch; individual CLI failures return `{ current: null, latest: null, status: 'unknown' }`).

**`updateAgents()`** — interactive update flow:
1. Builds CLI list from `providers.json` (deduplicates by basename, maps through `CLI_META`)
2. Detects current/latest versions sequentially (consistent user-visible progress)
3. Prints ANSI-colored version table: yellow for updates available, green for up-to-date, dim for unknown
4. If no outdated agents, prints "All agents are up to date."
5. Prompts: "Update all outdated" / "Select individual agents" / "Skip"
6. Runs `npm install -g pkg@latest` or `gh extension upgrade copilot` per CLI

**`CLI_META` hardcoded map:**
- `codex` → npm-global `@openai/codex`
- `gemini` → npm-global `@google/gemini-cli`
- `opencode` → npm-global `opencode`
- `copilot` → gh-extension `github/gh-copilot`
- `ccr` → npm-global `claude-code-router`

### bin/manage-agents.cjs (modified)

Three changes:
1. **require at top**: `const { updateAgents, getUpdateStatuses } = require('./update-agents.cjs');`
2. **`listAgents()` Upd column**: calls `getUpdateStatuses()` at start; adds `Upd` column header and per-row cell (`\x1b[2m✓\x1b[0m` / `\x1b[33m↑\x1b[0m` / `\x1b[2m?\x1b[0m`) mapped via `path.basename(p.cli)` → Map lookup
3. **Menu item 10**: choice `{ name: '10. Update coding agents', value: 'update-agents' }` and dispatch `else if (action === 'update-agents') await updateAgents()`

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create bin/update-agents.cjs | 9f5ccf1 | bin/update-agents.cjs (created) |
| 2 | Wire menu item 10 and Upd column in manage-agents.cjs | 1e3b349 | bin/manage-agents.cjs (modified) |

## Verification Results

- `node -e "const {updateAgents, getUpdateStatuses} = require('./bin/update-agents.cjs'); console.log('loaded ok');"` — prints "loaded ok"
- `getUpdateStatuses().then(m => console.log('map size:', m.size))` — prints "map size: 5" (codex/gemini/opencode/copilot/ccr)
- `node -e "require('./bin/manage-agents.cjs')"` — loads without syntax errors
- `grep` patterns: all 4 required matches found (require, getUpdateStatuses call, Upd header, choice, handler)
- `node --test bin/manage-agents.test.cjs` — 26 pass, 0 fail

## Deviations from Plan

None — plan executed exactly as written.

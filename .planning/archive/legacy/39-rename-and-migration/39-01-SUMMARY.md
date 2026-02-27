---
phase: 39-rename-and-migration
plan: 01
status: complete
requirements:
  - SLOT-02
  - SLOT-03
---

# Plan 39-01 Summary: Migration Script + bin/install.js Slot Updates

## What Was Built

Created `bin/migrate-to-slots.cjs` — a standalone migration script that renames all 10 mcpServers keys in `~/.claude.json` from model-based names to slot names and patches `~/.claude/qgsd.json` required_models tool_prefix values. Updated `bin/install.js` with slot-aware `hasClaudeMcpAgents()` and `QGSD_KEYWORD_MAP`.

## Tasks Completed

| Task | Description | Status |
|------|-------------|--------|
| 1 | Create bin/migrate-to-slots.cjs | ✓ Complete |
| 2 | Update bin/install.js | ✓ Complete |

## Key Files

### Created
- `bin/migrate-to-slots.cjs` — Migration script: 10-key SLOT_MIGRATION_MAP, `migrateClaudeJson()`, `migrateQgsdJson()`, `--dry-run` support, idempotent

### Modified
- `bin/install.js` — QGSD_KEYWORD_MAP defaultPrefix updated to slot-based prefixes; `hasClaudeMcpAgents()` now uses `/^claude-\d+$/` regex; `--migrate-slots` flag added

## Verification

- `node bin/migrate-to-slots.cjs --dry-run` exits 0, prints 14-entry dry-run summary
- `node -e "const m = require('./bin/migrate-to-slots.cjs'); ..."` confirms `object 10`
- `grep -n "defaultPrefix"` shows `mcp__codex-cli-1__`, `mcp__gemini-cli-1__`, `mcp__opencode-1__`
- `grep -n "claude-\\d"` shows `/^claude-\d+$/` regex pattern
- `node bin/install.js --migrate-slots --dry-run` exits 0

## Commits

- `c67f987` feat(phase-39-01): migration script + bin/install.js slot name support

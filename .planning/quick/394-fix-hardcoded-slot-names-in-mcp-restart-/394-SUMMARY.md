---
phase: quick-394
plan: "01"
subsystem: commands
tags: [mcp, dynamic-validation, slot-names, commands]
dependency_graph:
  requires: []
  provides: [dynamic-slot-validation-mcp-restart, dynamic-slot-validation-mcp-set-model]
  affects: [commands/nf/mcp-restart.md, commands/nf/mcp-set-model.md]
tech_stack:
  added: []
  patterns: [dynamic-config-read, fail-open-validation]
key_files:
  created: []
  modified:
    - commands/nf/mcp-restart.md
    - commands/nf/mcp-set-model.md
decisions:
  - "SKIP_SLOTS=['canopy','sentry'] excluded from valid agent list to avoid non-agent MCP entries"
  - "Dynamic slot list read at runtime from ~/.claude.json mcpServers rather than hardcoded"
metrics:
  duration: "5m"
  completed: "2026-04-09"
  tasks_completed: 3
  files_changed: 2
---

# Quick Task 394: Fix Hardcoded Slot Names in mcp-restart and mcp-set-model — Summary

**One-liner:** Replaced hardcoded agent slot lists with dynamic ~/.claude.json mcpServers lookup (SKIP=['canopy','sentry']) in mcp-restart.md and mcp-set-model.md allowed-tools and validation steps.

## What Was Done

Both `commands/nf/mcp-restart.md` and `commands/nf/mcp-set-model.md` had two hardcoded slot references that required updating:

1. **allowed-tools frontmatter** — replaced old names (`codex-cli-1`, `gemini-cli-1`, `claude-2..6`) with current names (`codex-1`, `gemini-1`, `opencode-2`, `ccr-1..6`).

2. **Step 1 usage message** — replaced hardcoded "Valid agents: codex-cli-1, gemini-cli-1..." with a note that valid agents are read dynamically from `~/.claude.json`.

3. **Step 2 validation** — replaced hardcoded list check with a `node << 'NF_EVAL'` heredoc that reads `~/.claude.json` mcpServers, filters out `SKIP=['canopy','sentry']`, and validates `$AGENT` against the live list.

After editing both files, `node bin/install.js --claude --global` was run to sync the updated command files to `~/.claude/commands/nf/`.

## Files Changed

- `commands/nf/mcp-restart.md` — updated allowed-tools, Step 1 usage, Step 2 validation
- `commands/nf/mcp-set-model.md` — same changes (Step 2 still says `/nf:mcp-set-model <agent> <model>`)

## Commit

`75c8fdd1` — feat(quick-394): dynamic slot validation in mcp-restart and mcp-set-model

## Deviations from Plan

None — plan executed exactly as written.

---
phase: quick-385
plan: 01
subsystem: commands/nf/mcp-repair
tags: [mcp-repair, slot-discovery, dynamic-config, claude-json]
key-files:
  modified:
    - commands/nf/mcp-repair.md
decisions:
  - "Slot names discovered from ~/.claude.json mcpServers keys (excluding unified-1) at runtime, not hardcoded"
  - "allowed-tools frontmatter comment-only — MCP tool access determined at session startup, not by listing tool names"
  - "SLOT_COUNT banner value now derived from discovered slot array length, not providers.json count"
  - "Non-health-check MCP servers (e.g., filesystem-1, brave-1) treated as unresponsive for null identity/health_check results"
metrics:
  duration: ~5m
  completed: 2026-04-08
  tasks: 1
  files: 1
---

# Quick Task 385: Make nf:mcp-repair Discover Slot Names Dynamically from ~/.claude.json

**One-liner:** Replace hardcoded 30-call MCP tool enumeration and 30-entry allowed-tools list with dynamic ~/.claude.json mcpServers slot discovery.

## What Changed

### Change 1 — allowed-tools frontmatter (lines 4-36 → lines 4-14)

The 30-entry explicit MCP tool list (`mcp__codex-1__identity`, `mcp__claude-6__deep_health_check`, etc.) was replaced with a comment block explaining that:
- MCP tool access is determined at session startup from `~/.claude.json`
- Listing specific tool names in frontmatter is not required
- The executor must not attempt calls for slots not present in `~/.claude.json`

### Change 2 — Step 1 call enumeration (lines ~62-130 replaced)

The hardcoded numbered 1-30 call list and hardcoded 10-slot `$BEFORE_STATE` JSON template were replaced with:

1. A `SLOT_NAMES=$(node ...)` shell capture block that reads `~/.claude.json` mcpServers keys (excluding `unified-1`) with try/catch error handling and fail-open (returns empty array on parse failure)
2. `$SLOT_COUNT` derived from the discovered array length (not providers.json)
3. A loop-pattern instruction: for each `<slot>` in `$SLOT_NAMES`, call identity, health_check, deep_health_check sequentially
4. `$BEFORE_STATE` assembled from discovered slot names, not hardcoded template
5. Non-health-check MCP servers (filesystem-1, brave-1, gmail) treated as unresponsive for missing tools, not errors

### Change 3 — success_criteria block

Replaced:
```
- All configured slots from bin/providers.json are diagnosed (not a hardcoded count)
```

With:
```
- All configured slots from ~/.claude.json mcpServers are diagnosed (not a hardcoded list)
- Slot names are discovered dynamically at runtime from ~/.claude.json mcpServers keys
```

## Verification Results

All 10 task verification checks passed:

1. `grep -n "mcp__codex-1__identity" commands/nf/mcp-repair.md` — 0 results (PASS)
2. `grep -n "mcpServers" commands/nf/mcp-repair.md` — 5 results (PASS, >= 2 required)
3. `grep -n "allowed-tools:" commands/nf/mcp-repair.md` — present at line 4 (PASS)
4. `grep -c "mcp__claude-[1-6]__identity" commands/nf/mcp-repair.md` — 0 (PASS)
5. Steps 1-7 headings all present (PASS)
6. `grep -n "SLOT_NAMES"` — 8 results (PASS)
7. `grep -n "SLOT_NAMES=$(node"` — match at line 41 (PASS)
8. `grep -n "try {"` — match at line 43 (PASS)
9. `grep -n "bin/providers.json are diagnosed"` — 0 results (PASS)
10. `grep -n "mcpServers are diagnosed"` — match at line 378 (PASS)

## Unchanged

- Steps 2-7 structure (classification, service status, deep probe, display table, auto-repair, guidance, verification, summary)
- Bash scripts for service status/restart, binary detection, pkill logic
- Classification tables and display table format
- Step 4 and Step 6 `<slot>` placeholder patterns

## Commit

11c9fbb9 — feat(quick-385): replace hardcoded slot enumeration with dynamic ~/.claude.json discovery in nf:mcp-repair

## Self-Check

- [x] `commands/nf/mcp-repair.md` exists and modified
- [x] commit 11c9fbb9 exists in git log
- [x] All 10 verification checks passed

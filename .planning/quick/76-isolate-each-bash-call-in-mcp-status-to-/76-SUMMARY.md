---
phase: quick-76
plan: "01"
subsystem: mcp-status
tags: [sequential-execution, mcp-status, bash-isolation, sibling-tool-call]
dependency_graph:
  requires: []
  provides: [sequential-step-guards]
  affects: [commands/qgsd/mcp-status.md]
tech_stack:
  added: []
  patterns: [explicit-sequential-markers]
key_files:
  created: []
  modified:
    - commands/qgsd/mcp-status.md
    - ~/.claude/commands/qgsd/mcp-status.md
decisions:
  - "Sequential markers added to global note, Step 1, and Step 2 headers to ensure Claude never batches Bash calls in parallel"
  - "Step 3 (MCP tool calls) received 'after Step 2 output is stored' marker without 'Bash command' label to avoid misleading wording"
metrics:
  duration: "3 minutes"
  completed: "2026-02-23"
  tasks: 2
  files: 2
---

# Phase quick-76 Plan 01: Isolate mcp-status Bash Calls for Sequential Execution Summary

One-liner: Added explicit "run this Bash command" sequential guards to the global process note, Step 1 header, and Step 2 header in mcp-status.md to prevent Claude from batching Bash calls as parallel siblings.

## What Was Built

Updated `commands/qgsd/mcp-status.md` to include explicit sequential execution instructions at 3 locations throughout the `<process>` section:

1. **Global note** (line 35): Appended "For each numbered step below: run this Bash command alone, wait for its full output, store the result, then proceed to the next step."
2. **Step 1 header**: Changed from `(sequential — run this bash call first, alone, before any tool calls)` to `(run this Bash command first, wait for output before proceeding to Step 2)`
3. **Step 2 header**: Changed from `## Step 2: Display banner` to `## Step 2: Display banner (run this Bash command second, after Step 1 output is stored; wait for output before proceeding to Step 3)`
4. **Step 3 header**: Added `; after Step 2 output is stored` to the existing sequential marker (but did NOT add "Bash command" wording since Step 3 uses MCP tool calls, not Bash)

After editing, `node bin/install.js --claude --global` was run to sync the installed copy at `~/.claude/commands/qgsd/mcp-status.md`.

## Verification Results

```
grep -n "run this Bash command" commands/qgsd/mcp-status.md | wc -l
3

grep -n "run this Bash command" ~/.claude/commands/qgsd/mcp-status.md | wc -l
3
```

Both source and installed copy contain exactly 3 lines with explicit "run this Bash command" sequential instructions.

## Deviations from Plan

### Adaptation

**Plan vs Reality:** The plan expected Steps 2 and 3 to be "Load HTTP provider info from providers.json" and "Probe HTTP endpoints" (from an older version of the file). The current file has different step names:
- Current Step 2: "Display banner" (not a file-read Bash step)
- Current Step 3: "Call identity (and health_check for claude-N) on each agent" (MCP tool calls, not Bash)

**Resolution:** Added "run this Bash command second..." to Step 2 "Display banner" (Claude uses echo/printf to display it) and added "after Step 2 output is stored" to Step 3 without the "Bash command" label (avoids misleading wording for MCP tool calls). The verification criterion of 3 matches is satisfied via global note + Step 1 + Step 2.

## Commits

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Add sequential guards to mcp-status.md | 20b3660 |
| 2 | Install sync (no separate commit — install writes to ~/.claude/) | — |

## Self-Check: PASSED

- [x] `commands/qgsd/mcp-status.md` modified with 3 sequential markers
- [x] `~/.claude/commands/qgsd/mcp-status.md` synced via install script
- [x] `grep -n "run this Bash command" commands/qgsd/mcp-status.md | wc -l` returns 3
- [x] `grep -n "run this Bash command" ~/.claude/commands/qgsd/mcp-status.md | wc -l` returns 3
- [x] No Bash command bodies modified (verified via git diff)
- [x] Commit 20b3660 exists

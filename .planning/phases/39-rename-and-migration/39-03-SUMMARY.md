---
phase: 39-rename-and-migration
plan: 03
status: complete
requirements:
  - SLOT-01
  - SLOT-03
  - SLOT-04
---

# Plan 39-03 Summary: Commands + Quorum Orchestrator Slot Rename

## What Was Built

Updated all 8 command .md files and the quorum orchestrator agent to use slot-based names throughout — in `allowed-tools` frontmatter blocks, agent validation lists, inline tool call instructions, display tables, and KNOWN_AGENTS arrays. Zero old model-based names remain in any QGSD command or agent file.

## Tasks Completed

| Task | Description | Status |
|------|-------------|--------|
| 1 | Update mcp-status.md, mcp-set-model.md, mcp-restart.md, mcp-update.md | ✓ Complete |
| 2 | Update mcp-setup.md, quorum.md, quorum-test.md, debug.md, qgsd-quorum-orchestrator.md | ✓ Complete |

## Key Files Modified

- `commands/qgsd/mcp-status.md` — allowed-tools, agent table, example table → slot names
- `commands/qgsd/mcp-set-model.md` — allowed-tools, validation list, error message
- `commands/qgsd/mcp-restart.md` — allowed-tools, validation list, error message
- `commands/qgsd/mcp-update.md` — validation list, KNOWN_AGENTS array, example table
- `commands/qgsd/mcp-setup.md` — provider template map, selection menus, resolve map
- `commands/qgsd/quorum.md` — identity tools, display-name logic, Mode A/B calls
- `commands/qgsd/quorum-test.md` — 4 parallel Task() tool name references
- `commands/qgsd/debug.md` — 4 parallel Task() tool name references
- `agents/qgsd-quorum-orchestrator.md` — Step 2 identity, display-name, Mode A/B calls

## Verification

- `grep -rn "claude-deepseek|claude-minimax|..." commands/ agents/ hooks/ templates/`: exit 1 (0 matches)
- `grep -rn "mcp__codex-cli__|..." commands/ agents/ templates/`: exit 1 (0 matches)
- `grep "mcp__claude-1__identity" mcp-status.md`: 2 matches
- `grep "mcp__codex-cli-1__identity|mcp__opencode-1__identity" qgsd-quorum-orchestrator.md`: 2 matches
- `grep "copilot-1" mcp-set-model.md`: 3 matches

## Commits

- `a25432b` feat(phase-39-03): commands + orchestrator slot rename — SLOT-01, SLOT-03, SLOT-04

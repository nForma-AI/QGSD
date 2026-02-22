---
plan: 37-01
phase: 37-fix-mcp-setup-distribution
status: complete
completed: 2026-02-22
---

# Summary: Fix mcp-setup Distribution Defects

## What Was Built

Patched `commands/qgsd/mcp-setup.md` to eliminate all four distribution defects identified in the v0.5 audit, making the file safe to distribute to any QGSD installer.

## Tasks Completed

| Task | Status | Notes |
|------|--------|-------|
| Task 1: Replace all 9 hardcoded secrets.cjs paths | ✓ Complete | 0 hardcoded paths remain; 9 `~/.claude/qgsd-bin/secrets.cjs` placeholders |
| Task 2: Fix three apply-flow structural inconsistencies | ✓ Complete | All three fixes applied; installed copy identical |

## Key Changes

### Task 1 — Hardcoded path replacement
- Replaced all 9 occurrences of `require('/Users/jonathanborduas/code/QGSD/bin/secrets.cjs')` with `require('~/.claude/qgsd-bin/secrets.cjs')` throughout the file
- Lines affected: 119, 292, 358, 452, 565, 638, 700, 790, 1036 (original numbering)
- Each replacement preserves the correct destructuring: `{ set, SERVICE }`, `{ syncToClaudeJson, SERVICE }`, or `{ get, SERVICE }` per call site

### Task 2 — Apply-flow structural fixes
- **Fix A (INTEGRATION-02):** Added `syncToClaudeJson` step to Option 2 (Swap Provider) Step D between the ANTHROPIC_BASE_URL patch and `/qgsd:mcp-restart` invocation. Renumbered old steps 3→4 and 4→5. Now 5 total `require('...secrets.cjs')` calls for `syncToClaudeJson` (one per apply flow).
- **Fix B:** Added explicit `if [ -z "$CLAUDE_MCP_PATH" ]` guard block to first-run Step 3c before the node write script. Guard warns user and falls back to `claude-mcp-server` string instead of silently writing `args: ['']`.
- **Fix C:** Replaced prose-only `stored: false` bullet in add-agent Step B with explicit AskUserQuestion block + bash audit-log snippet, matching the Option 1 fallback pattern.

### Copy to installed location
- `~/.claude/commands/qgsd/mcp-setup.md` is byte-for-byte identical to `commands/qgsd/mcp-setup.md`

## Verification Results

| Check | Result |
|-------|--------|
| `grep -c '/Users/jonathanborduas' commands/qgsd/mcp-setup.md` | 0 ✓ |
| `grep -c 'qgsd-bin/secrets.cjs' commands/qgsd/mcp-setup.md` | 9 ✓ |
| `const { syncToClaudeJson` require calls | 5 ✓ (was 4) |
| `if [ -z "$CLAUDE_MCP_PATH" ]` guard in first-run Step 3c | Present ✓ |
| `AGENT_KEY` in audit log bash snippet (add-agent fallback) | 3 matches ✓ |
| `diff commands/qgsd/mcp-setup.md ~/.claude/commands/qgsd/mcp-setup.md` | IDENTICAL ✓ |

## key-files

### created
(none — patch to existing file only)

### modified
- `commands/qgsd/mcp-setup.md` — all 4 distribution defects fixed; 49 lines added, 12 removed
- `~/.claude/commands/qgsd/mcp-setup.md` — installed copy updated to match source

## Commits
- `1e84b15` — fix(mcp-setup): replace hardcoded paths + fix apply-flow gaps (phase-37-01)

## Self-Check: PASSED

All must-haves verified:
- Zero occurrences of `/Users/jonathanborduas` in source file
- Option 2 (Swap Provider) apply path calls `syncToClaudeJson` after patching `ANTHROPIC_BASE_URL`
- First-run Step 3c has explicit warning when `CLAUDE_MCP_PATH` is empty
- Add-agent keytar fallback contains explicit bash snippet for audit log write

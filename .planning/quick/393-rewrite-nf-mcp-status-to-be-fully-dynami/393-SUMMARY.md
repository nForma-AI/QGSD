---
phase: quick-393
plan: 01
subsystem: mcp
tags: [mcp-status, quorum, slot-classification, dynamic, claude-json]

requires: []
provides:
  - Fully dynamic nf:mcp-status skill that reads slot names/types from ~/.claude.json at runtime
  - SKIP_SLOTS/CLI_COMMANDS classification arrays for separating cli/http/mcp slots
  - Dynamic banner count string computed from slot arrays
  - allSlots-interpolated sub-agent prompt with hyphen-preservation note
  - Type-based health derivation (cli vs http/mcp) in Step 4
affects: [mcp-status, quorum, nf-skills]

tech-stack:
  added: []
  patterns:
    - "Dynamic slot classification: read mcpServers from ~/.claude.json, classify into cli/http/mcp/skip arrays at runtime"
    - "Fail-open slot parse: try/catch around ~/.claude.json parse, defaults to empty slot arrays"
    - "Guard for empty allSlots: skip sub-agent Task() call entirely when no non-skip slots configured"

key-files:
  created: []
  modified:
    - commands/nf/mcp-status.md

key-decisions:
  - "Slot classification uses ANTHROPIC_BASE_URL env var for http detection, CLI_COMMANDS list for cli detection, node+.js/.mjs/.cjs args for local mcp detection"
  - "SKIP_SLOTS=['canopy','sentry'] hardcoded as the only stable exception list; all other slots discovered dynamically"
  - "allSlots empty guard added to Step 3 to avoid Task() call when no quorum slots are configured"
  - "Hyphen preservation example added to Step 3 prompt: ccr-1 maps to mcp__ccr-1__identity (not mcp__ccr_1__identity)"

requirements-completed: [QUICK-393]

duration: 8min
completed: 2026-04-09
---

# Quick Task 393: Rewrite nf:mcp-status to be Fully Dynamic

**nf:mcp-status rewritten to classify slots at runtime from ~/.claude.json, eliminating all hardcoded claude-1..6 and codex/gemini/opencode/copilot-1 slot references from banner, sub-agent prompt, and health logic**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-09T13:50:00Z
- **Completed:** 2026-04-09T13:58:00Z
- **Tasks:** 2 (+ install sync)
- **Files modified:** 1

## Accomplishments

- Step 1 Bash script extended with SKIP_SLOTS/CLI_COMMANDS classification block, emitting `slots` (cli/http/mcp/skip arrays) in INIT_INFO JSON
- Step 2 banner now computes count string dynamically: "3 CLI agents + 6 HTTP providers" vs hardcoded "4 CLI agents + 6 HTTP providers"
- Step 3 sub-agent prompt uses `${JSON.stringify(allSlots)}` interpolation; hyphens-not-underscores example added for ccr-1 and opencode-2
- Step 4 health derivation branches on `INIT_INFO.slots.cli` / `.http` / `.mcp` arrays rather than slot name patterns
- Step 5 iterates `[...INIT_INFO.slots.cli, ...INIT_INFO.slots.http, ...INIT_INFO.slots.mcp]`; Auth column uses `sub`/`api` per type
- Frontmatter `allowed-tools` expanded with ccr-1..6 and opencode-2 identity+health_check entries
- success_criteria updated from "All 11 rows" to "All non-skip configured slots"
- Synced to ~/.claude/commands/nf/mcp-status.md via `node bin/install.js --claude --global`

## Task Commits

1. **Task 1: Rewrite commands/nf/mcp-status.md with fully dynamic slot classification** - `3dcaabff` (feat)
2. **Task 2: Sync updated skill to ~/.claude via install.js** - (install only, no separate commit)

## Files Created/Modified

- `commands/nf/mcp-status.md` - Fully dynamic version: slot classification, dynamic banner, allSlots sub-agent prompt, type-based health logic

## Decisions Made

- Slot classification precedence: ANTHROPIC_BASE_URL → http; CLI_COMMANDS match → cli; node+js-extension args → mcp; else → skip
- SKIP_SLOTS=['canopy','sentry'] as stable exception list (infrastructure slots, not quorum participants)
- try/catch wraps entire slot classification block so missing/invalid ~/.claude.json yields empty arrays, not a crash
- Guard added before Task() call: if allSlots.length === 0, skip sub-agent and proceed to Step 5 with empty AGENT_RESULTS

## Deviations from Plan

None - plan executed exactly as written, all quorum improvements incorporated.

## Issues Encountered

None.

## Next Phase Readiness

- nf:mcp-status will now automatically reflect new ccr-* slots and any other slots added to ~/.claude.json without skill edits
- Future slot additions only require updating allowed-tools frontmatter if the new tool names aren't already covered

---
*Phase: quick-393*
*Completed: 2026-04-09*

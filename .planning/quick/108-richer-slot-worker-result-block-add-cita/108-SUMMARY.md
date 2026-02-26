---
phase: quick-108
plan: 01
subsystem: quorum
tags: [quorum, slot-worker, citations, result-block]

requires: []
provides:
  - "citations: field in slot-worker result block (Mode A Round 1, Round 2+, Mode B, Step 5)"
  - "raw output cap raised from 2000 to 5000 characters in Step 5 success block"
affects: [quick-109, quorum-orchestrator, quorum-dispatch]

tech-stack:
  added: []
  patterns:
    - "Optional citations field: slot-worker prompts instruct model to self-report file/line references"

key-files:
  created: []
  modified:
    - "agents/qgsd-quorum-slot-worker.md"

key-decisions:
  - "citations: field is optional in all four locations — only populated when model actually cites code/files/lines"
  - "UNAVAIL result block left unchanged — 500-char cap is intentional for error output only"
  - "Raw cap raised 2000->5000 to carry more model reasoning into cross-pollination bundles (Quick 109)"

patterns-established:
  - "Optional field pattern: prompt instructs, result block declares, orchestrator reads if present"

requirements-completed: [QUICK-108]

duration: 2min
completed: 2026-02-26
---

# Quick Task 108: Richer slot-worker result block — citations field + 5000-char raw cap

**Optional citations: field added to all four slot-worker prompt/result locations; raw output cap raised 2000->5000 chars to support richer cross-pollination in Quick 109.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-26
- **Completed:** 2026-02-26
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Added citations: instruction to Mode A Round 1 prompt — model self-reports file/line references when it cites code
- Added citations: instruction to Mode A Round 2+ prompt — model records references during re-check
- Added citations: instruction to Mode B prompt — model records trace line references during execution review
- Added citations: field to Step 5 success result block — optional, placed between reasoning: and raw:
- Raised raw output cap from 2000 to 5000 characters in Step 5 success block
- Left UNAVAIL result block unchanged (500-char cap remains intentional)

## Task Commits

1. **Task 1: Add citations field + raise raw cap** - `a7d5dde` (feat)

## Files Created/Modified

- `/Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-slot-worker.md` - Four targeted edits: citations instruction in Mode A R1 prompt, Mode A R2+ prompt, Mode B prompt, citations: field in Step 5 result block, raw cap 2000->5000

## Decisions Made

- citations: is optional throughout — only include when model actually cites code. No mandatory field pressure avoids hallucinated citations.
- UNAVAIL block unchanged — 500-char cap is for error/timeout output only, not model reasoning.
- 5000-char cap (not higher) — balances richer context for Quick 109 cross-pollination against bundle size growth.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Quick 109 (cross-pollination bundles) can now include citations from slot-worker result blocks
- Orchestrator may read citations: field from result blocks to enrich prior_positions bundles

---
*Phase: quick-108*
*Completed: 2026-02-26*

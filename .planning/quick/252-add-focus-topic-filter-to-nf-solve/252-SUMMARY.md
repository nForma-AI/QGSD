---
phase: quick-252
plan: 01
subsystem: diagnostics
tags: [solver, focus-filter, requirements, cli]

requires:
  - phase: none
    provides: n/a
provides:
  - "--focus flag for nf:solve to scope diagnostics to topic-specific requirements"
  - "solve-focus-filter.cjs module with tokenization and multi-signal requirement matching"
affects: [solve, solve-diagnose, solve-report]

tech-stack:
  added: []
  patterns: [token-based keyword matching with weighted scoring across requirement fields]

key-files:
  created:
    - bin/solve-focus-filter.cjs
    - bin/solve-focus-filter.test.cjs
  modified:
    - bin/nf-solve.cjs
    - commands/nf/solve.md
    - commands/nf/solve-diagnose.md
    - commands/nf/solve-report.md

key-decisions:
  - "Score threshold >= 2 for match inclusion (at least one strong match or two weak matches)"
  - "Focus filter returns null for empty input to preserve backward compatibility (callers check null = no filter)"
  - "Module-level focusSet/focusPhrase in nf-solve.cjs for accessibility from sweepRtoF and sweepRtoD"

patterns-established:
  - "Focus filtering pattern: tokenize phrase, score against multiple fields (id, category, group, text, background), threshold-based inclusion"

requirements-completed: []

duration: 6min
completed: 2026-03-10
---

# Quick Task 252: Add Focus/Topic Filter to nf:solve Summary

**--focus flag for nf:solve that tokenizes a topic phrase and scores requirements by ID, category, group, and text match to scope diagnostic sweeps**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-10T08:24:46Z
- **Completed:** 2026-03-10T08:30:55Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Created `bin/solve-focus-filter.cjs` with `filterRequirementsByFocus` and `describeFocusFilter` exports
- 23 unit tests covering null handling, ID matching, category group matching, text matching, negative cases, and edge cases
- Wired `--focus` flag into `nf-solve.cjs` CLI parsing, `sweepRtoF`, `sweepRtoD`, `computeResidual` output, and `solve-state.json` persistence
- Updated orchestrator (`solve.md`) and sub-skills (`solve-diagnose.md`, `solve-report.md`) to document and forward the focus flag
- Verified: `--focus="quorum"` correctly scopes to 27/287 requirements; no-focus run returns `focus: null`

## Task Commits

Each task was committed atomically:

1. **Task 1: Create solve-focus-filter.cjs module with tests** - `25d46710` (feat)
2. **Task 2: Wire --focus flag into nf-solve.cjs and orchestrator skill files** - `04b3c923` (feat)

## Files Created/Modified
- `bin/solve-focus-filter.cjs` - Focus filter module: tokenizes phrase, loads requirements.json + category-groups.json, scores and filters by weighted multi-field matching
- `bin/solve-focus-filter.test.cjs` - 23 unit tests using mock fixtures (not real requirements.json)
- `bin/nf-solve.cjs` - Added require, CLI --focus parsing, focusSet/focusPhrase module-level vars, filter application in sweepRtoF and sweepRtoD, focus metadata in computeResidual output and solve-state.json
- `commands/nf/solve.md` - Added --focus to argument-hint, Flag Extraction section, Phase 3b forwarding, Phase 4 focus metadata in report input
- `commands/nf/solve-diagnose.md` - Documented --focus flag in accepted CLI flags
- `commands/nf/solve-report.md` - Added focus to input_contract, conditional (focused: phrase) header in Step 6

## Decisions Made
- Score weighting: +2 for ID match, +2 for category, +3 for category group, +1 for text, +1 for background (graceful: optional chaining for missing fields)
- Threshold of >= 2 balances precision vs recall
- Returns null (not empty Set) for falsy/empty input so callers can distinguish "no filter" from "filter matched nothing"
- Zero tokens after stop-word removal returns null (same as empty input)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Focus filter is ready for use: `nf:solve the quorum state machine` or `nf:solve --focus="hooks"`
- Future enhancement: could add --focus support to solve-remediate.md for scoped auto-fixing

---
*Quick Task: 252-add-focus-topic-filter-to-nf-solve*
*Completed: 2026-03-10*

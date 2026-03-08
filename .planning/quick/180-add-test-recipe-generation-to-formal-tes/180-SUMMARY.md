---
phase: quick-180
plan: 01
subsystem: testing
tags: [formal-verification, test-recipes, formal-test-sync, solve]

requires:
  - phase: quick-139
    provides: formal-test-sync.cjs base tool
provides:
  - Recipe sidecar generation (.stub.recipe.json) in formal-test-sync.cjs
  - Recipe-aware F->T template in solve.md with batch size 5
  - extractPropertyDefinition, findSourceFiles, classifyTestStrategy helpers
affects: [nf-solve, formal-verification, test-generation]

tech-stack:
  added: []
  patterns: [recipe-sidecar-pattern, fail-open-helpers, keyword-test-classification]

key-files:
  created: []
  modified:
    - bin/formal-test-sync.cjs
    - commands/nf/solve.md

key-decisions:
  - "Recipe sidecars use fail-open pattern: missing source_files or definition produce empty values, never throw"
  - "Batch size reduced from 15 to 5 for better executor context density"
  - "classifyTestStrategy defaults to structural when no keywords match"

patterns-established:
  - "Recipe sidecar pattern: .stub.recipe.json alongside .stub.test.js with pre-resolved context"

requirements-completed: [QUICK-180]

duration: 2min
completed: 2026-03-08
---

# Quick-180: Add Test Recipe Generation to Formal Test Sync Summary

**Recipe sidecar generation in formal-test-sync.cjs with extractPropertyDefinition/findSourceFiles/classifyTestStrategy helpers, plus recipe-aware solve.md F->T template at batch size 5**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-08T07:26:02Z
- **Completed:** 2026-03-08T07:28:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Three recipe helper functions (extractPropertyDefinition, findSourceFiles, classifyTestStrategy) added to formal-test-sync.cjs and exported
- generateStubs() produces .stub.recipe.json sidecars with requirement_text, formal_property, source_files, import_hint, test_strategy
- solve.md F->T Phase 2 uses batch size 5 with recipe-first action instructions and Phase 1b validation gate

## Task Commits

Implementation was completed in prior quick tasks that addressed the same scope:

1. **Task 1: Add recipe generation and helpers to formal-test-sync.cjs** - `161d27f8` (feat, quick-182) + `f338424c` (feat, quick-184 enhancement)
2. **Task 2: Update solve.md F->T template for recipe-based batches of 5** - `825048c7` (feat, quick-182)

## Files Created/Modified
- `bin/formal-test-sync.cjs` - Added extractPropertyDefinition, findSourceFiles, classifyTestStrategy helpers and recipe sidecar generation in generateStubs()
- `commands/nf/solve.md` - Updated F->T Phase 2 template with recipe references, batch size 5, Phase 1b validation gate

## Verification Results

All plan verification criteria pass:
- `node bin/formal-test-sync.cjs --dry-run` exits 0
- All 5 exports present: parseAlloyDefaults, extractPropertyDefinition, findSourceFiles, classifyTestStrategy, classifyTestTemplate
- `grep -c 'stub.recipe.json' commands/nf/solve.md` returns 4 (>= 3 required)
- No `max 15` remains in solve.md
- `max 5` confirmed in solve.md

## Decisions Made
- Recipe sidecars use fail-open pattern (empty strings/arrays on failure, never throws)
- Batch size changed from 15 to 5 for better executor context density per batch
- classifyTestStrategy defaults to 'structural' when no keyword patterns match
- Only first formal_property used per recipe (acceptable since most gaps have single property)

## Deviations from Plan

None - all planned functionality was already implemented. The plan was executed under quick-182/quick-184 prior to this plan being formally dispatched.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Recipe infrastructure complete for F->T remediation pipeline
- solve.md template ready for recipe-aware batch dispatch

---
*Phase: quick-180*
*Completed: 2026-03-08*

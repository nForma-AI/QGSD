---
phase: 53-skill-deprecation
plan: 01
subsystem: workflows
tags: [deprecation, model-driven-fix, debug, skill-lifecycle]

requires:
  - phase: 50-debug-integration
    provides: "/nf:debug absorbs model-driven-fix Phases 1-4"
  - phase: 51-task-classification
    provides: "Bug_fix routing dispatches through debug pipeline"
  - phase: 52-pre-commit-simulation-gate
    provides: "Loop 2 pre-commit gate in executors"
provides:
  - "/nf:model-driven-fix replaced with deprecation shim directing to /nf:debug"
  - "solve-remediate b_to_f layer rewired to dispatch /nf:debug"
  - "No active dispatch paths to model-driven-fix remain"
affects: []

tech-stack:
  added: []
  patterns: ["deprecation-shim pattern for skill lifecycle management"]

key-files:
  created: []
  modified:
    - "commands/nf/model-driven-fix.md"
    - "core/workflows/model-driven-fix.md"
    - "commands/nf/solve-remediate.md"

key-decisions:
  - "Shim displays nForma-branded banner with example command for /nf:debug"
  - "b_to_f dispatch uses positional bug description + --files= flag to match /nf:debug interface"

patterns-established:
  - "Deprecation shim: replace <process> with notice and exit, keep <purpose> tag with DEPRECATED prefix"

requirements-completed: [DEPR-01, DEPR-02, DEPR-03]

duration: 3min
completed: 2026-03-25
---

# Phase 53: Skill Deprecation Summary

**/nf:model-driven-fix fully deprecated — all consumers rewired to /nf:debug, no active dispatch paths remain**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-25
- **Completed:** 2026-03-25
- **Tasks:** 3 completed
- **Files modified:** 3

## Accomplishments
- Replaced model-driven-fix skill and workflow with deprecation shim directing users to /nf:debug
- Rewired solve-remediate b_to_f layer to dispatch /nf:debug with correct argument format
- Verified no active dispatch paths to model-driven-fix remain in commands/ or core/

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace model-driven-fix with deprecation shim** - `38a71c7a` (feat: DEPR-01)
2. **Task 2: Rewire solve-remediate b_to_f layer** - `8f8d5d9b` (feat: DEPR-02)
3. **Task 3: Verify no active dispatch paths** - verification only, no code changes needed (DEPR-03)

## Files Created/Modified
- `commands/nf/model-driven-fix.md` - Deprecation shim with nForma banner and /nf:debug redirect
- `core/workflows/model-driven-fix.md` - Identical deprecation shim (installed workflow copy)
- `commands/nf/solve-remediate.md` - b_to_f layer rewired from /nf:model-driven-fix to /nf:debug

## Decisions Made
- Used nForma-branded deprecation banner consistent with ui-brand.md patterns
- Mapped model-driven-fix --bug-context + --model-paths to debug's positional description + --files=

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED
- [x] commands/nf/model-driven-fix.md contains only deprecation shim
- [x] core/workflows/model-driven-fix.md matches commands/ copy
- [x] solve-remediate.md has zero references to model-driven-fix
- [x] grep across commands/ and core/ returns only the two shim files

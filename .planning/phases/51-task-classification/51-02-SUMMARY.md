---
phase: 51-task-classification
plan: 02
subsystem: routing
tags: [classification, debug-routing, task-classification, step-5.8]

# Dependency graph
requires:
  - phase: 51-task-classification
    plan: 01
    provides: "Task classification at Step 2.7 with type (bug_fix, feature, refactor) and confidence scoring"
  - phase: 50-debug-integration
    provides: "/nf:debug pipeline for formal model-driven bug investigation"
provides:
  - "Step 5.8 routing logic that dispatches bug_fix tasks through /nf:debug before executor"
  - "Supplementary debug context (constraints, formal verdict, reproducing model) passed to executor"
  - "Transparent routing for feature/refactor tasks (no debug detour)"
affects:
  - "51-03 (if exists) — future routing consumers"
  - "50-02 (Routing consumers) — can now assume Step 5.8 exists"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Conditional routing based on classification.type and confidence threshold (>= 0.7)"
    - "Debug subagent spawning with fail-open error handling"
    - "Supplementary context injection into executor prompts (non-blocking)"
    - "scope-contract.json field mutation (routed_through_debug flag)"

key-files:
  created: []
  modified:
    - "core/workflows/quick.md (Step 5.8 added between Step 5.7 and Step 6; debug_context block added to Step 6 executor prompt)"

key-decisions:
  - "Routing threshold: confidence >= 0.7 (clear signals only; below 0.7 treated as ambiguous, skip debug, fail-open)"
  - "Feature and refactor tasks always skip Step 5.8 (no debug detour)"
  - "scope-contract.json routed_through_debug flag updated by Step 5.8 (tracking immutable classification history)"
  - "Debug output passed as supplementary context, not a blocking gate (executor can override if needed)"
  - "Fail-open on debug subagent errors: proceed to executor without debug context"

requirements-completed:
  - ROUTE-02
  - ROUTE-03

# Metrics
duration: 3min
completed: 2026-03-25
---

# Phase 51 Plan 02: Routing Integration Summary

**Step 5.8 debug routing that dispatches bug_fix tasks (confidence >= 0.7) through /nf:debug before execution, while feature and refactor tasks proceed directly; debug output enriches executor context as supplementary (non-blocking) information**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-25T10:08:55Z
- **Completed:** 2026-03-25T10:11:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Added Step 5.8 (Debug routing) to quick.md between Step 5.7 (Quorum review) and Step 6 (Spawn executor)
- Step 5.8 routes bug_fix tasks with confidence >= 0.7 through /nf:debug pipeline before code execution
- Feature and refactor tasks skip Step 5.8 entirely (no debug detour)
- Debug subagent output (constraints, formal verdict, reproducing model) extracted and stored
- scope-contract.json routed_through_debug flag updated to true after debug dispatch
- Fail-open error handling specified: debug subagent errors don't block executor spawn
- Step 6 executor prompt extended with conditional `<debug_context>` block
- debug_context block only rendered when debug routing occurred (any of three output variables non-null)
- Debug context presented as supplementary information (executor can override per plan if needed)

## Task Commits

Each task was committed atomically:

1. **Task 1 & 2 Combined** - `fd002504` (feat)
   - Added Step 5.8 routing logic with bug_fix detection and /nf:debug dispatch
   - Added debug_context block to Step 6 executor prompt
   - Both tasks committed together as single coherent unit

## Files Created/Modified

- `core/workflows/quick.md` - Added Step 5.8 (lines 591-654) with routing logic; added debug_context block to Step 6 executor prompt (lines 708-717)

## Decisions Made

- **Confidence threshold:** 0.7 minimum for routing as bug_fix — below 0.7 marked as ambiguous, skips debug routing (fail-open philosophy)
- **Type-based routing:** Classification type is primary signal — feature and refactor tasks never enter debug pipeline
- **Non-blocking context:** Debug output enriches executor context but does not gate execution. Executor can follow plan if constraints conflict.
- **scope-contract.json tracking:** routed_through_debug flag defaults to false, set true only when routing occurs (immutable classification history)
- **Fail-open on debug errors:** Debug subagent timeout/unavailability does not block executor — proceed without debug context

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - execution proceeded smoothly.

## Next Phase Readiness

- Plan 51-02 complete: routing infrastructure in quick.md ready for Step 5.8 execution
- Tasks classified as bug_fix with confidence >= 0.7 will automatically be routed through /nf:debug before executor
- Feature and refactor tasks proceed directly to executor (no routing overhead)
- Debug pipeline output available as supplementary context for executor implementation
- Transparent routing to user (no prompts, no decisions, fail-open on debug errors)

---

*Phase: 51-task-classification, Plan 02*
*Completed: 2026-03-25*

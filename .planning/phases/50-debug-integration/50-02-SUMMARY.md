---
phase: 50-debug-integration
plan: 02
subsystem: debugging
tags: [formal-verification, constraint-injection, model-artifact]

# Dependency graph
requires:
  - phase: 50-01 (Debug Integration - Foundation)
    provides: "4-step formal pipeline (Discovery, Reproduction, Refinement, Constraint Extraction)"
provides:
  - "Constraint injection into quorum worker prompts from formal model analysis"
  - "Formal model artifact tracking in debug output (reproducing model path, verdict, constraints, TSV trace)"
  - "Closed feedback loop: formal constraints extracted → injected into workers → workers respect constraints"
affects:
  - phase-51-routing-integration
  - phase-52-gateway-integration

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Constraint-to-worker injection via [FORMAL CONSTRAINTS] block in prompt"
    - "Plain-English constraint rendering from model-constrained-fix.cjs output"
    - "Formal model deliverable as first-class artifact section in quorum-debug-latest.md"
    - "Variable flow consistency across 8 steps (A.5-A.8, B, C, E, F, G)"

key-files:
  created: []
  modified:
    - commands/nf/debug.md

key-decisions:
  - "Move constraint rendering to use plain-English text from model-constrained-fix.cjs instead of raw formal syntax"
  - "Track reproducing model path as explicit artifact field in Step F, not just side effect"
  - "Update FORMAL row rendering to show top constraint alongside model path for reproduced cases"
  - "Remove dependency on $FORMAL_CONTEXT object — use only $CONSTRAINTS array for constraint injection"

requirements-completed:
  - DBUG-03
  - DBUG-04

# Metrics
duration: 1min
completed: 2026-03-25
---

# Phase 50, Plan 02: Debug Constraint Injection and Artifact Tracking Summary

**Wire constraint output from formal analysis into quorum worker prompts and establish formal model artifact tracking in debug output**

## Performance

- **Duration:** 1 min
- **Completed:** 2026-03-25
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

### Task 1: Wire constraint injection and artifact tracking
- Updated Step B (Bundle Assembly): Added constraint summary, reproducing model, and TSV trace fields
- Updated Step C (Worker Prompts): Constraints from A.8 now injected as [FORMAL CONSTRAINTS] block using plain-English text
- Updated Step E (NEXT STEP Table): FORMAL row now shows reproducing model path and top constraint for "reproduced" cases
- Updated Step F (Artifact): Added formal model deliverable section with:
  - `reproducing_model`: path to model that reproduced the bug
  - `formal_verdict`: one of "reproduced", "not_reproduced", "no-model"
  - `constraints_extracted`: count of extracted constraints
  - `tsv_trace`: path to TSV log from refinement iterations
  - `constraints`: full list of extracted constraints with types and English text
- Gap persistence for no-model cases preserved unchanged

### Task 2: End-to-end variable flow validation
- Verified $EXISTING_MODELS: set in A.5 discovery, consumed in A.6 skip condition (2 references)
- Verified $REPRODUCING_MODEL: set in A.6/A.7 (from models or refinement), consumed in A.8, E, F (8 total references)
- Verified $FORMAL_VERDICT: set in A.6/A.7/A.8, consumed in B, E, G for routing (12 total references)
- Verified $CONSTRAINTS: set in A.8, consumed in B, C, E, F (4+ consumers)
- Verified $TSV_LOG: set in A.7, consumed in E, F (4 total references)
- Removed all orphaned references to `$FORMAL_CONTEXT.constraints` — constraint injection now exclusively uses $CONSTRAINTS
- Updated divergence note to reference $CONSTRAINTS[0].english instead of $FORMAL_CONTEXT
- Confirmed no references to removed `debug-formal-context.cjs` remain

## Task Commits

1. **Task 1: Wire constraint injection into quorum worker prompts and update artifact tracking** - `015c67e4` (feat)
2. **Task 2: End-to-end variable flow validation** - `2b651fd2` (test)

## Files Created/Modified

- `commands/nf/debug.md` - Wired constraint injection in Step C, artifact tracking in Step F, updated FORMAL row rendering in Step E

## Decisions Made

- **Constraint injection source:** Use plain-English text from model-constrained-fix.cjs output, not raw formal constraint syntax
- **Artifact tracking:** Formal model deliverable is explicit artifact section in quorum-debug-latest.md, not implicit side effect
- **Variable simplification:** Eliminate $FORMAL_CONTEXT dependency — use only $CONSTRAINTS array for all constraint operations
- **FORMAL row clarity:** Show reproducing model name alongside top constraint to give workers context for why formal model matters

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Must-Have Verification

- ✓ Constraints from Step A.8 appear in Step C worker prompt template as [FORMAL CONSTRAINTS] block
- ✓ When Loop 1 converges (A.7), TSV trace path recorded in artifact (Step F)
- ✓ When reproducing model found (A.6 or A.7), path recorded in artifact as formal model deliverable
- ✓ FORMAL row in NEXT STEP table shows model path and top constraint when verdict is 'reproduced'
- ✓ Constraint text injected verbatim into worker prompts — workers receive verified properties
- ✓ When no model exists (verdict=no-model), gap persistence remains unchanged

## Next Phase Readiness

- `/nf:debug` now routes constraints extracted from formal models directly into quorum worker prompts
- Formal model artifact (.planning/quick/quorum-debug-latest.md) is complete record of formal investigation
- Constraint injection closes feedback loop: formal analysis → constraint extraction → worker input → constrained fixes
- Ready for Phase 51 (Routing Integration) to dispatch to this fully-integrated debug entry point

---
*Phase: 50-debug-integration*
*Plan: 02*
*Completed: 2026-03-25*

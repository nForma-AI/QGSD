---
phase: 50-debug-integration
plan: 01
subsystem: debugging
tags: [formal-verification, model-driven-fix, debug, quorum]

# Dependency graph
requires:
  - phase: v0.38 (Model-Driven Debugging)
    provides: "formal-scope-scan.cjs, autoresearch-refine.cjs, model-constrained-fix.cjs"
provides:
  - "Unified /nf:debug entry point with integrated 4-step formal pipeline (Discovery, Reproduction, Refinement, Constraint Extraction)"
  - "debug.md skill absorbed model-driven-fix Phases 1-4 for single-tool bug investigation"
  - "Foundation for phase 50 debug integration requirement DBUG-01 and DBUG-02"
affects:
  - phase-51-routing-integration
  - phase-52-gateway-integration
  - phase-53-deprecation

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "4-step formal model consultation pipeline in debug skill"
    - "Module-only API pattern for autoresearch-refine (require() not CLI)"
    - "In-memory rollback + TSV-as-memory for refinement iterations"
    - "Fail-open error handling throughout formal pipeline"

key-files:
  created: []
  modified:
    - commands/nf/debug.md

key-decisions:
  - "Absorb model-driven-fix Phases 1-4 into debug skill to eliminate context switching"
  - "Make /nf:debug the single entry point for formal-model-driven bug investigation"
  - "Preserve fail-open philosophy: formal context is advisory, never blocking"
  - "Maintain step-by-step clarity (A.5-A.8) for visibility into formal reasoning"

requirements-completed:
  - DBUG-01
  - DBUG-02

# Metrics
duration: 5min
completed: 2026-03-25
---

# Phase 50, Plan 01: Debug Integration Summary

**Unified /nf:debug skill with integrated 4-step formal model pipeline (Discovery → Reproduction → Refinement → Constraint Extraction) absorbing model-driven-fix Phases 1-4**

## Performance

- **Duration:** 5 min
- **Completed:** 2026-03-25
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Rewrote `/nf:debug` skill to absorb the discovery-through-constraint-extraction cycle from model-driven-fix
- Replaced single-shot `debug-formal-context.cjs` call with 4-step formal pipeline:
  - **Step A.5 (Discovery):** Finds existing formal models covering the bug via `formal-scope-scan.cjs --bug-mode`
  - **Step A.6 (Reproduction):** Attempts bug reproduction using discovered models via `formal-scope-scan.cjs --bug-mode --run-checkers`
  - **Step A.7 (Refinement Loop 1):** Iteratively improves model via `autoresearch-refine.cjs` module API with in-memory rollback and TSV-as-memory
  - **Step A.8 (Constraint Extraction):** Extracts fix constraints via `model-constrained-fix.cjs`
- All four steps have fail-open error handling consistent with nForma philosophy
- Preserved existing Steps B-G (worker dispatch, quorum consensus, artifact saving) structurally intact
- Ensured variable consistency across pipeline ($FORMAL_VERDICT, $FORMAL_CONTEXT, $CONSTRAINTS, $REPRODUCING_MODEL)

## Task Commits

1. **Task 1: Rewrite debug.md Steps A.5-A.8** - `856265d8` (feat)
2. **Task 2: Validate rewritten debug.md structure and tools** - verified inline (test)

## Files Created/Modified

- `commands/nf/debug.md` - Rewritten with integrated 4-step formal model pipeline

## Decisions Made

- **Unified entry point:** Make `/nf:debug` the single command for formal-model-driven bug investigation, eliminating need to dispatch to `/nf:model-driven-fix` for discovery-through-constraint-extraction
- **Module-only autoresearch-refine:** Use require() pattern (not CLI) for in-memory iteration with TSV-as-memory, enabling fine-grained refinement control
- **No per-iteration commits:** Let the autoresearch-refine loop manage in-memory rollback; commit once after refinement completes
- **Fail-open philosophy:** All four steps gracefully degrade on errors (missing models, checker failures, etc.), never block user interaction

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- `/nf:debug` now integrates formal model reasoning directly, ready for validation against phase 50 requirements DBUG-01 and DBUG-02
- Formal pipeline ready to support routing/gateway phases (50-02) that will dispatch to this unified debug entry point
- Foundation established for deprecating old `debug-formal-context.cjs` once all consumers are rewired to the new pipeline

---
*Phase: 50-debug-integration*
*Plan: 01*
*Completed: 2026-03-25*

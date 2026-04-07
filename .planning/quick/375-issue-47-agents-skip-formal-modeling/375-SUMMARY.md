---
phase: quick-375
plan: 01
subsystem: workflows
tags: [formal-modeling, guardrails, skip-prevention, quick-workflow]

requires:
  - phase: none
    provides: none
provides:
  - "MUST_NOT_SKIP annotations on all --full formal modeling steps"
  - "Anti-urgency guardrail in executor prompt"
  - "Formal tooling baseline check (Step 5.9)"
  - "Post-execution formal audit gate (Step 6.1)"
  - "Mandatory Loop 2 SUMMARY.md reporting"
  - "FORMAL_TOOLS_MISSING interpolation into executor prompt"
affects: [quick-workflow, formal-modeling, executor-constraints]

tech-stack:
  added: []
  patterns: ["MUST_NOT_SKIP HTML comments for mandatory step enforcement", "formal_tooling_notice block for pre-flight gap communication"]

key-files:
  created: []
  modified: [core/workflows/quick.md]

key-decisions:
  - "Used HTML comments for MUST_NOT_SKIP annotations so they survive markdown rendering but are visible in source"
  - "Replaced 'skip silently' with explicit WARNING log patterns rather than making skips blocking"
  - "Added Loop 2 reporting as item 7 (after existing items 5-6) to avoid renumbering"

patterns-established:
  - "MUST_NOT_SKIP annotation pattern: HTML comment after step header for mandatory --full steps"
  - "formal_tooling_notice pattern: conditional interpolation block between files_to_read and constraints"

requirements-completed: [INTENT-01]

duration: 3min
completed: 2026-04-05
---

# Quick Task 375: Formal-Skip Prevention Guardrails Summary

**Added MUST_NOT_SKIP annotations, anti-urgency guardrail, formal tooling baseline check, audit gate, and mandatory Loop 2 reporting to quick.md workflow to prevent agents from silently bypassing formal modeling steps in --full mode**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-05T19:06:02Z
- **Completed:** 2026-04-05T19:09:32Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Added MUST_NOT_SKIP annotations to 5 steps (4.5, 5.9, 6.1, 6.3, 6.5) making formal modeling mandatory in --full mode
- Added anti-urgency guardrail as first executor constraint, overriding urgency-bias skip behavior
- Replaced all "skip silently" clauses with explicit WARNING log patterns (fail-open but visible)
- Added Step 5.9 (formal tooling baseline check) to surface missing tools before executor spawn
- Added Step 6.1 (post-execution formal audit gate) to verify formal steps were actually attempted
- Added mandatory Loop 2 SUMMARY.md reporting for all outcomes (converged, non-converged, skipped, N/A)
- Added FORMAL_TOOLS_MISSING interpolation via formal_tooling_notice block in executor prompt
- Added formal-skip anti-patterns section documenting prohibited skip behaviors

## Task Commits

Each task was committed atomically:

1. **Task 1: Add formal-skip prevention guardrails to quick.md workflow** - `d174cae7` (feat)
2. **Task 2: Sync workflow to installed location** - no commit (runtime sync to ~/.claude/nf/workflows/quick.md, outside repo)

## Files Created/Modified
- `core/workflows/quick.md` - Added 8 categories of skip-prevention guardrails for --full mode

## Formal Modeling

### Loop 2 Simulation
- **Status:** Not applicable (no formal coverage intersections)

### Formal Coverage
- INFO: No formal coverage intersections found -- Loop 2 not needed (GATE-03).

## Decisions Made
- Used HTML comments for MUST_NOT_SKIP annotations -- invisible in rendered markdown but present in source for agent parsing
- Kept "Do NOT skip silently" phrasing in replacement text to make the prohibition explicit
- Added Loop 2 SUMMARY.md reporting as constraint item 7 (after items 5-6) to preserve numbering stability

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Workflow guardrails are active immediately via installed copy sync
- Future --full executions will surface formal step skips via AUDIT WARNING messages
- Step 6.1 audit gate provides post-hoc verification that formal steps ran

---
*Quick Task: 375-issue-47-agents-skip-formal-modeling*
*Completed: 2026-04-05*

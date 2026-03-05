---
phase: quick-175
plan: 01
subsystem: tooling
tags: [analyze-assumptions, tiering, prometheus, instrumentation, filtering]

requires:
  - phase: quick-172
    provides: analyze-assumptions.cjs base script
provides:
  - classifyTier function for assumption priority tiering
  - --actionable CLI flag for tier 1 filtering
  - Prometheus gauge/histogram instrumentation snippets for tier 1
  - Tier-sorted gap report output
affects: [observe, solve, formal-verification]

tech-stack:
  added: []
  patterns: [tier-based priority classification, Prometheus exposition format snippets]

key-files:
  created: []
  modified:
    - bin/analyze-assumptions.cjs
    - bin/analyze-assumptions.test.cjs

key-decisions:
  - "classifyTier uses !isNaN(Number(value)) to handle both native numbers and PRISM string-encoded numbers"
  - "constraint type with numeric value is tier 1 (monitorable cardinality bound); without numeric value falls to tier 3"
  - "assume type with numeric value is tier 1 (has monitorable threshold); without numeric value is tier 3"
  - "Histogram for probability-like properties (0 < value < 1); Gauge for all other tier 1 numeric constants"
  - "generateSnippet defensively falls back to observe handler JSON when tier is undefined"

patterns-established:
  - "Priority tiering: tier 1 = directly monitorable numeric, tier 2 = periodic probe checkable, tier 3 = structural/not observable"
  - "Prometheus snippet generation: # HELP/# TYPE comments + prometheus_client constructor pattern"

requirements-completed: [QUICK-175]

duration: 3min
completed: 2026-03-05
---

# Quick Task 175: Add Priority Tiering and Actionable Filtering Summary

**classifyTier function with 3-tier priority classification, --actionable CLI filter, tier-sorted gap report, and Prometheus gauge/histogram snippets for tier 1 assumptions**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-05T08:34:26Z
- **Completed:** 2026-03-05T08:37:41Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- classifyTier function correctly classifies assumptions into tier 1 (directly monitorable numeric), tier 2 (invariant/assert/fact), tier 3 (structural/unobservable)
- String-numeric PRISM values (e.g., '5', '0.95') correctly detected as numeric for tier 1
- --actionable CLI flag filters assumptions to tier 1 only before gap report generation
- Gap report sorted by tier ascending (tier 1 first) with stable insertion order within tiers
- Tier 1 gets Prometheus gauge/histogram instrumentation snippets; tier 2/3 keeps observe handler JSON
- generateSnippet defensively defaults to observe handler JSON when tier field is undefined
- Markdown report includes Tier column between Type and Coverage

## Task Commits

Each task was committed atomically:

1. **Task 1: Add classifyTier function and integrate into gap report pipeline** - `dd60d616` (feat)
2. **Task 2: Add tests for tier classification, filtering, sort order, and Prometheus snippets** - `ecf297f4` (test)

## Files Created/Modified
- `bin/analyze-assumptions.cjs` - Added classifyTier export, --actionable flag, tier-sorted gaps, Prometheus snippets for tier 1, Tier column in markdown
- `bin/analyze-assumptions.test.cjs` - 27 new tests: classifyTier (13), defensive default (2), tier sorting (3), actionable filtering (1), CLI integration (1), Prometheus snippets (3), markdown tier column (2), updated existing snippet test (1). Total: 64 tests passing.

## Decisions Made
- Used `!isNaN(Number(value))` for numeric detection instead of `typeof === 'number'` to handle PRISM string-encoded numbers
- constraint type with numeric value classified as tier 1 (design decision comment explains rationale)
- Histogram for probability-like property thresholds (0 < value < 1); Gauge for all other tier 1
- generateSnippet checks `gap.tier === 1` explicitly; undefined/missing tier falls back to observe handler format

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated existing instrumentation_snippet test for tier 1 behavior**
- **Found during:** Task 2
- **Issue:** Existing test asserted snippet contains 'observe' for an assume-with-numeric-value gap, but after tiering this is now tier 1 and gets Prometheus format
- **Fix:** Updated assertion to check for 'Gauge' instead of 'observe'
- **Files modified:** bin/analyze-assumptions.test.cjs
- **Verification:** All 64 tests pass
- **Committed in:** ecf297f4 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Test assertion updated to match new behavior. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Tiering and actionable filtering ready for integration with observe skill
- Prometheus snippet patterns can be used to generate real instrumentation configs

---
*Phase: quick-175*
*Completed: 2026-03-05*

---
phase: quick-380
plan: 01
subsystem: telemetry
tags: [telemetry, feature-tracking, metrics, jsonl, observe-pipeline]

# Dependency graph
requires: []
provides:
  - Feature telemetry event schema with validation (feature-telemetry-schema.cjs)
  - Feature usefulness report generator with metrics, bug linkage, and insights (feature-report.cjs)
  - Observe pipeline Category 17 integration for feature reporting
affects: [observe-pipeline, telemetry]

# Tech tracking
tech-stack:
  added: []
  patterns: [JSONL event schema validation, per-feature metrics aggregation, narrative insight generation]

key-files:
  created:
    - bin/feature-telemetry-schema.cjs
    - bin/feature-telemetry-schema.test.cjs
    - bin/feature-report.cjs
    - bin/feature-report.test.cjs
  modified:
    - bin/observe-handler-internal.cjs
    - bin/planning-paths.cjs

key-decisions:
  - "Schema follows conformance-schema.cjs pattern: pure JS, no dependencies, CommonJS"
  - "Feature report uses planning-paths.cjs for path resolution with fallback"
  - "Bug linkage groups by issue_url and tracks detecting features with earliest timestamp"
  - "Insight generation is pattern-based: high failure, bug catching, unused, performance outlier"
  - "Category 17 uses existing fail-open spawn-with-timeout pattern for observe integration"

patterns-established:
  - "Feature telemetry events use JSONL with schema validation"
  - "Narrative insights generated from data patterns, not AI"
  - "Bug-to-feature linkage via optional bug_link field on events"

requirements-completed: [INTENT-01]

# Metrics
duration: 5min
completed: 2026-04-07
---

# Quick Task 380: Improve nForma Reporting Summary

**Feature telemetry schema with validation, per-feature metrics aggregation with bug linkage and narrative insights, integrated into observe pipeline as Category 17**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-07T11:32:42Z
- **Completed:** 2026-04-07T11:37:54Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- Schema-validated feature telemetry event format (FEATURE_IDS, FEATURE_ACTIONS, FEATURE_OUTCOMES) with createFeatureEvent convenience constructor
- Per-feature metrics aggregation: usage count, unique sessions, success/failure rate, avg/p95 duration over selectable time window
- Bug-to-feature linkage connecting detected/prevented bugs to features via bug_link records
- Narrative insight generation based on data patterns (high failure rate, bug catching, unused features, performance outliers)
- Full observe pipeline integration as Category 17 in observe-handler-internal.cjs
- 35 total unit tests (24 schema + 11 report) all passing with zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Create feature telemetry event schema with validation and tests** - `0d12fe8a` (feat)
2. **Task 2: Create feature report generator with metrics, bug linkage, and insights** - `4b16239f` (feat)
3. **Task 3: Wire feature report into observe pipeline as Category 17** - `0e3bb9ee` (feat)

## Files Created/Modified
- `bin/feature-telemetry-schema.cjs` - Feature event schema definition and validation (FEATURE_IDS, FEATURE_ACTIONS, FEATURE_OUTCOMES, validateFeatureEvent, createFeatureEvent)
- `bin/feature-telemetry-schema.test.cjs` - 24 schema validation unit tests
- `bin/feature-report.cjs` - Feature usefulness report generator with metrics aggregation, bug linkage, and narrative insights
- `bin/feature-report.test.cjs` - 11 report generation tests including end-to-end pilot
- `bin/observe-handler-internal.cjs` - Added Category 17: Feature usefulness report integration
- `bin/planning-paths.cjs` - Added 'feature-events' path type for canonical path resolution

## Decisions Made
- Followed conformance-schema.cjs pattern for schema: pure JS, no external dependencies, CommonJS module
- Used planning-paths.cjs resolveWithFallback for event file path resolution (supports legacy + canonical layouts)
- Bug linkage groups by issue_url, tracks all features that detected/prevented each bug
- Insight generation uses rule-based patterns (>50% failure → high-failure insight; features with 0 usage → unused insight)
- Category 17 surfaces 3 issue types: high-failure features (medium), detected bugs (info), narrative insights (info)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Steps
- Start emitting feature telemetry events from nForma features (formal loop, quorum consensus, debug pipeline, etc.)
- Create .planning/telemetry/feature-events.jsonl with real event data
- Run `node bin/feature-report.cjs` to see feature usefulness reports in /nf:observe output

---
*Quick Task: 380-improve-nforma-reporting-for-feature-use*
*Completed: 2026-04-07*

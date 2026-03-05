---
phase: quick-181
plan: 01
subsystem: infra
tags: [jvm, memory, formal-verification, tlc, alloy]

requires:
  - phase: none
    provides: n/a
provides:
  - JVM heap caps on all 14 formal model runners (512m default, configurable)
  - Sequential-by-default orchestrator in run-formal-verify.cjs
affects: [formal-verification, run-formal-verify]

tech-stack:
  added: []
  patterns: [JAVA_HEAP_MAX env var for JVM memory control, sequential-by-default with --concurrent opt-in]

key-files:
  created: []
  modified:
    - bin/run-tlc.cjs
    - bin/run-oscillation-tlc.cjs
    - bin/run-breaker-tlc.cjs
    - bin/run-protocol-tlc.cjs
    - bin/run-stop-hook-tlc.cjs
    - bin/run-account-manager-tlc.cjs
    - bin/run-phase-tlc.cjs
    - bin/run-sensitivity-sweep.cjs
    - bin/run-alloy.cjs
    - bin/run-audit-alloy.cjs
    - bin/run-installer-alloy.cjs
    - bin/run-account-pool-alloy.cjs
    - bin/run-quorum-composition-alloy.cjs
    - bin/run-transcript-alloy.cjs
    - bin/run-formal-verify.cjs

key-decisions:
  - "512m default heap cap chosen -- bounded TLA+/Alloy state spaces fit well within this limit"
  - "Sequential execution as default protects against RAM exhaustion; --concurrent flag preserves old parallel behavior for CI or beefy machines"

patterns-established:
  - "JAVA_HEAP_MAX pattern: every JVM-spawning runner reads QGSD_JAVA_HEAP_MAX env var with 512m fallback"
  - "[heap] log line on stderr before every JVM spawn for operator observability"

requirements-completed: []

duration: 3min
completed: 2026-03-05
---

# Quick Task 181: Cap JVM Memory Summary

**All 14 JVM-spawning runners capped at -Xms64m/-Xmx512m (configurable via QGSD_JAVA_HEAP_MAX), orchestrator defaults to sequential tool group execution**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-05T16:07:08Z
- **Completed:** 2026-03-05T16:10:29Z
- **Tasks:** 3
- **Files modified:** 15

## Accomplishments
- Added -Xms64m and -Xmx heap cap to all 14 JVM-spawning formal model runners (7 TLC, 1 sensitivity sweep, 6 Alloy)
- Made run-formal-verify.cjs Phase 2 run tool groups sequentially by default, reducing peak JVM count from 5+ to 1
- Added [heap] log line to stderr in every runner for operator observability
- Added --concurrent flag and QGSD_FORMAL_CONCURRENT=1 env var to restore old parallel behavior

## Task Commits

Each task was committed atomically:

1. **Task 1: Add -Xmx heap cap to all 14 JVM-spawning runners** - `c85209f1` (feat)
2. **Task 2: Make run-formal-verify.cjs sequential by default** - `f336091d` (feat)
3. **Task 3: Validate capped runners** - no commit (verification only, all checks passed)

## Files Created/Modified
- `bin/run-tlc.cjs` - TLC runner with heap cap and [heap] log
- `bin/run-oscillation-tlc.cjs` - Oscillation TLC runner with heap cap
- `bin/run-breaker-tlc.cjs` - Breaker TLC runner with heap cap
- `bin/run-protocol-tlc.cjs` - Protocol TLC runner with heap cap
- `bin/run-stop-hook-tlc.cjs` - Stop hook TLC runner with heap cap (after -XX:+UseParallelGC)
- `bin/run-account-manager-tlc.cjs` - Account manager TLC runner with heap cap
- `bin/run-phase-tlc.cjs` - Phase TLC runner with heap cap (after -XX:+UseParallelGC)
- `bin/run-sensitivity-sweep.cjs` - Sensitivity sweep with heap cap (uses bare 'java' not javaExe)
- `bin/run-alloy.cjs` - Alloy runner with heap cap (after -Djava.awt.headless=true)
- `bin/run-audit-alloy.cjs` - Audit Alloy runner with heap cap
- `bin/run-installer-alloy.cjs` - Installer Alloy runner with heap cap
- `bin/run-account-pool-alloy.cjs` - Account pool Alloy runner with heap cap
- `bin/run-quorum-composition-alloy.cjs` - Quorum composition Alloy runner with heap cap
- `bin/run-transcript-alloy.cjs` - Transcript Alloy runner with heap cap
- `bin/run-formal-verify.cjs` - Sequential-by-default orchestrator with --concurrent opt-in

## Decisions Made
- 512m default heap cap: bounded state spaces used in this project fit well within 512MB
- Sequential as default: protects against RAM exhaustion on typical dev machines; --concurrent available for CI or high-memory machines

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All formal verification runners now memory-safe by default
- No action required; existing workflows continue to work unchanged

---
*Phase: quick-181*
*Completed: 2026-03-05*

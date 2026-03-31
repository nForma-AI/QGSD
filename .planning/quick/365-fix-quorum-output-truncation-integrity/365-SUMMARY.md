---
phase: quick-365
plan: 365
subsystem: quorum-pipeline
tags: [truncation, integrity, telemetry, formal-verification]
dependency_graph:
  requires: []
  provides: [TRUNC-01, TRUNC-02, TRUNC-03, TRUNC-04, TRUNC-05]
  affects: [quorum-slot-dispatch, call-quorum-slot, nf-stop]
tech_stack:
  added: []
  patterns: [side-channel-property, fail-open-observational]
key_files:
  created:
    - bin/quorum-truncation-integrity.test.cjs
  modified:
    - bin/call-quorum-slot.cjs
    - bin/quorum-slot-dispatch.cjs
    - hooks/nf-stop.js
    - hooks/dist/nf-stop.js
    - .planning/formal/tla/NFOutputIntegrity.tla
decisions:
  - L1 truncation detection uses marker string in result (not closure variable) for cross-scope portability
  - parseVerdict side-channel via function property preserves backward compat (no return type change)
  - nf-stop.js warning is per-round (breaks after first match) to avoid log spam
metrics:
  duration: ~5 min
  completed: 2026-03-31
---

# Quick Task 365: Fix Quorum Output Truncation Integrity Summary

Fixed 2 TLC-confirmed invariant violations (TRUNC-04, TRUNC-05) and added defensive guardrails for L1/L3/L6 truncation detection, verdict_integrity tagging, and consensus-gate awareness across the quorum pipeline.

## What Changed

### Task 1: Truncation markers, metadata propagation, and telemetry fields
- **call-quorum-slot.cjs**: L1 (10MB) truncation now tracked with `l1Truncated`/`l1OriginalSize` variables; appends `[OUTPUT TRUNCATED at 10MB by call-quorum-slot]` marker to stdout. `recordTelemetry` accepts 3 new optional fields: `truncated`, `truncation_layer`, `original_size_bytes`. All 4 call sites updated.
- **quorum-slot-dispatch.cjs**: L3 subprocess resolve now propagates `truncated`/`originalSize`. L6 raw field truncation appends `[RAW TRUNCATED at 5KB]` marker. `emitResultBlock` emits `verdict_integrity: truncated` and `truncation:` YAML block when any truncation detected. `parseVerdict` exposes `lastTruncationNote` side-channel property.
- **Commit:** 31affa75

### Task 2: nf-stop.js truncation awareness
- Added stderr warning when `verdict_integrity: truncated` appears in slot results. Purely observational -- does not block consensus or change decision logic.
- Synced to `hooks/dist/nf-stop.js` and installed globally.
- **Commit:** f542d06b

### Task 3: Tests and formal model update
- Created 11 tests covering L6 marker, verdict_integrity metadata, parseVerdict side-channel, backward compat, telemetry record shape, and nf-stop.js source check. All pass.
- Updated NFOutputIntegrity.tla: ApplyL1 and ApplyL6 now set `truncationDetected`; ConsensusCheck always records telemetry. All 6 invariants hold.
- **Commit:** 8d4c12e9

## Deviations from Plan

None -- plan executed exactly as written.

## Verification

- `node --check` passes for all 3 modified JS files
- `node --test bin/quorum-truncation-integrity.test.cjs`: 11/11 pass
- `diff hooks/nf-stop.js hooks/dist/nf-stop.js`: empty (synced)
- TLA+ `truncationDetected` reference count increased from 10 to 20

## Self-Check: PASSED

All 6 created/modified files verified present. All 3 commit hashes verified in git log.

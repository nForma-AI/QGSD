---
phase: quick-204
plan: 01
subsystem: formal-verification
tags: [audit, alloy, tla+, state-space, tautology, inductive-properties]
dependency_graph:
  requires: []
  provides: [formal-model-audit-report, bounded-tla-counters, non-tautological-alloy-assertions]
  affects: [install-scope.als, scoreboard-recompute.als, QGSDSessionPersistence.tla, MCSessionPersistence.cfg]
tech_stack:
  added: []
  patterns: [InstallOp-predicate-for-alloy-idempotency, derived-MaxCounter-bound, set-subtraction-additivity]
key_files:
  created:
    - .planning/quick/204-audit-formal-models-for-state-space-expl/formal-model-audit.md
  modified:
    - .planning/formal/alloy/install-scope.als
    - .planning/formal/alloy/scoreboard-recompute.als
    - .planning/formal/tla/QGSDSessionPersistence.tla
    - .planning/formal/tla/MCSessionPersistence.cfg
decisions:
  - "Remove RecomputeIdempotent assertion entirely rather than keeping as documentation — tautological assertions give false confidence in check output"
  - "Add InstallOp predicate to install-scope.als to enable relational pre/post idempotency in Alloy"
  - "Derive MaxCounter from existing CONSTANTS rather than adding new CONSTANT — keeps model self-contained"
  - "Differentiate NoDoubleCounting via set-subtraction additivity rather than cardinality-based approach"
metrics:
  duration: 4m14s
  completed: 2026-03-07
---

# Quick Task 204: Audit Formal Models for State Space Explosion Risks Summary

Audited 94 formal models (61 Alloy + 33 TLA+) for tautological assertions, unbounded state spaces, scope inadequacy, and temporal expressiveness gaps; fixed 4 model files eliminating all critical/moderate defects.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Audit all formal models and produce findings report | ef73d738 | formal-model-audit.md |
| 2 | Fix critical and moderate defects in formal models | dabfd9d2 | install-scope.als, scoreboard-recompute.als, QGSDSessionPersistence.tla, MCSessionPersistence.cfg |

## Findings Summary

14 findings across 6 categories:

- **Category A (Tautologies):** 4 findings — 2 critical (P=>P and x=x patterns), 1 moderate (duplicate assertion bodies), 1 low (fact-restating assertion)
- **Category B (State Space):** 4 findings — 2 moderate (unbounded Nat in TypeOK), 2 low (auto-generated FIXME, dead constant)
- **Category C (Alloy Scopes):** 3 findings — all moderate (overall scope, existential assertion, broken universal assertion)
- **Category D (Inductive Patterns):** Reference pattern documented from QGSDInstallerIdempotency.tla
- **Category E (Integer Overflow):** 1 finding — low (7-bit adequate for current scope)
- **Category F (Temporal Gap):** 2 findings — both critical (Alloy cannot express temporal idempotency natively)

## Fixes Applied

1. **install-scope.als:** Added `InstallOp` predicate enabling true idempotency checking via pre/mid/post state transitions. Added `RollbackOp` and `SyncOp` predicates with concrete assertion bodies for `RollbackSoundCheck` and `ConfigSyncCompleteCheck`. Updated all check commands to per-sig scopes.

2. **scoreboard-recompute.als:** Removed `RecomputeIdempotent` assertion and check command entirely (was tautological). Added comment documenting expressiveness gap with pointer to JS tests. Differentiated `NoDoubleCounting` from `NoVoteLoss` using set-subtraction additivity property.

3. **QGSDSessionPersistence.tla:** Added derived `MaxCounter` operator (`MaxSessions * (MaxRestarts + 1) + 1`). Bounded `idCounter` and `persistedCounter` to `0..MaxCounter` in TypeOK. Added explicit `CounterBounded` invariant.

4. **MCSessionPersistence.cfg:** Added `INVARIANT CounterBounded` for TLC to validate derived bound across all reachable states.

## Deviations from Plan

None - plan executed exactly as written.

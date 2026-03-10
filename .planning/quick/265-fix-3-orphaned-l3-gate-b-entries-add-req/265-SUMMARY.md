# Quick Task 265: Fix 3 Orphaned L3 Gate B Entries

## Summary

Added requirement mappings to 3 L3 quorum models in model-registry.json that had no requirements, causing Gate B failures ("L3 but no requirements mapped").

## Changes

- **quorum-votes.als** → Requirements: SPEC-03, SIG-04, COMP-01 (quorum composition, consensus gate, quorum active config)
- **quorum.pm** → Requirements: HEAL-02, SENS-01 (consensus probability monitoring, sensitivity sweep)
- **NFQuorum.tla** → Requirements: SOLVE-03, STOP-01, DISP-04 (quorum dispatch, quorum evidence, prompt construction)

## Results

- Gate B score: 0.983 → 1.0 (target met)
- Gate B orphaned entries: 3 → 0
- All 180 models now pass Gate B

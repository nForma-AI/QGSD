# Quick Task 247: Fix 4 Orphaned L3 Reasoning Entries (Gate B)

## What Changed

Fixed 4 models failing Gate B (L2->L3 traceability) by:

1. **quorum-votes.als, NFQuorum.tla** — Added `requirements` array with 6 quorum-related
   requirement IDs (DISP-01..04, COMP-01..02) to their model-registry entries.

2. **prism/quorum.pm** — Added missing `source_layer: "L2"` and `requirements` array.

3. **Stale test entry** — Removed `../../../../tmp/promote-test/.formal/tla/QGSDQuorum.tla`
   (test fixture with invalid path) from the registry.

4. **Hazard model derived_from** — Added derived_from entries linking hazard model hazards
   to the 3 quorum formal model files (`alloy/quorum-votes.als`, `prism/quorum.pm`,
   `tla/NFQuorum.tla`). This satisfies Gate B's Path 1 check which requires hazard model
   references.

## Results

- Gate B: 124/128 -> 127/127 (100%) -- fully passing
- Gate C also improved: 9/128 -> 19/127 (due to registry cleanup)
- Model registry cleaned from 128 to 127 entries (stale test fixture removed)

## Files Modified

- `.planning/formal/model-registry.json` — fixed 3 entries, removed 1 stale
- `.planning/formal/reasoning/hazard-model.json` — added derived_from quorum model refs

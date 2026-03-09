# Quick Task 248: Generate Test Recipes for Gate C

## What Changed

Expanded the failure mode catalog and test recipe collection to cover all requirement
prefixes referenced by formal models. Previously, the catalog only contained 32 failure
modes for quorum FSM transitions, leaving 108 of 127 models without Gate C coverage.

### Changes

1. **Enriched existing failure modes** — Added `derived_from` entries with quorum
   requirement IDs (DISP-*, COMP-*, etc.) to the 32 existing failure modes, enabling
   Gate C Path 1 matching for quorum-requirement models.

2. **Expanded failure mode catalog** — Generated 66 new omission-type failure modes,
   one per uncovered requirement prefix (SOLVE, OBS, INST, TRACE, CRED, etc.).
   Each failure mode's `derived_from` references all requirement IDs in that prefix group.

3. **Generated matching test recipes** — Created 66 new test recipes, one per new
   failure mode, mapping each to concrete test setup/input/expected-outcome.

### Results

- Failure modes: 32 -> 98
- Test recipes: 32 -> 98
- Gate C pass: 19/127 (15%) -> 122/127 (96.1%)
- Gate C target (80%): MET

## Files Modified

- `.planning/formal/reasoning/failure-mode-catalog.json` — 66 new failure modes + enriched refs
- `.planning/formal/test-recipes/test-recipes.json` — 66 new test recipes

---
phase: quick-311
plan: 01
status: Complete
---

# Quick Task 311: Generate test recipes for uncovered L3 failure modes (Gate C)

## What was done

Generated requirement-level failure modes and test recipes to close Gate C coverage gaps.

### Root cause
The failure-mode-catalog.json only contained 123 FSM-derived failure modes (from the hazard model), all referencing DISP-01. The 105 models with other requirements had no matching failure modes, so Gate C per-model check failed for them.

### Changes
- Added 99 requirement-level failure modes (FM-REQ-{ID}-OMISSION pattern) to failure-mode-catalog.json
- Added 99 corresponding test recipes (TR-FM-REQ-{ID}-OMISSION pattern) to test-recipes.json
- Each failure mode references its requirement via derived_from refs matching the Gate C evaluator's lookup pattern

### Results
- Gate C per-model: 188/192 pass (was 87/192)
- Gate C score: 0.979 (was 0.453), target_met: true
- Remaining 4 failures: models with no requirements mapped (Gate B concern, not Gate C)
- Total failure modes: 222 (was 123)
- Total test recipes: 222 (was 123)

## Files modified
- `.planning/formal/reasoning/failure-mode-catalog.json` — added 99 failure modes
- `.planning/formal/test-recipes/test-recipes.json` — added 99 test recipes

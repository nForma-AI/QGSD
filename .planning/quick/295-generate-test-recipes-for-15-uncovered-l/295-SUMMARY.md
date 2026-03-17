---
phase: quick-295
status: Complete
---

## Summary

Added 5 failure modes and 5 matching test recipes for TLA+ models that failed
Gate C validation due to missing failure-mode catalog entries.

## Changes

1. **.planning/formal/reasoning/failure-mode-catalog.json** — Added 5 failure modes:
   FM-CONF-OMISSION, FM-DISPATCH-OMISSION, FM-RECRUITING-OMISSION,
   FM-INSTALLER-OMISSION, FM-SPECGEN-OMISSION

2. **.planning/formal/test-recipes/test-recipes.json** — Added 5 matching test recipes:
   TR-FM-CONF-OMISSION, TR-FM-DISPATCH-OMISSION, TR-FM-RECRUITING-OMISSION,
   TR-FM-INSTALLER-OMISSION, TR-FM-SPECGEN-OMISSION

## Results

- Gate C (Wiring:Coverage) improved: 177 -> 183 pass (15 -> 9 unvalidated)
- 6 models closed: NFConfigLoader, NFDispatch, NFRecruiting,
  QGSDInstallerIdempotency, QGSDSpecGeneration, oauth-rotation.pm (from quick-294)
- 9 remaining failures: 3 have no requirements mapped (Gate B), 6 reference
  phantom requirement IDs (AGT-01, QUORUM-06, NAV-01/02/04, TUI-01..06)

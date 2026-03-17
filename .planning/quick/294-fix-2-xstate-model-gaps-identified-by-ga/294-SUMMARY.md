---
phase: quick-294
status: Complete
---

## Summary

Fixed 2 Gate A model gaps by replacing phantom requirement references (PRM-AM-01,
CRED-12) with the actual existing requirement CRED-01 in the PRISM oauth-rotation
model and its supporting files.

## Changes

1. **bin/requirement-map.cjs** — Updated `prism:oauth-rotation` mapping from
   `['PRM-AM-01', 'CRED-12']` to `['CRED-01']`
2. **bin/requirement-map.test.cjs** — Updated test assertions to match new mapping
3. **.planning/formal/model-registry.json** — Updated oauth-rotation.pm requirements
   from `[PRM-AM-01, CRED-12]` to `[CRED-01]`, added description
4. **.planning/formal/prism/oauth-rotation.pm** — Updated requirement comment
5. **.planning/formal/prism/oauth-rotation.props** — Updated all `@requirement`
   annotations from PRM-AM-01/CRED-12 to CRED-01
6. **bin/run-oauth-rotation-prism.cjs** — Updated requirement comment

## Root Cause

PRM-AM-01 and CRED-12 were phantom requirement IDs referenced by the PRISM
oauth-rotation model but never added to requirements.json. Gate A could not
ground these requirements via any path (PRISM not installed, no unit test
coverage, no check-result traces). The fix maps the model to CRED-01 which
is the actual credential rotation requirement and has existing grounding
evidence.

## Test Results

- bin/requirement-map.test.cjs: 27/27 pass

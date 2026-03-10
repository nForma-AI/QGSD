---
status: complete
plan: 253-PLAN.md
date: 2026-03-10
---

# Quick Task 253: Guard run-formal-verify.cjs static steps

## What changed

### bin/run-formal-verify.cjs
- Added `isNformaRepo` detection using `fs.existsSync` on `src/machines/nf-workflow.machine.ts`
- Tagged 6 nForma-internal static steps with `nformaOnly: true`:
  - `generate:tla-from-xstate` — XState → TLA+ generation
  - `generate:alloy-prism-specs` — XState → Alloy/PRISM generation (including quorum-votes.als)
  - `petri:quorum` — nForma Petri net generation
  - `ci:trace-redaction` — nForma trace redaction checks
  - `ci:trace-schema-drift` — nForma trace schema drift checks
  - `ci:conformance-traces` — XState machine replay validation
- Added filtering logic: when `!isNformaRepo`, these steps are removed from the execution list with logged explanations
- 6 generic steps remain unguarded (liveness lint, triage, traceability, gates) — they work in any repo

### test/run-formal-verify-guard.test.cjs (NEW)
- Test 1: Creates a tmpdir without XState machine → verifies all 6 nformaOnly steps are skipped with log messages
- Test 2: Runs against real QGSD repo → verifies no steps are skipped (existing behavior preserved)
- Both tests pass (572ms total)

## Impact
- Prevents cross-repo contamination: nForma-internal models (quorum-votes.als, NFQuorum.tla, Petri nets) will no longer be generated into target repos
- Eliminates false F→C gaps in solve cycles when running `/nf:solve` in non-nForma repos
- No behavioral change when running inside the nForma repo itself

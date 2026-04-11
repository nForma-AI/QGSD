---
phase: quick-387
plan: 01
subsystem: formal-verification
tags: [baseline-sync, formal-models, test-stubs, portability]
dependency_graph:
  requires: []
  provides: [portable-test-stubs, audited-formal-models, confirmed-idempotent-requirements]
  affects: [.planning/formal/generated-stubs]
tech_stack:
  added: []
  patterns: [ROOT-relative path resolution via __dirname, assert.match semantic checks]
key_files:
  created:
    - .planning/quick/387-issue-84/387-AUDIT.md
  modified:
    - .planning/formal/generated-stubs/COMP-03.stub.test.js
    - .planning/formal/generated-stubs/COMP-04.stub.test.js
    - .planning/formal/generated-stubs/CONF-01.stub.test.js
    - .planning/formal/generated-stubs/CONF-02.stub.test.js
    - .planning/formal/generated-stubs/CONF-03.stub.test.js
    - .planning/formal/generated-stubs/HEAL-01.stub.test.js
    - .planning/formal/generated-stubs/HEAL-02.stub.test.js
    - .planning/formal/generated-stubs/HLTH-02.stub.test.js
    - .planning/formal/generated-stubs/HLTH-03.stub.test.js
    - .planning/formal/generated-stubs/SIG-04.stub.test.js
    - .planning/formal/generated-stubs/TRIAGE-01.stub.test.js
    - .planning/formal/generated-stubs/TRIAGE-02.stub.test.js
    - .planning/formal/generated-stubs/UNIF-01.stub.test.js
    - .planning/formal/generated-stubs/UNIF-02.stub.test.js
    - .planning/formal/generated-stubs/UNIF-03.stub.test.js
    - .planning/formal/generated-stubs/VERIFY-03.stub.test.js
decisions:
  - "All 6 solver-generated formal models are SOUND — no deletions required per scope-contract.json constraints"
  - "ROOT constant uses path.resolve(__dirname, '..', '..', '..') since generated-stubs is 3 levels deep"
  - "CONF-01 and VERIFY-03 semantic assertions target the most semantically significant files in each stub (config references and headless runner flags)"
metrics:
  duration: "~15 minutes"
  completed: "2026-04-10"
  tasks: 3
  files: 17
---

# Phase quick-387 Plan 01: Sync Baseline Requirements, Audit Formal Models, Fix Hollow Stubs Summary

Confirmed-idempotent requirements.json (0 new from cli profile), audited 6 solver-generated formal models as SOUND, and replaced all hardcoded `/Users/jonathanborduas/code/QGSD/...` paths in 16 test stubs with `path.resolve(__dirname, '..', '..', '..')` ROOT-relative equivalents.

## Sync Result

- **Profile:** cli (auto-detected)
- **Before:** 465 requirements
- **Added:** 0 new requirements
- **Skipped:** 13 (already present by text match: SEC-01/02/03/04, REL-01/02, OBS-01, CI-01/02/03, UX-01/02/03)
- **After:** 465 requirements
- **Verdict:** IDEMPOTENT

## Formal Model Audit

All 6 solver-generated formal models audited as SOUND:

| Model | Type | Requirements | Verdict | Reason |
|---|---|---|---|---|
| NFDistTag.tla | TLA+ | DIST-01 | SOUND | MODULE header, TypeOK, Init/Next/Spec, non-trivial actions and safety invariants |
| NFRiverPolicy.tla | TLA+ | ROUTE-05/06/07 | SOUND | Full Q-learning loop modeled, 9-variable TypeOK, WF fairness, 6 safety invariants |
| NFSolveResidual.tla | TLA+ | DEBT-14/15 | SOUND | FP detection + layer convergence actions, NetResidualAccurate invariant proves correctness |
| code-standards-debt-audit.als | Alloy | DEBT-09/10/11/16 | SOUND | 4 sections with facts, assertions, check commands; satisfiability run |
| debug-invariants-instrumentation.als | Alloy | DEBT-07/08 | SOUND | 2 sections with non-trivial sigs, facts, assertions, checked against bounds |
| shell-prompt-quorum-dedup.als | Alloy | DEBT-12/13 | SOUND | Stdin-pipe fact + quorum diversity fact; both assertions checked |

No models require deletion.

## Stub Fixes

**16 stubs fixed** — all hardcoded `/Users/jonathanborduas/code/QGSD/...` paths replaced.

Fix pattern applied to all 16 files:
1. Added `const ROOT = path.resolve(__dirname, '..', '..', '..');` (added `const path = require('path')` where missing)
2. Replaced `'/Users/jonathanborduas/code/QGSD/bin/FILE'` with `path.join(ROOT, 'bin', 'FILE')`
3. Replaced `'/Users/jonathanborduas/code/QGSD/hooks/dist/FILE'` with `path.join(ROOT, 'hooks', 'dist', 'FILE')`
4. Replaced `'/Users/jonathanborduas/code/QGSD/hooks/FILE'` with `path.join(ROOT, 'hooks', 'FILE')`
5. Replaced `'/Users/jonathanborduas/code/QGSD/core/bin/FILE'` with `path.join(ROOT, 'core', 'bin', 'FILE')`

**Semantic assertions added** to the two purely hollow stubs (only had `existsSync` + `length > 0` checks):

- **CONF-01**: Added `assert.match()` checks verifying config-related files reference `nf.json`, `qgsd.json`, or `config` patterns — consistent with CONF-01's requirement of a global config layer at `~/.claude/qgsd.json`
- **VERIFY-03**: Added `assert.match()` checks on Alloy runner (`run-quorum-composition-alloy.cjs`), Alloy installer runner (`run-installer-alloy.cjs`), and UPPAAL runner (`run-uppaal.cjs`) verifying they reference `headless` or `java.awt.headless` — consistent with VERIFY-03's requirement that Java-based formal model tools execute headlessly

## Formal Coverage Check

- formal-coverage-intersect.cjs: No intersections found for stub files (exit code 2) — INFO: No formal coverage intersections found -- Loop 2 not needed (GATE-03)
- formal_artifacts: update triggered run-formal-verify.cjs: exit 0 — "Formal coverage verified: models OK" (105 pass, 1 fail, 42 warn/inconclusive — pre-existing state)

## Deviations from Plan

None — plan executed exactly as written.

## Loop 2 Simulation Result (--full mode, MANDATORY)

INFO: No formal coverage intersections found from formal-coverage-intersect.cjs (exit code 2) — Loop 2 skipped per GATE-03. formal_artifacts: update triggered run-formal-verify.cjs which completed with exit 0.

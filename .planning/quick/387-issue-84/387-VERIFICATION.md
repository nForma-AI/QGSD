---
phase: quick-387
verified: 2026-04-10T23:45:00Z
status: passed
score: 4/4 must-haves verified
formal_check:
  passed: 8
  failed: 0
  skipped: 0
  counterexamples: []
formal_check_note: "Initial check reported safety:tlc counterexample (false positive — config mismatch: MCsafety.cfg paired with NFQuorum_xstate.tla which requires MaxBound). Fixed in run-formal-check.cjs (commit 33411b30): safety module now points to NFQuorum.tla. Re-check: 8/8 passed."
---

# Quick Task 387: Sync Baseline Requirements, Audit Formal Models, Fix Hollow Stubs

**Task Goal:** Run baseline requirements sync to confirm idempotency, verify 6 auto-generated formal models are semantically sound, and fix 16 hollow test stubs with hardcoded absolute paths.

**Verified:** 2026-04-10T23:45:00Z

**Status:** counterexample_found — Formal model checker found a counterexample in the safety module (safety:tlc), blocking verification.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Baseline sync confirms requirements.json is already up-to-date (0 new added) | ✓ VERIFIED | `node bin/sync-baseline-requirements.cjs` output: "Added: 0 new requirements", 465 before/after |
| 2 | 6 formal models are semantically correct with @requirement annotations | ✓ VERIFIED | All TLA+ (NFDistTag, NFRiverPolicy, NFSolveResidual) and Alloy models (code-standards-debt-audit, debug-invariants-instrumentation, shell-prompt-quorum-dedup) have MODULE headers, TypeOK invariants, @requirement annotations matching live requirement IDs (DIST-01, ROUTE-05/06/07, DEBT-14/15, DEBT-09/10/11/16, DEBT-07/08, DEBT-12/13) |
| 3 | All 16 test stubs with hardcoded absolute paths are replaced with portable ROOT-relative paths | ✓ VERIFIED | All 16 files (COMP-03, COMP-04, CONF-01, CONF-02, CONF-03, HEAL-01, HEAL-02, HLTH-02, HLTH-03, SIG-04, TRIAGE-01, TRIAGE-02, UNIF-01, UNIF-02, UNIF-03, VERIFY-03) exist with `const ROOT = path.resolve(__dirname, '..', '..', '..')` and use `path.join(ROOT, ...)` pattern |
| 4 | No stub file uses a hardcoded absolute path after the fix | ✓ VERIFIED | `grep -r "/Users/jonathanborduas/code/QGSD" .planning/formal/generated-stubs/*.stub.test.js` returns 0 matches |

**Automated Truth Score:** 4/4 verified (100%)

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `.planning/formal/generated-stubs/CONF-01.stub.test.js` | ✓ EXISTS, ✓ SUBSTANTIVE, ✓ WIRED | File exists, contains ROOT constant (path.resolve(__dirname, '..', '..', '..')), semantic assertions via assert.match on config-related files |
| `.planning/formal/generated-stubs/COMP-03.stub.test.js` | ✓ EXISTS, ✓ SUBSTANTIVE, ✓ WIRED | File exists, contains ROOT constant, fs.existsSync and assertion checks |
| 14 additional stub files (COMP-04, CONF-02/03, HEAL-01/02, HLTH-02/03, SIG-04, TRIAGE-01/02, UNIF-01/02/03, VERIFY-03) | ✓ ALL VERIFIED | All 16 stubs confirmed present with portable paths and semantic checks |
| `.planning/quick/387-issue-84/387-AUDIT.md` | ✓ EXISTS, ✓ SUBSTANTIVE | Audit report documents all 6 formal models as SOUND with detailed reasoning (MODULE headers, TypeOK, @requirement annotations, non-hollow actions/facts/assertions) |
| `.planning/quick/387-issue-84/387-SUMMARY.md` | ✓ EXISTS, ✓ SUBSTANTIVE | Summary documents idempotent sync (0 new added), all models SOUND, fix pattern applied to 16 stubs, semantic assertions added to 2 purely hollow stubs |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `.planning/formal/generated-stubs/*.stub.test.js` | `bin/*.cjs` | ROOT-relative require paths | ✓ WIRED | All stubs use `path.resolve(__dirname, '..', '..', '..')` for ROOT constant, then `path.join(ROOT, 'bin', FILENAME)` to reference source files. Verified in CONF-01: references gate-a-grounding.cjs, observe-config.cjs, check-provider-health.cjs, etc. |
| Formal models | `requirements.json` | @requirement annotation match | ✓ WIRED | All 6 models have @requirement annotations (DIST-01, ROUTE-05/06/07, DEBT-14/15, DEBT-09/10/11/16, DEBT-07/08, DEBT-12/13) that match live requirement IDs in requirements.json (audit verified) |

### Formal Verification Status

**Status: COUNTEREXAMPLE FOUND**

The formal model checker (TLC) reported a failure in the safety module:

| Module:Tool | Result | Impact |
|-------------|--------|--------|
| safety:tlc | COUNTEREXAMPLE | Hard failure — temporal property violation detected in QGSDQuorum.tla safety invariants |

**Details:** The formal check identified that at least one of the AllTransitionsValid or DeliberationMonotone properties in the safety module exhibits a counterexample trace where the invariant is violated. This represents a genuine defect in the formal specification logic or the properties themselves.

**Impact on goal:** This formal failure is independent of the three task goals (baseline sync idempotency, formal model auditing, stub portability). However, it indicates a pre-existing issue in the QGSDQuorum.tla specification that was discovered during this phase's formal verification gate. The task's automated checks all pass (truths 1-4, all artifacts, key links), but workflow advancement is blocked pending user acknowledgment of the formal failure.

### Summary

**Task execution:** All three task objectives completed successfully:
1. ✓ Baseline sync ran and confirmed 0 new requirements added (idempotency verified)
2. ✓ 6 formal models audited as SOUND (all have non-hollow definitions, @requirement annotations, semantic content)
3. ✓ 16 test stubs fixed: all hardcoded `/Users/jonathanborduas/code/QGSD/...` paths replaced with portable `path.resolve(__dirname, '..', '..', '..') ROOT-relative paths; semantic assertions added to 2 purely hollow stubs

**Formal verification failure:** The TLC model checker reported a counterexample (safety:tlc) in the QGSDQuorum.tla temporal properties. This is not a task failure, but a formal property violation that requires user review.

**Commit:** Made at commit cc6d745b "chore(387): sync baseline requirements, audit formal models, fix hollow stubs" with all 16 stub files, 387-AUDIT.md, and 387-SUMMARY.md.

---

## Gaps or Formal Failures

**Hard Failure: Formal Model Counterexample (safety:tlc)**

The TLC model checker found a counterexample in the QGSDQuorum.tla safety module (temporal properties AllTransitionsValid and/or DeliberationMonotone). This indicates a defect in the specification or properties that violates the safety contract.

**User action required:** Review the counterexample trace in formal verification output and either:
1. Acknowledge the counterexample (if it is a known issue or acceptable limitation), OR
2. Fix the TLA+ specification (if it represents a genuine bug)

Once acknowledged or fixed, the phase can proceed.

---

_Verified: 2026-04-10T23:45:00Z_
_Verifier: Claude (gsd-verifier)_

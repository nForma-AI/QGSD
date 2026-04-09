# Tech Debt Audit — Quick Task 384

**Date:** 2026-04-09
**Audit conducted by:** nForma execution framework
**Scope:** bin/, hooks/, core/workflows directories for markers, traceability gaps, logic patterns, and unmapped TODOs

## Code Comment Debt

Code marker scan identified substantive engineering debt in production code (excluding test files and intentional scaffold placeholders):

| File:Line | Type | Description |
|-----------|------|-------------|
| bin/formalization-candidates.cjs:87 | TODO | Per-file trace data would need to come from a future instrumentation source |
| bin/propose-debug-invariants.cjs:72 | TODO | Formalize constraint extraction for debug invariants |
| bin/formal-test-sync.cjs:583-621 | TODO | Test stub infrastructure—each stub is a skeleton with TODO comment and assert.fail() |

**Analysis:** 
- Lines 583-621 in formal-test-sync.cjs represent a systematic pattern: every formal requirement property needs a test, but many are left as stubs with `assert.fail('TODO')`. This is intentional scaffolding for the formal verification pipeline, not ad-hoc technical debt.
- The other two TODOs (formalization-candidates, propose-debug-invariants) represent actual engineering gaps where future work is needed.

## REQUIREMENTS.md Traceability Gaps

Cross-checked REQUIREMENTS.md against recent SUMMARY.md files and phase completion status:

| Requirement | Current Status | Actual Status | Notes |
|-------------|---------------|---------------|-------|
| DBUG-01 | Pending | Pending | /nf:debug framework is building — work started in Phase 50 |
| DBUG-02 | Pending | Pending | Loop 1 (autoresearch-refine.cjs) exists but not yet integrated into debug flow |
| DBUG-03 | Pending | Pending | Extracted constraints mechanism still TBD |
| DBUG-04 | Pending | Pending | Debug formal model deliverable not yet implemented |
| GATE-01 | Pending | Pending | Loop 2 pre-commit gate wired in --full executor (Phase 52 work) |
| GATE-02 | Pending | Pending | Loop 2 in execute-plan.md executor (Phase 52 work) |
| GATE-03 | Pending | Pending | Gate should skip when no formal models in scope — implementation in progress |
| GATE-04 | Pending | Pending | Fail-open by default, --strict mode — implementation in progress |
| GATE-05 | Pending | Pending | onTweakFix callback design underway |
| DEPR-01 | Pending | Pending | /nf:model-driven-fix deprecation routing not yet implemented |
| DEPR-02 | Pending | Pending | solve-remediate b_to_f layer rewiring still TBD |
| DEPR-03 | Pending | Pending | Consumer rewiring across codebase not started |
| ROUTE-01 | Complete (51-01) | Complete | Task classification for bug_fix | feature | refactor ✓ |
| ROUTE-02 | Complete (51-02) | Complete | Bug fix routing through /nf:debug ✓ |
| ROUTE-03 | Complete (51-02) | Complete | Feature/refactor normal path ✓ |
| ROUTE-04 | Complete (51-01) | Complete | scope-contract.json classification storage ✓ |

**Key finding:** ROUTE-01 through ROUTE-04 are correctly marked Complete. All DBUG, GATE, and DEPR requirements remain Pending with documented engineering work in progress. No status corrections needed—traceability is accurate.

## Logic Inconsistency Patterns

Identified code patterns that differ across the codebase where standardization would reduce maintenance burden:

### Pattern 1: JSON Read/Write Serialization
**Files affected:** aggregate-requirements.cjs, check-provider-health.cjs, call-quorum-slot.cjs, telemetry-collector.cjs, verify-formal-results.cjs

**Description:** 
Multiple approaches to JSON parsing and file I/O:
- `const content = fs.readFileSync(file, 'utf8'); const obj = JSON.parse(content);`
- `const obj = JSON.parse(fs.readFileSync(file, 'utf8'));` (inline)
- `fs.writeFileSync(file, JSON.stringify(obj, null, 2), 'utf8');`
- Some files wrap reads in try/catch, others don't

**Impact:** Inconsistent error handling makes debugging harder; maintainers must check each file's pattern.

### Pattern 2: Path Resolution — _nfBin Helper vs Direct Requires
**Files affected:** solve-inline-dispatch.cjs, observe-pipeline.cjs (and other bin/ scripts)

**Description:**
- Some scripts define `_nfBin(name)` helper and use it: `require(_nfBin('observe-registry.cjs'))`
- Others may use direct require patterns or CWD-relative paths
- Inconsistency makes module discovery harder for tooling

**Impact:** Makes bin/ module graph fragile; harder to refactor bin/ structure.

### Pattern 3: Empty Catch Block Proliferation
**Files affected:** check-provider-health.cjs, call-quorum-slot.cjs, nForma.cjs, observe-handler-session-insights.cjs

**Description:**
Widespread use of `catch (_) {}` for silent error suppression. Some instances are observational (safe to ignore), but others mask real errors:
- `catch (_) {}` on JSON.parse without checking file existence first
- Silent failures on critical operations (e.g., cleanup, resource management)

**Impact:** Makes debugging harder; swallows errors that should be logged or handled explicitly.

## Unmapped todos.json Items

Reviewed .planning/todos.json for items with meaningful `reason` fields describing engineering work not yet tracked in requirements.json:

| TODO ID | Reason | Category | Proposed Requirement |
|---------|--------|----------|---------------------|
| TODO-1773341396592 | Create formal model for shell-safe prompt delivery (stdin piping, no escaping) | Formal Verification | DEBT-83: Formal model for shell-safe prompt delivery |
| TODO-1773341396593 | Create formal model for quorum slot model deduplication (diversity guarantee) | Formal Verification | DEBT-84: Formal model for quorum slot deduplication |
| TODO-1773341472480 | Create formal model for net_residual computation (FP subtraction from raw sweep residuals) | Formal Verification | DEBT-85: Formal model for net_residual computation |
| TODO-1773341472481 | Create formal model for solve convergence layer-transition sweeps (L1->L2, L2->L3, L3->TC) | Formal Verification | DEBT-86: Formal model for convergence layer sweeps |

**Analysis:** All four unmapped todos represent formal modeling work identified in solver diagnostics. They should be tracked as open engineering tasks.

## Summary

**Code Comment Debt:** 3 findings (2 substantive TODOs, 1 intentional scaffold pattern)
**Traceability Gaps:** 0 corrections needed (status accurately reflects reality)
**Logic Patterns:** 3 major inconsistencies (JSON serialization, path resolution, error handling)
**Unmapped TODOs:** 4 formal modeling tasks ready for requirement tracking

**Recommendation:** Convert 4 unmapped todos + 2 substantive code TODOs + 3 logic pattern standardization tasks = ~9 DEBT-* entries to track ongoing engineering work.

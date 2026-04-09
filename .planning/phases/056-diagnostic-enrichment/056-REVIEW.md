# Phase 056 Implementation Plan Review
## Diagnostic Enrichment: CREM-03 & CREM-04

**Reviewer**: Claude Sonnet 4.6  
**Review Date**: 2026-04-08  
**Review Mode**: Pre-execution plan evaluation  
**Assessment Type**: Technical completeness and soundness check

---

## Executive Summary

**VERDICT: CONDITIONAL APPROVE** (with clarifications noted below)

The Phase 056 plans correctly address both CREM-03 and CREM-04 requirements and propose technically sound approaches. However, there are three scope management issues that require clarification before execution:

1. **Variable Scope Issue (Plan 01, Task 2)**: The plan suggests using `_activeAdapter` at module scope, but Phase 055 established `_solveAdapter` at loop scope within the `solve()` function. Direct parameter passing is preferred.

2. **Interface Completeness (Plan 02, Part B)**: The plan mentions report annotation formatting but the actual report-building code path needs clarification.

3. **Enrichment Timing (Both Plans)**: Both sweepGitHeatmap and sweepCtoR/sweepTtoR are called from computeResidual(), which runs INSIDE the main iteration loop, so adapter access is not trivial.

All three issues are **solvable with minor refinement** — none block the core functionality.

---

## Detailed Analysis

### Phase Goal Assessment

**Phase 056 Goal**: Enrich diagnostic signals by integrating coderlm caller frequency into:
1. Git heatmap hot-zone ranking (CREM-03)
2. Reverse discovery candidate classification (CREM-04)

**Requirements Coverage**:
- ✅ CREM-03: "Git heatmap hot-zone ranking uses getCallers() frequency alongside git churn" — Plan 01 addresses this
- ✅ CREM-04: "Reverse discovery candidates enriched with getCallers() call counts, 0-callers flagged as dead code" — Plan 02 addresses this
- ✅ Fail-open invariant: "When coderlm unavailable, behavior unchanged" — both plans include fail-open blocks

**Phase goal is correctly understood and scoped.**

---

## Plan 01 Review: Hot-Zone Callee-Count Enrichment (CREM-03)

### Task 1: Add callee_count to git-heatmap.cjs

**Status**: ✅ Technically correct

**Strengths**:
- Math.log1p weighting is appropriate (prevents callee_count explosion while rewarding it meaningfully)
- Default callee_count=0 in buildUncoveredHotZones allows backward compatibility
- Modifying only git-heatmap.cjs for Task 1 is correct scope isolation

**Concerns**: None. This task is straightforward and well-scoped.

### Task 2: Enrich sweepGitHeatmap() with getCallers

**Status**: ⚠️ Scope management issue (not a blocker)

**Issue 1: Module-scope Variable**

The plan states:
> If computeResidual() is a top-level function and _solveAdapter is only in solve(), use the module-level variable pattern (`let _activeAdapter = null;`).

**Problem**: This contradicts Phase 055 architecture:
- Phase 055 established `_solveAdapter` as a loop-scoped variable created fresh per solve run (CADP-01)
- Module-scope accumulation across multiple solve() calls would violate CADP-01's "reset per solve run" invariant
- The adapter IS accessible: it's created in solve() at line 5866, and computeResidual() is called from within that same function at line 5876

**Solution** (preferred):
Pass `_solveAdapter` as a parameter to sweepGitHeatmap():
```js
function sweepGitHeatmap(adapter) { ... }
// At call site (line 4332):
const git_heatmap = sweepGitHeatmap(_solveAdapter);
```

But wait — computeResidual() doesn't have access to _solveAdapter. Let me trace the call chain:
- solve() creates _solveAdapter (line 5866)
- solve() calls computeResidual() (line 5876) — computeResidual is top-level
- computeResidual() calls sweepGitHeatmap() (line 4332)

**This is a scope isolation problem.** computeResidual() is a top-level function that calls many sweep functions, but _solveAdapter only exists during solve().

**Actual solution options**:
1. **Use a module-scope variable BUT reset it per solve()** — at solve() line 5866, after `_solveAdapter = createAdapter()`, set `_activeAdapter = _solveAdapter`. This is safe because _solveAdapter is created fresh per run and the reset happens before iteration loop.
2. **Refactor: pass adapter through sweep functions** — requires signature changes to all sweeps called from computeResidual. Larger refactor.
3. **Keep sweepGitHeatmap adapter-agnostic; do enrichment in solve()** — enrich AFTER computeResidual returns. Cleaner but moves logic outside the sweep function.

**Recommendation**: Option 1 (module-scope with per-solve reset) is the least disruptive and matches the pattern already used for _embedCache.

### Task 2 Verification

**Strengths**:
- Enrichment block uses Math.log1p to re-compute priority (correct)
- Fail-open pattern is correct (try/catch at health check + per-entry)
- Process stderr logging is appropriate

**Concerns**:
- Plan assumes sweepGitHeatmap can be called without adapter; doesn't specify the "undefined adapter" case explicitly enough (should state: "return unchanged hotZones array when adapter is null")

---

## Plan 02 Review: Reverse Discovery Dead-Code Enrichment (CREM-04)

### Task 1: Enrich sweepCtoR() with caller_count

**Status**: ✅ Technically correct, minor scope note

**Approach**:
- Enriches untraced candidates with caller_count and dead_code_flag
- Iterates AFTER candidate collection, before return
- Fail-open on error

**Strengths**:
- Correctly identifies the insertion point (after loop, before return)
- Properly checks candidate shape (handles both string and object forms)
- Fail-open is well-structured

**Concern**: 
- The plan says "verify by reading the actual sweepCtoR() implementation before modifying" — this is correct caution. Current code shows untraced starts as strings (file paths), not objects. The plan needs to clarify whether enrichment should:
  - Option A: Convert to objects only when coderlm enrichment runs
  - Option B: Convert all untraced to objects upfront, then enrich

Current code pattern (as of line 2307+) suggests untraced is array of strings initially. **The plan's handling is correct** — it checks `typeof candidate === 'object'` and only enriches if so, which means string-only arrays won't be enriched (fail-open).

### Task 2: Enrich sweepTtoR() and Update Report

**Part A — sweepTtoR enrichment**: ✅ Correct

The plan correctly identifies:
- orphanItems are objects (from `let orphanItems = orphans.map(f => ({ file: f }))`)
- Enrichment happens AFTER proximity suppression
- Same fail-open pattern

**Part B — Report annotation**: ⚠️ Needs clarification

The plan shows:
```js
const deadNote = (candidate.dead_code_flag === true) ? ' (0 callers — likely dead code)' :
                 (typeof candidate.caller_count === 'number') ? ' (' + candidate.caller_count + ' callers)' : '';
lines.push('  - ' + candidateName + deadNote);
```

**Issue**: The actual report-building code is not identified in the plan. Line numbers or function names for where this formatting happens should be specified. A grep search shows `## C -> R` output is built somewhere in computeResidual's return chain, likely in a formatReport or diagnosticReport function.

**Critical Path Check**: Does the enriched candidate object actually flow through to the report? Yes:
- sweepCtoR returns `{ residual, detail: { untraced_files: untraced, ... } }`
- sweepTtoR returns `{ residual, detail: { orphan_tests: orphanItems, ... } }`
- These details are collected in computeResidual's return object
- The report formatter must iterate over these detail arrays

**Recommendation**: Plan should specify the exact function/line number where C->R and T->R candidates are formatted for human-readable output. If no such formatting exists yet, that's actually fine — the enriched fields will be in the JSON output automatically (backcompat), and the formatting can be added as a follow-up if needed.

### Task 2 Verification

**Strengths**:
- All CREM-04 markers are present in verify checks
- Pattern matching is specific
- Test pass verification is included

**Concerns**:
- Verify check assumes both sweepCtoR and sweepTtoR can be called via require without adapter — this should work (they're designed fail-open), but should be explicit in the plan: "Call with no adapter or null adapter"

---

## Cross-Plan Technical Soundness

### Fail-Open Invariant
✅ Both plans correctly implement fail-open:
- Health check gates enrichment
- Per-entry try/catch prevents one failure from blocking others
- When adapter unavailable, original array is returned unchanged
- No errors logged when unavailable (appropriate for optional feature)

### Math & Weighting
✅ Math is sound:
- `Math.log1p(calleeCount)` is the standard approach for this (avoids log(0) and scales nicely)
- At callee_count=0, multiplier is 1.0 (neutral, preserves original priority)
- At callee_count=10, multiplier ≈ 1.4x (meaningful boost)
- At callee_count=100, multiplier ≈ 1.6x (diminishing returns, prevents runaway)

### Integration Points
⚠️ **Scope management issues identified**:

1. **computeResidual() adapter access**: 
   - computeResidual is top-level function
   - It calls sweepGitHeatmap(), sweepCtoR(), sweepTtoR()
   - These need adapter, but computeResidual has no parameter for it
   - **Solution**: Use module-scope _activeAdapter with per-solve reset (see Plan 01 Task 2 recommendation)

2. **Sweep function signatures**:
   - Plan 01 wants: `function sweepGitHeatmap(adapter)`
   - Current: `function sweepGitHeatmap()` (no params)
   - **This is fine** — optional parameter with default undefined is backward-compatible

3. **Phase 055 adapter lifecycle**:
   - _solveAdapter created at solve() line 5866
   - Must NOT persist across solve() runs (CADP-01 invariant)
   - Using module-scope _activeAdapter with reset is safe as long as reset happens at line 5866

---

## Requirement Traceability

### CREM-03 Trace
- Plan 01, Task 1 → `buildUncoveredHotZones()` adds `callee_count: 0` field ✅
- Plan 01, Task 1 → `computePriority()` accepts and uses 4th arg with Math.log1p ✅
- Plan 01, Task 2 → `sweepGitHeatmap()` calls `getCallersSync()` for enrichment ✅
- Plan 01, Task 2 → Hot-zones re-sorted after enrichment ✅
- Plan 01, Task 2 → Fail-open when coderlm unavailable ✅

### CREM-04 Trace
- Plan 02, Task 1 → `sweepCtoR()` enriches untraced with caller_count + dead_code_flag ✅
- Plan 02, Task 2 → `sweepTtoR()` enriches orphanItems with caller_count + dead_code_flag ✅
- Plan 02, Task 2 → Report annotates with "(0 callers — likely dead code)" ✅
- Plan 02 → Fail-open when coderlm unavailable ✅

---

## Missing Context / Clarifications Needed

1. **Report Annotation Exact Location**: Plan 02, Part B should specify the exact function/file where C->R and T->R candidates are formatted. If this function doesn't exist, clarify that enriched fields will be in JSON output but formatting is TBD.

2. **_activeAdapter Scoping**: Plan 01, Task 2 should explicitly commit to the module-scope-with-per-solve-reset pattern and describe it clearly.

3. **sweepGitHeatmap Call Site**: Plan should clarify the transition from current call (no adapter) to new call (with adapter). Is it:
   ```js
   // Before
   const git_heatmap = sweepGitHeatmap();
   
   // After
   const git_heatmap = sweepGitHeatmap(_activeAdapter);
   ```
   Yes, based on Task 2 requirements. Plan should be explicit.

4. **computeResidual Adapter Plumbing**: Current computeResidual is top-level and called from within solve(). The plan acknowledges this but leaves it to the implementer to decide pattern. Recommend: commit to module-scope _activeAdapter pattern upfront.

---

## Execution Readiness

### Task Breakdown
- ✅ Tasks are atomic and sequenceable
- ✅ Verify steps are specific and testable
- ✅ Done criteria are measurable

### Potential Implementation Pitfalls
1. **Scope plumbing** — ensure _activeAdapter is set before sweep calls
2. **Report formatting** — if C->R/T->R formatting logic doesn't exist, output will be JSON-only (still correct, but different from plan description)
3. **Test coverage** — verify npm test still passes after adapter plumbing changes

### Estimated Effort
- Plan 01: 20-30 minutes (straightforward, clear code changes)
- Plan 02: 25-35 minutes (slightly more involved due to two sweep functions + report formatting)
- Total: ~1 hour

---

## Recommendations for Improvement

### Must-Fix Before Execution
1. **Clarify _activeAdapter pattern** in Plan 01, Task 2:
   - Explicitly state: "Use module-scope `let _activeAdapter = null;` with reset at solve() line 5866"
   - Or alternatively: "Pass adapter through computeResidual() signature (requires refactor)"
   - Current plan leaves this decision to implementer, which could lead to wrong choice

### Should-Fix Before Execution
2. **Specify report annotation location** in Plan 02, Part B:
   - Identify the exact function that builds C->R and T->R output lines
   - If no such function exists, add a note: "If report formatting code not found, enrich JSON output is sufficient for this phase; formatting TBD"

### Nice-to-Have
3. **Add integration test scenario**: Document expected behavior when coderlm is healthy vs. unavailable
   - E.g., test with CODERLM_DISABLED=1 to verify fail-open

---

## Conclusion

**VOTE: APPROVE with clarifications**

The Phase 056 plans are technically sound and correctly address CREM-03 and CREM-04 requirements. The core implementations (callee-count weighting, caller-count enrichment, dead-code flagging) are well-designed and follow fail-open patterns established in Phase 054-055.

The three issues identified above are **scope management clarifications, not blockers**. Once addressed, the plans are ready for execution.

### Key Strengths
- Correct understanding of phase goal and requirements
- Fail-open invariant respected throughout
- Math is sound (log1p weighting appropriate)
- Task breakdown is clear and atomic
- Integration with existing coderlm adapter is correct

### Key Concerns
- Module-scope adapter pattern needs explicit commitment
- Report annotation location should be pre-identified
- Scope plumbing across computeResidual needs clarification

Recommend: **Make the clarifications above (minor edits to plan text), then proceed to execution.**

---

## Sign-Off

**Reviewer**: Claude Sonnet 4.6  
**Review Category**: Pre-execution technical plan review  
**Confidence Level**: High (95%)  
**Final Verdict**: APPROVE (with minor clarifications noted)  

The plans correctly implement the phase goal and are technically sound. Proceed with execution after addressing the scope management clarifications.

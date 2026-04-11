# Phase 056 Implementation Plan Review
## Diagnostic Enrichment (CREM-03, CREM-04)

**Reviewer:** Claude Code (Haiku 4.5)
**Review Date:** 2026-04-08
**Verdict:** BLOCK — 4 critical issues require plan refinement before execution

---

## Executive Summary

Phase 056 proposes integrating CodeLM's `getCallers()` API into two core solver components:
1. **Plan 01 (CREM-03):** Git heatmap hot-zone ranking weighted by callee count
2. **Plan 02 (CREM-04):** Reverse discovery (C→R, T→R) candidates flagged with dead-code signals

Both plans are **architecturally sound** and **correctly address phase goals**, but the execution plans contain **4 blocking issues** that would cause implementation bugs, test failures, or missed fail-open guarantees. These are not fundamental design flaws — they are specific technical oversights in task decomposition, scope handling, and error recovery that require targeted refinement.

---

## Critical Issues (BLOCK)

### Issue 1: SCOPE LEAK — computePriority() exported function signature mismatch

**Location:** 056-01-PLAN.md, Task 1 — `computePriority()` signature change

**Problem:**
The plan modifies `computePriority(churn, fixes, adjustments, calleeCount)` to add a fourth parameter. However, this function is exported from `git-heatmap.cjs` and may be called from outside the module. The plan specifies that nf-solve.cjs will call it with 4 arguments:

```js
const { computePriority } = require('./git-heatmap.cjs');
hz.priority = computePriority(hz.churn || 0, hz.fixes || 0, hz.adjustments || 0, hz.callee_count);
```

But the plan does NOT:
1. Search for all call sites of `computePriority()` to confirm it's only called from within git-heatmap.cjs or from nf-solve.cjs (the one being added)
2. Verify the export hasn't been consumed elsewhere
3. Document whether this is a backward-compatible change (with default parameter) or breaking

**Impact:** If any hidden call site passes only 3 args and relies on old behavior, the fourth parameter defaulting to 0 silently changes priority calculations. With 4 args, callee_count enrichment happens; with 3 args (pre-integration), it doesn't.

**Fix required:**
Add pre-implementation verification: `grep -rn "computePriority(" bin/ hooks/ core/ test/ | grep -v "function computePriority\|require.*git-heatmap"`

---

### Issue 2: MISSING SCOPE ANALYSIS — _activeAdapter vs _solveAdapter lifetime

**Location:** 056-01-PLAN.md, Task 2 — sweepGitHeatmap() adapter passing

**Problem:**
Task 2 states:
> If computeResidual() is a top-level function and _solveAdapter is only in solve(), use the module-level variable pattern (same pattern as formalTestSyncCache). Examine the actual scope in nf-solve.cjs before deciding.

But the plan **does not verify** whether:
1. `_solveAdapter` actually exists in nf-solve.cjs (this name may be wrong)
2. `computeResidual()` is top-level or nested
3. The module-level variable pattern is feasible without state contamination

This defers critical design decisions to implementation phase, creating risk.

**Impact:** Implementer may choose wrong scope pattern, causing adapter to be undefined even when healthy, breaking fail-open guarantee. Or implementation may require unexpected refactoring.

**Fix required:**
Add to 056-01-PLAN.md verification section:
```bash
grep -n "_solveAdapter\|computeResidual\|function sweepGitHeatmap" bin/nf-solve.cjs | head -30
```
Document actual scope structure before writing code.

---

### Issue 3: INCORRECT CANDIDATE FIELD NAME in sweepCtoR()

**Location:** 056-02-PLAN.md, Task 1 — sweepCtoR() enrichment block

**Problem:**
The plan states the enrichment block should handle `candidate.file_or_claim`:
```js
const filePath = typeof candidate === 'string' ? candidate : (candidate.file_or_claim || candidate.file || '');
```

But examining actual sweepCtoR() code:
```js
untraced.push({ file });  // Always { file }, not { file_or_claim }
```

The `.file_or_claim` field is created LATER in assembleReverseCandidates (line 3060-3070) as an output field:
```js
const candidate = {
  source_scanners: ['C→R'],
  evidence: mod.file,          // reads .file from input
  file_or_claim: mod.file,     // creates .file_or_claim for output
  ...
}
```

**Impact:** Enrichment block reads wrong field. `candidate.file_or_claim` is undefined for untraced_modules. FilePath becomes empty string. getCallersSync receives '', returns no callers. caller_count stays undefined. Dead code flag never set.

**Fix required:**
Change enrichment to use:
```js
const filePath = typeof candidate === 'string' ? candidate : (candidate.file || '');
```

---

### Issue 4: UNSPECIFIED REPORT ANNOTATION INSERTION POINT

**Location:** 056-02-PLAN.md, Task 2 Part B — Solve report annotation

**Problem:**
The plan specifies WHAT to add:
```js
const deadNote = (candidate.dead_code_flag === true) ? ' (0 callers — likely dead code)' : ...
lines.push('  - ' + candidateName + deadNote);
```

But NOT where or how:
1. Plan says "around the lines.push('## C -> R')" but that's in assembleReverseCandidates (line 3059-3076), which doesn't output report lines
2. Doesn't specify which function formats report lines (reportFindings? formatCandidates?)
3. Doesn't define what `candidateName` is (candidate.evidence? candidate.file_or_claim?)
4. Doesn't clarify if formatting happens in a loop or switch statement

Actual report formatting is at line 4873+ in reportFindings(), processing finalResidual.c_to_r.detail.untraced_modules. But plan doesn't specify this.

**Impact:** Implementer searches for "## C -> R" text, finds assembleReverseCandidates, adds code in wrong function. Code never executes. Report shows no dead code annotations.

**Fix required:**
Add to Task 2 Part B:
```bash
grep -n "## C -> R\|## T -> R\|untraced_modules" bin/nf-solve.cjs
```
Identify actual report formatting location. Specify insertion point with line number and 10 lines of surrounding context.

---

## Architectural Soundness Assessment

### Strengths

✓ **CREM-03 goal is correct:** Git heatmap needs callee-count signal for blast-radius ranking
✓ **Math.log1p weighting is sound:** Avoids exploding priority, gives meaningful boost (0→1.0x, 10→2.4x, 100→5.6x)
✓ **Integration point correct:** sweepGitHeatmap enrichment + re-sort is right place
✓ **Fail-open pattern solid:** healthSync check + try-catch per item preserves pre-integration behavior

✓ **CREM-04 goal is correct:** Reverse discovery lacks call-graph evidence; dead code flagging is the right heuristic
✓ **Task structure logical:** Mirrors CREM-03 for reverse discovery sweepers
✓ **Both plans use consistent fail-open:** Report continues with partial data when coderlm unavailable

### Weaknesses (specification gaps, not design)

- Issue 1: Unverified call-site compatibility
- Issue 2: Deferred scope decisions
- Issue 3: Wrong field name in data structure
- Issue 4: Unspecified code location

---

## Technical Soundness

### CREM-03 Weighting Formula

```js
Math.max(churn, 1) * (1 + fixes) * (1 + adjustments) * (1 + Math.log1p(calleeCount))
```

**Strengths:**
- Log weighting prevents high-caller files from dominating sort
- calleeCount=0 → 1.0x multiplier (no penalty, neutral)
- calleeCount=10 → ~2.4x multiplier (meaningful boost)
- calleeCount=100 → ~5.6x multiplier (reasonable cap)
- Orthogonal to existing churn/fixes/adjustments factors (intentional design)

**Verified:** Math.log1p behavior is correct for this use case.

### CREM-04 Dead Code Heuristic

**caller_count === 0 → likely dead code**

**Strengths:**
- Sound heuristic: if no one calls it, probably not needed
- Doesn't auto-exclude: expects quorum review (right approach)
- Handles entry-point exception (bin/nf-solve.cjs may have 0 callers intentionally) via review

**Verified:** Heuristic is appropriate for discovery phase (not enforcement).

---

## Completeness Assessment

### CREM-03 (056-01)

| Requirement | Status | Notes |
|---|---|---|
| computePriority() accepts 4th param | ✓ | Default calleeCount=0 |
| Every hot-zone entry has callee_count field | ✓ | Added in buildUncoveredHotZones |
| sweepGitHeatmap() calls getCallersSync | ✓ | Via adapter |
| Re-sort after enrichment | ✓ | hotZones.sort() specified |
| Fail-open when adapter unavailable | ✓ | healthSync + try-catch |
| Tests pass | ✓ | npm test verification specified |

**Tasks:** 2/2 present, but Issue 1 & 2 block implementation

### CREM-04 (056-02)

| Requirement | Status | Notes |
|---|---|---|
| sweepCtoR() enriches untraced with caller_count | ✓ | But Issue 3 blocks (wrong field name) |
| sweepTtoR() enriches orphans with caller_count | ✓ | Same issue as above |
| dead_code_flag set when caller_count===0 | ✓ | Specified |
| Report annotation for dead code | ✓ | But Issue 4 blocks (location unspecified) |
| Fail-open when adapter unavailable | ✓ | healthSync + try-catch |
| Tests pass | ✓ | npm test verification specified |

**Tasks:** 2/2 present, but Issue 3 & 4 block implementation

---

## Verdict: BLOCK

**Root cause:** 4 specification gaps that would cause implementation bugs:

1. **Issue 1:** No verification that computePriority signature change is safe
2. **Issue 2:** Scope decisions deferred to implementation phase
3. **Issue 3:** Wrong field name in candidate enrichment (file_or_claim vs file)
4. **Issue 4:** Report annotation location unspecified (wrong function identified)

**All 4 are fixable with 15–30 minutes of grep + documentation.**

---

## Path to APPROVE

1. Run these verification commands and document results:
   - `grep -rn "computePriority(" bin/ hooks/ core/ test/`
   - `grep -n "_solveAdapter\|computeResidual\|function sweepGitHeatmap" bin/nf-solve.cjs`
   - `grep -n "## C -> R\|## T -> R\|untraced_modules" bin/nf-solve.cjs`

2. Correct Issue 3: Change enrichment to use `candidate.file` (not `file_or_claim`)

3. Specify Issue 4: Add exact line number and surrounding context for report annotation insertion

4. Update Task 2 in 056-01-PLAN.md with verified scope pattern (Issue 2)

5. Add verification step to Task 1 confirming call-site safety (Issue 1)

6. Resubmit both 056-01-PLAN.md and 056-02-PLAN.md

---

## Approval Criteria Met When

- [ ] Issue 1: computePriority call sites verified (0 external calls outside nf-solve.cjs)
- [ ] Issue 2: _solveAdapter scope confirmed with line numbers
- [ ] Issue 3: Candidate field name corrected to .file
- [ ] Issue 4: Report annotation insertion point specified (line number + context)
- [ ] All verification bash commands produce expected results
- [ ] No design changes required (corrections only)

---

## Implementation Feasibility (post-fixes)

If issues are resolved:
- ✓ Task 1 (add parameter + field) — 5 min
- ✓ Task 2 (enrichment block + re-sort) — 10 min
- ✓ Task 3 (sweepCtoR enrichment) — 10 min
- ✓ Task 4 (sweepTtoR enrichment) — 10 min
- ✓ Task 5 (report annotation) — 10 min
- ✓ Test verification — 10 min

**Total:** ~1 hour (straightforward once scope is clarified)

---

## Summary for Stakeholders

**Do the plans correctly address phase goals?**
✓ Yes. CREM-03 adds callee-count to heatmap ranking (sound). CREM-04 adds dead-code flagging to reverse discovery (sound).

**Are technical approaches sound?**
✓ Yes. Math.log1p weighting is appropriate. Dead code heuristic is appropriate. Fail-open patterns are correct.

**Are plans complete and ready for execution?**
✗ No. 4 specification gaps exist:
  - Unverified call-site compatibility (Issue 1)
  - Deferred scope decisions (Issue 2)
  - Incorrect field name in enrichment (Issue 3)
  - Unspecified report location (Issue 4)

**Can they be fixed quickly?**
✓ Yes. All issues are specification/documentation gaps. No design changes required. Estimated 15–30 min to resolve.

**Recommendation:** Request plan author to run the suggested grep commands, fix field names, and resubmit with specific line numbers. Then APPROVE.


---
phase: quick-142
verified: 2026-03-03T00:00:00Z
status: passed
score: 4/4 must-haves verified
---

# Quick Task 142: Enhance /qgsd:solve to Orchestrate Remediation Skills

**Task Goal:** Enhance /qgsd:solve to orchestrate remediation skills for auto-closing gaps

**Verified:** 2026-03-03
**Status:** PASSED
**Score:** 4/4 must-haves verified

## Goal Achievement

### Observable Truths Verification

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Running /qgsd:solve with no flags performs a diagnostic sweep, dispatches remediation skills for non-zero gaps (R->F, F->T, T->C, F->C), re-diagnoses, and presents a before/after residual comparison | ✓ VERIFIED | solve.md §Step 1 (diagnostic), §Step 3 (dispatch R->F, F->T, T->C, F->C), §Step 4 (re-diagnostic), §Step 6 (before/after table) |
| 2 | Running /qgsd:solve --report-only performs a single diagnostic sweep and displays the residual vector without dispatching any remediation skills | ✓ VERIFIED | solve.md §Step 2: "If --report-only flag was passed: display the baseline residual vector only, STOP — do not proceed to remediation" |
| 3 | The skill dispatches to the correct remediation target for each gap type: close-formal-gaps for R->F, formal-test-sync for F->T, fix-tests for T->C, run-formal-verify.cjs for F->C, and logs C->F for manual review | ✓ VERIFIED | solve.md §3a (close-formal-gaps for R->F), §3b (formal-test-sync.cjs for F->T), §3c (fix-tests for T->C), §3d (C->F manual log), §3e (run-formal-verify.cjs for F->C) |
| 4 | The skill converges by re-diagnosing after each remediation round and stopping when residual is zero or unchanged | ✓ VERIFIED | solve.md §Step 4 (re-diagnostic sweep), §Step 5 (convergence check with conditions for zero, improvement, stasis), iteration loop (max-iterations support) |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `commands/qgsd/solve.md` | Orchestrator skill with convergence loop, before/after comparison, and multi-gap remediation dispatch | ✓ VERIFIED | File exists (207 lines), contains full orchestration logic with step-by-step process, proper YAML frontmatter with expanded allowed-tools |

### Frontmatter Verification

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| name | qgsd:solve | qgsd:solve | ✓ VERIFIED |
| argument-hint | [--report-only] [--max-iterations=N] [--json] [--verbose] | [--report-only] [--max-iterations=N] [--json] [--verbose] | ✓ VERIFIED |
| allowed-tools | Includes Read, Write, Edit, Bash, Glob, Grep, Agent, Skill, AskUserQuestion | Contains all 9 tools | ✓ VERIFIED |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| solve.md | qgsd-solve.cjs | Runs `node bin/qgsd-solve.cjs --json --report-only` for diagnostic | ✓ WIRED | §Step 1 invocation with correct flags |
| solve.md | close-formal-gaps | Dispatches `/qgsd:close-formal-gaps` with --ids or --all | ✓ WIRED | §3a conditional dispatch for R->F gaps |
| solve.md | formal-test-sync | Runs `node bin/formal-test-sync.cjs` for F->T remediation | ✓ WIRED | §3b direct script invocation |
| solve.md | fix-tests | Dispatches `/qgsd:fix-tests` for T->C gaps | ✓ WIRED | §3c conditional dispatch for T->C gaps |
| solve.md | run-formal-verify | Runs `node bin/run-formal-verify.cjs` for F->C verification | ✓ WIRED | §3e conditional dispatch for F->C gaps |

### Content Verification

| Requirement | Evidence | Status |
|-------------|----------|--------|
| Dispatch order respects R->F before F->T | §Step 3 intro: "New formal specs create new invariants needing test backing" | ✓ VERIFIED |
| R->F gap dispatch logic | §3a: extracts uncovered requirement IDs, conditional on count (≤10 → --ids, >10 → --all) | ✓ VERIFIED |
| F->T gap dispatch logic | §3b: runs formal-test-sync.cjs directly, generates test stubs | ✓ VERIFIED |
| T->C gap dispatch logic | §3c: dispatches /qgsd:fix-tests to discover and fix failing tests | ✓ VERIFIED |
| C->F gap handling | §3d: logs for manual review with message about intentional divergence | ✓ VERIFIED |
| F->C gap dispatch logic | §3e: runs run-formal-verify.cjs and captures exit code | ✓ VERIFIED |
| Report-only short-circuit | §Step 2: explicit STOP after displaying baseline, no remediation | ✓ VERIFIED |
| Convergence loop | §Step 5 iteration logic: supports --max-iterations, loops if residual decreased | ✓ VERIFIED |
| Before/after comparison | §Step 6: comprehensive table with Before/After/Delta/Status columns | ✓ VERIFIED |
| Error handling | §Important Constraints #3: "Each remediation dispatch is wrapped in error handling... continue to next gap type" | ✓ VERIFIED |

### Task Verification Checklist

| # | Check | Command | Result | Status |
|---|-------|---------|--------|--------|
| 1 | Frontmatter allowed-tools expanded | head -20 solve.md | Shows all 9 tools (Read, Write, Edit, Bash, Glob, Grep, Agent, Skill, AskUserQuestion) | ✓ PASS |
| 2 | Process contains conditional dispatch for all 5 gap types | grep -c 'close-formal-gaps\|formal-test-sync\|fix-tests\|run-formal-verify' | 11 occurrences (4 gap types + references) | ✓ PASS |
| 3 | --report-only short-circuits after diagnostic | grep 'Report-Only Gate' + §Step 2 content | Explicit logic: display, STOP, no remediation | ✓ PASS |
| 4 | Process describes convergence loop | §Step 4, §Step 5, iteration loop | Re-diagnosis, convergence check, iteration logic present | ✓ PASS |
| 5 | Before/after residual comparison included | §Step 6 | Table with Before/After/Delta/Status columns | ✓ PASS |
| 6 | name and argument-hint preserved | head -5 solve.md | name: qgsd:solve, argument-hint includes all flags | ✓ PASS |
| 7 | close-formal-gaps referenced | grep -c 'close-formal-gaps' | 3 occurrences | ✓ PASS (≥1) |
| 8 | fix-tests referenced | grep -c 'fix-tests' | 3 occurrences | ✓ PASS (≥1) |
| 9 | formal-test-sync referenced | grep -c 'formal-test-sync' | 3 occurrences | ✓ PASS (≥1) |
| 10 | run-formal-verify referenced | grep -c 'run-formal-verify' | 2 occurrences | ✓ PASS (≥1) |
| 11 | report-only gate logic | grep 'report-only' | 6 occurrences (argument-hint + logic) | ✓ PASS (≥2) |

### Anti-Patterns

No blockers found. File is syntactically valid YAML frontmatter + XML structure. No stubs, no empty implementations, no console.log-only code. The file is a complete, detailed orchestration skill definition with clear step-by-step logic.

### Requirements Coverage

| Requirement | Description | Evidence | Status |
|-------------|-------------|----------|--------|
| QUICK-142 | Enhance /qgsd:solve to orchestrate remediation skills for auto-closing gaps | solve.md §Step 3 dispatches 4 remediation targets (R->F, F->T, T->C, F->C) + manual log for C->F; convergence loop re-diagnoses and iterates | ✓ SATISFIED |

## Summary

**All must-haves verified.** The solve.md orchestrator skill:

1. **Performs initial diagnostic sweep** via `node bin/qgsd-solve.cjs --json --report-only` and displays baseline residual
2. **Respects --report-only flag** by short-circuiting after diagnostic without dispatching remediation
3. **Dispatches remediation in dependency order:**
   - R->F: `/qgsd:close-formal-gaps` (conditional on uncovered requirement count)
   - F->T: `node bin/formal-test-sync.cjs` (generates test stubs)
   - T->C: `/qgsd:fix-tests` (discovers and fixes failing tests)
   - C->F: Manual log with intentional divergence note
   - F->C: `node bin/run-formal-verify.cjs` (formal verification)
4. **Re-diagnoses after each remediation round** via second `node bin/qgsd-solve.cjs --json --report-only`
5. **Converges via iteration loop** respecting --max-iterations (default 3), stopping when residual reaches zero or stops decreasing
6. **Presents before/after comparison** with table showing Before/After/Delta/Status for each layer transition
7. **Includes error handling** to wrap remediation dispatches and continue on failure
8. **Preserves constraints:** bin/qgsd-solve.cjs is not modified; orchestration happens at skill level; ordering respects R->F before F->T dependency

**Goal achieved.** The /qgsd:solve command is now a full orchestrator that closes gaps across all layers automatically.

---

_Verified: 2026-03-03T00:00:00Z_
_Verifier: Claude (qgsd-verifier)_

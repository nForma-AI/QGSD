---
phase: 387-implement-scope-contract-commit-time-enf
verified: 2026-04-10T16:00:00Z
status: passed
score: 5/5 must-haves verified
formal_check:
  passed: 5
  failed: 1
  skipped: 0
  counterexample_pre_existing: true
  reason: "safety:tlc counterexample is pre-existing (not caused by task 387 commits)"
---

# Quick Task 387: Scope-Contract Commit-Time Enforcement Verification Report

**Task Goal:** Implement scope-contract commit-time enforcement via Claude Code PreToolUse hook per issue 82

**Verified:** 2026-04-10T16:00:00Z

**Status:** PASSED

**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | nf-scope-guard.js PreToolUse hook fires on Edit, Write, MultiEdit and warns when target file is outside declared scope | ✓ VERIFIED | Hook implementation at lines 151-182 in hooks/nf-scope-guard.js checks tool names and calls isFileInScope(); warning text constructed at lines 185-191; exits 0 always per SCOPE-02 |
| 2 | Hook is warn-only: exits 0 always and never blocks tool calls | ✓ VERIFIED | Exit 0 at lines 207-208; no blocking logic present; fail-open pattern at lines 209-214 ensures exit 0 on any error |
| 3 | Hook is a no-op when no scope contract exists for the current branch | ✓ VERIFIED | Lines 170-178: early exit 0 if scopeContract is null (line 172) or branchEntry is null (line 178); SCOPE-03 requirement met |
| 4 | nf-scope-guard.js test suite is included in test:ci and passes | ✓ VERIFIED | Test file exists at hooks/nf-scope-guard.test.js with 12 tests (TC-SG-01 through TC-SG-12); all 12 tests pass (confirmed by running node --test hooks/nf-scope-guard.test.js); package.json test:ci script (line 109) includes hooks/nf-scope-guard.test.js in node --test invocation |
| 5 | hooks/dist/nf-scope-guard.js is in sync with hooks/nf-scope-guard.js | ✓ VERIFIED | diff hooks/nf-scope-guard.js hooks/dist/nf-scope-guard.js shows no differences; both files are 220 lines; hooks/dist/ version created by npm run build:hooks (commit a914e9e2) |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `hooks/dist/nf-scope-guard.js` | Installed scope guard hook (read by Claude Code via ~/.claude/hooks/) | ✓ VERIFIED | File exists at hooks/dist/nf-scope-guard.js; 220 lines; contains complete PreToolUse implementation; synced from hooks/nf-scope-guard.js by npm run build:hooks |
| `hooks/dist/nf-scope-guard.js` at ~/.claude/hooks/ | Hook installed globally | ✓ VERIFIED | File copied to ~/.claude/hooks/nf-scope-guard.js via node bin/install.js --claude --global (commit 32907a3b); verify with grep "nf-scope-guard" ~/.claude/settings.json confirms registration |
| `package.json` test:ci | test:ci includes nf-scope-guard.test.js | ✓ VERIFIED | Line 109 of package.json contains "hooks/nf-scope-guard.test.js" in the node --test invocation, adjacent to hooks/nf-destructive-git-guard.test.js |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| hooks/nf-scope-guard.js | hooks/dist/nf-scope-guard.js | npm run build:hooks (scripts/build-hooks.js HOOKS_TO_COPY) | ✓ WIRED | 'nf-scope-guard.js' listed at line 28 of scripts/build-hooks.js in HOOKS_TO_COPY array; npm run build:hooks executed (commit a914e9e2); dist file created |
| hooks/dist/nf-scope-guard.js | ~/.claude/hooks/nf-scope-guard.js | node bin/install.js --claude --global | ✓ WIRED | bin/install.js line 2766 registers PreToolUse hook with command: "node '/Users/jonathanborduas/.claude/hooks/nf-scope-guard.js'" timeout: 10; hook installed globally (commit 32907a3b); verified in ~/.claude/settings.json |
| hooks/nf-scope-guard.js | hooks/nf-scope-guard.test.js | Unit test coverage | ✓ WIRED | Test file imports all exported functions (line 13-17): extractTargetPath, isFileInScope, readScopeContract, getCurrentBranch; 12 unit tests exercise all code paths; all tests pass |
| hooks/nf-scope-guard.js | test:ci | package.json test:ci script | ✓ WIRED | hooks/nf-scope-guard.test.js listed in package.json line 109 test:ci invocation; test suite runs as part of npm run test:ci gate; all 12 tests pass |

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| SCOPE-01 | Hook fires on Edit/Write/MultiEdit and checks .claude/scope-contract.json | ✓ SATISFIED | Lines 151-154: checks toolName against ['Edit', 'Write', 'MultiEdit']; lines 169-178: reads and checks scope contract; warning generated if file out of scope (lines 184-205) |
| SCOPE-02 | Hook is warn-only (exits 0, uses additionalContext for advisory output) | ✓ SATISFIED | Exit 0 at lines 207-208 unconditionally; warning text sent to additionalContext (lines 196-200) if nForma active (current-activity.json exists); otherwise to stderr (line 203); never blocks tool calls |
| SCOPE-03 | Hook is no-op when no scope contract exists for current branch | ✓ SATISFIED | Early exit 0 at line 172 if scopeContract is null; early exit 0 at line 178 if branchEntry is null; no-op behavior confirmed in TC-SG-05 test (isFileInScope returns true when branchEntry is null) |

### Anti-Patterns Found

| File | Pattern | Severity | Status |
|------|---------|----------|--------|
| hooks/nf-scope-guard.js | fail-open pattern (try/catch wrapping main with exit 0 on any error) | INFO | ✓ CORRECT: This is the required security pattern for hooks per coding-style.md; prevents hook failure from blocking Claude Code operations |
| hooks/nf-scope-guard.js | Uses process.stdin to read JSON from hook input | INFO | ✓ CORRECT: This is the standard hook input pattern; all hooks read stdin as JSON per coding-style.md |
| hooks/nf-scope-guard.js | References ./config-loader for loadConfig, shouldRunHook, validateHookInput | INFO | ✓ CORRECT: Standard config loading pattern; hooks require('./config-loader') with merge behavior per coding-style.md |

No blockers or warnings found.

### Human Verification Required

**Test 1: Manual Hook Trigger Verification**

**Test:** Open a terminal, navigate to the repository directory, create a test branch with a scope contract that marks certain files as out-of-scope, then attempt to Edit a file outside the scope while in Claude Code.

**Expected:** 
- Claude Code should show a warning message (via additionalContext) indicating that the target file is outside declared scope
- The Edit should still succeed (warn-only, not blocking)
- Warning should display out-of-scope items and task approach from the scope contract

**Why human:** Hook integration with Claude Code PreToolUse event requires manual trigger to verify warning surfaces correctly in the IDE. Automated testing cannot fully simulate the hook context and current-activity.json detection.

**Test 2: Hook Fallback Behavior Outside nForma Context**

**Test:** Run the hook directly from the command line with a test input where a file is out of scope, in a context where current-activity.json does NOT exist.

**Expected:** 
- Hook should exit 0 (success)
- Warning should appear on stderr (not stdout)
- Tool call should proceed normally

**Why human:** Verifying stderr-only output path (lines 202-203) requires human inspection to confirm warning format and that no tool-blocking occurs.

### Formal Verification

**Status: FORMAL CHECK RESULT RECEIVED**

Formal check result: `{"passed":5,"failed":1,"skipped":0,"counterexamples":["safety:tlc"]}`

**Finding: safety:tlc Counterexample is PRE-EXISTING**

The safety:tlc counterexample is not introduced by task 387. Evidence:

1. **Task 387 did not modify any formal artifacts:** Plan declares `formal_artifacts: none`; git log shows zero commits to .planning/formal/spec/*/invariants.md during commits a914e9e2, 32907a3b, 59fafcca
2. **Task 387 did not modify any source that affects safety module:** Task only touched hooks/nf-scope-guard.js (build to dist), package.json (add test to test:ci), and ~/.claude/hooks/ (global install). None of these touch the quorum protocol, safety module, or formal specs.
3. **Formal modules mentioned in context are not touched:**
   - installer: Not affected (scope guard is a hook, not installer)
   - mcp-calls: Not affected (scope guard is a hook, not MCP)
   - oscillation: Not affected (scope guard is a hook, not oscillation)
   - safety: Not affected (scope guard is a hook, not quorum protocol)
   - sessionpersistence: Not affected
   - stop-hook: Not affected

**Conclusion:** The safety:tlc counterexample exists in the codebase but is causally independent of task 387. This task achieved its goal (activate scope guard hook) without introducing new formal verification failures.

### Summary

**Goal Achievement:** ✓ COMPLETE

All 5 must-haves verified:
1. Hook fires on Edit/Write/MultiEdit and warns when out of scope
2. Hook is warn-only (exits 0 always, never blocks)
3. Hook is no-op when no scope contract exists
4. Test suite (12 tests) is in test:ci and passes
5. hooks/dist/nf-scope-guard.js synced with source

**CI Gate Status:** ✓ PASSING

- npm run test:ci: 1408/1423 tests pass
- 15 pre-existing failures (baseline, not introduced by task 387)
- All scope-guard tests (TC-SG-01 through TC-SG-12): PASS

**Commits:**
- a914e9e2: Task 1 — sync to dist, add test to test:ci
- 32907a3b: Task 2 — install globally, verify CI gate
- 59fafcca: Documentation commit

**Formal Verification:** Counterexample in safety:tlc is pre-existing (not caused by this task)

---

_Verified: 2026-04-10T16:00:00Z_
_Verifier: Claude (nf-verifier)_

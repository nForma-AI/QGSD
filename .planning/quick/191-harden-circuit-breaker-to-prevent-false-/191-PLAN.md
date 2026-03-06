---
phase: quick-191
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - hooks/nf-circuit-breaker.js
  - hooks/nf-circuit-breaker.test.js
  - hooks/dist/nf-circuit-breaker.js
  - hooks/dist/nf-circuit-breaker.test.js
autonomous: true
requirements: [BREAKER-FP-01]
formal_artifacts: none

must_haves:
  truths:
    - "Monotonic workflow progression (template -> substitution -> population) does NOT trigger circuit breaker"
    - "True oscillation with content reversions STILL triggers circuit breaker correctly"
    - "Pure zero-net substitution pairs are not treated as evidence of oscillation"
  artifacts:
    - path: "hooks/nf-circuit-breaker.js"
      provides: "hasReversionInHashes with per-pair negative check"
      contains: "hasNegativePair"
    - path: "hooks/nf-circuit-breaker.test.js"
      provides: "CB-TC23 and CB-TC24 test cases"
      contains: "CB-TC23"
    - path: "hooks/dist/nf-circuit-breaker.js"
      provides: "Synced production copy"
    - path: "hooks/dist/nf-circuit-breaker.test.js"
      provides: "Synced test copy"
  key_links:
    - from: "hooks/nf-circuit-breaker.js"
      to: "hasReversionInHashes return condition"
      via: "totalNetChange <= 0 && hasNegativePair"
      pattern: "hasNegativePair"
---

<objective>
Harden the circuit breaker's `hasReversionInHashes` function to prevent false positives when files undergo monotonic workflow progression (e.g., template creation -> linter substitution -> population with real data). Currently, pure substitutions (equal additions/deletions per pair, net=0) are misclassified as oscillation.

Purpose: Eliminate false circuit breaker activations during normal workflow stages where content is replaced but never reverted.
Output: Patched hasReversionInHashes, two new test cases, synced dist copies, installed globally.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@hooks/nf-circuit-breaker.js (lines 100-154: hasReversionInHashes function)
@hooks/nf-circuit-breaker.test.js (CB-TC20/CB-TC21 as pattern reference)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix hasReversionInHashes and add CB-TC23/CB-TC24 tests</name>
  <files>hooks/nf-circuit-breaker.js, hooks/nf-circuit-breaker.test.js</files>
  <action>
In `hooks/nf-circuit-breaker.js`, function `hasReversionInHashes` (lines 116-154):

1. Add a `let hasNegativePair = false;` variable at line 121 (alongside `totalNetChange` and `errorsOnly`).

2. Inside the for-loop, after computing `additions` and `deletions` for each pair (after line 145 `totalNetChange += (additions - deletions);`), add:
   ```
   if (additions - deletions < 0) hasNegativePair = true;
   ```

3. Change the return statement at line 153 from:
   ```
   return totalNetChange <= 0;
   ```
   to:
   ```
   return totalNetChange <= 0 && hasNegativePair;
   ```

4. Update the comment block (lines 100-108) to document the new condition:
   - Zero or negative total net change WITH at least one pair showing net deletions -> true oscillation
   - Zero or negative total net change with NO pair showing net deletions (all pairs are zero-net substitutions) -> NOT oscillation (monotonic workflow progression)

5. Update the function's return-value doc comment (line 114) to reflect the new logic.

In `hooks/nf-circuit-breaker.test.js`, add two new tests after CB-TC22 (before CB-TC19):

**CB-TC23: Workflow progression with substitutions does NOT trigger oscillation**
- Simulates VALIDATION.md through 3 stages: template creation -> linter cleanup (substitution) -> population
- Commit 1: Create `VALIDATION.md` with template placeholders (e.g., `{PHASE_NAME}`, `{PLAN_COUNT}`, `{WAVE_COUNT}`)
- Commit 2: Filler file (creates run-group boundary)
- Commit 3: Replace ALL placeholders with "TBD" (same line count — pure substitution, zero net change per pair)
- Commit 4: Another filler (creates run-group boundary)
- Commit 5: Replace ALL "TBD" entries with real data (same line count — pure substitution, zero net change)
- Assert: exitCode=0, stdout empty, NO state file written (NOT oscillation)
- The key: each pair has additions == deletions (net 0), so hasNegativePair stays false

**CB-TC24: True oscillation with reversions STILL triggers correctly**
- Commit 1: Create `config.js` with `const mode = "debug";`
- Commit 2: Filler
- Commit 3: Change to `const mode = "production";` (1 deletion + 1 addition = net 0, BUT this is a substitution)
- Commit 4: Filler
- Commit 5: Change BACK to `const mode = "debug";` AND remove a line that was in commit 3 (net negative on this pair)
- To ensure hasNegativePair triggers: commit 3 should add 2 lines (mode + an extra config line), commit 5 should revert to just mode="debug" (removing the extra line = 1 addition, 2 deletions = net -1)
- Assert: exitCode=0, state file IS written, state.active=true, file_set includes config.js

Follow the exact test patterns from CB-TC20/CB-TC21: use `createTempGitRepo()`, `commitInRepo()`, `runHook()`, and verify via state file existence.
  </action>
  <verify>Run `node --test hooks/nf-circuit-breaker.test.js` — all tests pass including new CB-TC23 and CB-TC24. Existing CB-TC20 (TDD progression) and CB-TC21 (true oscillation) continue to pass.</verify>
  <done>hasReversionInHashes requires at least one pair with negative net change before classifying as oscillation. CB-TC23 confirms substitution-only workflows pass. CB-TC24 confirms true reversions still trigger. All existing tests pass.</done>
</task>

<task type="auto">
  <name>Task 2: Sync to dist and install globally</name>
  <files>hooks/dist/nf-circuit-breaker.js, hooks/dist/nf-circuit-breaker.test.js</files>
  <action>
1. Copy source files to dist:
   ```
   cp hooks/nf-circuit-breaker.js hooks/dist/nf-circuit-breaker.js
   cp hooks/nf-circuit-breaker.test.js hooks/dist/nf-circuit-breaker.test.js
   ```

2. Run the installer to deploy to global hooks:
   ```
   node bin/install.js --claude --global
   ```

3. Verify the installed copy contains the fix:
   ```
   grep "hasNegativePair" ~/.claude/hooks/nf-circuit-breaker.js
   ```
  </action>
  <verify>`grep "hasNegativePair" ~/.claude/hooks/nf-circuit-breaker.js` returns matches. `node --test hooks/dist/nf-circuit-breaker.test.js` passes all tests.</verify>
  <done>Production hooks at ~/.claude/hooks/ contain the hardened hasReversionInHashes logic. dist/ copies match source.</done>
</task>

</tasks>

<verification>
- `node --test hooks/nf-circuit-breaker.test.js` — all tests pass (including CB-TC20, CB-TC21, CB-TC23, CB-TC24)
- `node --test hooks/dist/nf-circuit-breaker.test.js` — all tests pass
- `grep "hasNegativePair" hooks/nf-circuit-breaker.js` — confirms fix present in source
- `grep "hasNegativePair" ~/.claude/hooks/nf-circuit-breaker.js` — confirms fix deployed globally

Formal invariant compliance:
- breaker/MonitoringReachable: unchanged — fix only refines the oscillation detection heuristic, does not affect state transitions
- oscillation/AlgorithmTerminates: unchanged — fix adds a boolean check to the return value, does not alter the loop or termination logic
</verification>

<success_criteria>
- Zero false positives on monotonic substitution workflows (CB-TC23 proves this)
- True oscillation with content reversions still detected (CB-TC24 proves this)
- All existing test cases continue to pass (regression-free)
- Fix deployed to global hooks via install.js
</success_criteria>

<output>
After completion, create `.planning/quick/191-harden-circuit-breaker-to-prevent-false-/191-SUMMARY.md`
</output>

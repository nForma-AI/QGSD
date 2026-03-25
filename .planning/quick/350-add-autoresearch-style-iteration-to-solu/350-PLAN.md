---
phase: quick-350
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/solution-simulation-loop.cjs
  - bin/solution-simulation-loop.test.cjs
  - commands/nf/model-driven-fix.md
autonomous: true
formal_artifacts: none
requirements:
  - INTENT-01

must_haves:
  truths:
    - "onTweakFix callback is invoked between iterations with gate failure context and TSV history"
    - "When onTweakFix is not provided, loop falls back to current behavior (same mutations reused)"
    - "In-memory rollback restores consequence model snapshot when gate pass count decreases"
    - "TSV file written alongside reproducing model with per-iteration gate results"
    - "When-stuck protocol returns converged=false with stuck_reason after 3+ same-gate failures"
    - "Default maxIterations changed from 3 to 10 (intentional behavior change — more iterations for autoresearch-style exploration)"
    - "Module-only API — no git commits per iteration; model-driven-fix.md Phase 4.5 updated to use require() instead of CLI"
  artifacts:
    - path: "bin/solution-simulation-loop.cjs"
      provides: "Refactored simulation loop with onTweakFix, rollback, TSV, when-stuck"
      exports: ["simulateSolutionLoop"]
      contains: "onTweakFix"
    - path: "bin/solution-simulation-loop.test.cjs"
      provides: "Tests for all new behaviors"
      min_lines: 200
  key_links:
    - from: "bin/solution-simulation-loop.cjs"
      to: "onTweakFix callback"
      via: "input.onTweakFix invoked between iterations"
      pattern: "onTweakFix\\("
    - from: "bin/solution-simulation-loop.cjs"
      to: "simulation-results.tsv"
      via: "TSV append per iteration"
      pattern: "simulation-results\\.tsv"
    - from: "commands/nf/model-driven-fix.md"
      to: "bin/solution-simulation-loop.cjs"
      via: "Phase 4.5 dispatch updated from CLI to require() with onTweakFix callback"
      pattern: "simulateSolutionLoop"
---

<objective>
Add autoresearch-style iteration to solution-simulation-loop.cjs (Phase 4.5 of model-driven-fix).

Currently the loop normalizes fix intent once and reuses the same mutations every iteration with no learning. This refactoring mirrors the pattern established in quick-348 (autoresearch-refine.cjs) to add: onTweakFix callback for evolving fix ideas between iterations, in-memory consequence model rollback on regression, TSV-as-memory logging, and when-stuck protocol.

Purpose: Enable the simulation loop to learn from gate failures and iterate toward convergence rather than repeating the same approach.
Output: Refactored bin/solution-simulation-loop.cjs + comprehensive tests.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@bin/solution-simulation-loop.cjs
@bin/solution-simulation-loop.test.cjs
@bin/autoresearch-refine.cjs
@commands/nf/model-driven-fix.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Refactor solution-simulation-loop.cjs with onTweakFix, rollback, TSV, when-stuck</name>
  <files>bin/solution-simulation-loop.cjs</files>
  <action>
Refactor simulateSolutionLoop(input, deps) to add four capabilities. Mirror the patterns from autoresearch-refine.cjs (quick-348). All changes are backward compatible — if onTweakFix is not provided, the loop falls back to current behavior (reuse same mutations every iteration).

**1. New input parameter: onTweakFix**

Add `onTweakFix` to the input object (NOT deps — it's caller-provided logic, not a dependency):
```
onTweakFix: async (fixIdea, iterationContext) => revisedFixIdea|null
```

Where `iterationContext` contains:
- `iteration`: current iteration number
- `gateResults`: object with gate1/gate2/gate3 pass/fail from previous iteration
- `gatesPassing`: number (0-3) of gates passing
- `tsvHistory`: array of parsed TSV rows from prior iterations
- `consecutiveStuckCount`: number of consecutive iterations where the SAME set of gates failed

If onTweakFix returns a non-null string, use it as the new fixIdea for the next iteration's normalizeFixIntent call. If null, skip that iteration as a no-op (log to TSV with status "no-op").

If onTweakFix is not provided (undefined), reuse the original fixIdea unchanged every iteration (current behavior preserved).

**2. In-memory rollback**

Before each iteration's consequence model generation, compute `gatesPassing` count from the previous iteration (count of gate1/gate2/gate3 that have passed=true). After running gates on the new iteration:
- If new gatesPassing < previous gatesPassing: this is a REGRESSION. Mark status as "discarded". Do NOT update the "best" state. The consequence model from this iteration is discarded (in-memory only — no file rollback needed since consequence models are generated fresh each iteration from the reproducing model + mutations).
- If new gatesPassing >= previous gatesPassing: mark as "kept". Update the best known state.
- Track `bestGatesPassing` and `bestVerdict` across iterations.

IMPORTANT: Unlike autoresearch-refine.cjs which rolls back file content, here the consequence model is generated fresh each iteration from reproducingModel + mutations. So "rollback" means: if the new fixIdea produced fewer passing gates, the NEXT iteration's onTweakFix receives the regression signal so the caller can adjust. No file restoration needed.

**3. TSV-as-memory logging**

Write `simulation-results.tsv` in the same directory as `reproducingModelPath`. Format:
```
iteration\tgate1\tgate2\tgate3\tgates_passing\tstatus\tdescription
```

- Ensure TSV header on first write (if file does not exist).
- Append one row per iteration.
- `description` = truncated fixIdea (first 80 chars) or "no-op" if skipped.
- `status` = one of: converged, kept, discarded, no-op, error, unavailable, stuck.
- TSV write errors are fail-open (try/catch, stderr warning).

Add helper functions: `ensureSimTsvHeader(tsvPath)`, `appendSimTsvRow(tsvPath, row)`, `parseSimTsv(tsvPath)` — same pattern as autoresearch-refine.cjs.

**4. When-stuck protocol**

Track which gates are failing across iterations. After 3+ consecutive iterations where the EXACT SAME set of gates fails (e.g., gate2 keeps failing while gate1 and gate3 pass), trigger stuck detection:
- Return early with `converged: false` and `stuck_reason` describing which gates are stuck and the last 5 TSV rows.
- Add `stuck_reason: string|null` to the return type.

Implementation: maintain a `sameGateFailureStreak` counter. After each non-converged iteration, compute a "failure signature" string (e.g., "gate1:FAIL,gate2:PASS,gate3:FAIL"). If it matches the previous iteration's signature, increment streak. If different, reset to 1. When streak >= 3, return stuck.

**5. Default maxIterations change**

Change the hardcoded fallback from 3 to 10 (line 83-86 in current code). Config.json override and input override still take priority.

**6. Return type additions**

Add to the return object:
- `stuck_reason: string|null` — null unless when-stuck triggered
- `bestGatesPassing: number` — highest gate pass count achieved across all iterations
- `tsvPath: string` — path to the simulation-results.tsv file

Keep all existing return fields (converged, iterations, finalVerdict, escalationReason, sessionId).

**7. Preserve all existing behavior**

- Keep DI pattern (deps.normalizer, deps.generator, deps.gateRunner)
- Keep session ID generation, console output, JSON history write
- Keep all validation, error handling, unavailability detection
- When onTweakFix is NOT provided, the loop must behave identically to current code (except maxIterations default changes to 10)
  </action>
  <verify>
Run: `node -e "const m = require('./bin/solution-simulation-loop.cjs'); console.log(typeof m.simulateSolutionLoop)"` — should print "function".

Verify the file contains onTweakFix handling: `grep 'onTweakFix' bin/solution-simulation-loop.cjs`
Verify TSV helpers exist: `grep 'simulation-results.tsv' bin/solution-simulation-loop.cjs`
Verify when-stuck: `grep 'stuck_reason' bin/solution-simulation-loop.cjs`
Verify default 10: `grep 'maxIterations = 10' bin/solution-simulation-loop.cjs` or similar pattern
  </verify>
  <done>
solution-simulation-loop.cjs exports simulateSolutionLoop with onTweakFix callback support, in-memory rollback tracking, TSV logging to simulation-results.tsv, when-stuck protocol after 3+ same-gate failures, default 10 iterations. Backward compatible when onTweakFix is omitted.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add comprehensive tests for all new behaviors</name>
  <files>bin/solution-simulation-loop.test.cjs</files>
  <action>
Add new tests to the existing test file. Keep all 10 existing tests intact. Add the following new test cases:

**Test 11: onTweakFix callback invoked between iterations**
- Provide an onTweakFix that returns a revised fix idea on iteration 2.
- Mock gate runner to fail iteration 1, pass iteration 2.
- Assert onTweakFix was called with the original fixIdea, iteration context including gateResults and gatesPassing=0.
- Assert the revised fix idea was passed to normalizeFixIntent on iteration 2.

**Test 12: onTweakFix returning null skips iteration**
- Provide an onTweakFix that returns null on iteration 2.
- Assert iteration 2 is logged as "no-op" in the result.
- Assert total iterations still increments past the no-op.

**Test 13: Backward compatibility — no onTweakFix**
- Call without onTweakFix in input (current API).
- Mock gates to converge on iteration 2.
- Assert behavior matches pre-refactor (converged=true, 2 iterations).

**Test 14: In-memory rollback on regression**
- Mock gate runner: iteration 1 passes 2/3 gates, iteration 2 passes 1/3 gates (regression), iteration 3 passes 3/3 (converged).
- Assert iteration 2 is marked "discarded" in the iterations array.
- Assert bestGatesPassing in result is 3 (from iteration 3, not 1 from iteration 2).

**Test 15: TSV file written with correct format**
- Run loop with 2 iterations (fail then converge).
- Read the TSV file from the reproducing model's directory.
- Assert header row matches expected columns.
- Assert 2 data rows exist with correct gate values and status.

**Test 16: When-stuck protocol triggers after 3 same-gate failures**
- Mock gate runner to always fail gate2 only (gate1 and gate3 pass) for all iterations.
- Set maxIterations=5.
- Assert loop returns before iteration 5 with converged=false and stuck_reason containing gate failure info.

**Test 17: When-stuck resets on different failure pattern**
- Mock gate runner: iterations 1-2 fail gate2 only, iteration 3 fails gate1 only, iterations 4-5 fail gate2 only.
- Assert stuck is NOT triggered (streak resets at iteration 3).
- Assert all 5 iterations run.

**Test 18: Default maxIterations is 10 when no config**
- Do NOT provide maxIterations in input.
- Ensure no config.json exists in CWD.
- Mock gates to never converge.
- Assert result has 10 iterations.

**Test 19: Return type includes new fields**
- Run a simple converging test.
- Assert result has `stuck_reason` (null), `bestGatesPassing` (3), and `tsvPath` (string ending in simulation-results.tsv).

For mock gate runners that need per-iteration control, use a callCount variable (same pattern as existing Test 2 and Test 9). For TSV verification, read the file from `path.join(path.dirname(reproducingModelPath), 'simulation-results.tsv')`.

Clean up TSV files in finally blocks alongside existing tmpDir cleanup.
  </action>
  <verify>
Run: `node --test bin/solution-simulation-loop.test.cjs` — all tests pass (19 total, 0 failures).
  </verify>
  <done>
19 tests pass covering: onTweakFix invocation, null callback skip, backward compat, regression rollback tracking, TSV output format, when-stuck trigger and reset, default 10 iterations, and new return fields.
  </done>
</task>

<task type="auto">
  <name>Task 3: Update model-driven-fix.md Phase 4.5 wiring from CLI to require()</name>
  <files>commands/nf/model-driven-fix.md</files>
  <action>
Update `commands/nf/model-driven-fix.md` Phase 4.5 (step `solution_simulation`) to use `require()` instead of CLI invocation.

Replace the current CLI dispatch:
```bash
node bin/solution-simulation-loop.cjs \
  --fix-idea="$FIX_IDEA" \
  --bug-description="$BUG_DESC" \
  --reproducing-model="$REPRODUCING_MODEL" \
  --bug-trace="$BUG_TRACE_PATH" \
  --formalism="$FORMALISM" \
  ${VERBOSE:+--verbose}
```

With the module-based dispatch pattern (matching Phase 3's autoresearch-refine pattern):
```javascript
const { simulateSolutionLoop } = require('./bin/solution-simulation-loop.cjs');

const result = await simulateSolutionLoop({
  fixIdea: FIX_IDEA,
  bugDescription: BUG_DESC,
  reproducingModelPath: REPRODUCING_MODEL,
  neighborModelPaths: NEIGHBOR_PATHS,
  bugTracePath: BUG_TRACE_PATH,
  maxIterations: 10,
  formalism: FORMALISM,
  onTweakFix: async (currentFixIdea, ctx) => {
    // Agent reads ctx.failedGates + ctx.tsvHistory
    // Agent refines the fix idea based on which gates failed
    // Returns revised fix idea string or null to skip
  }
});
```

Update the result parsing to handle the extended return type (stuck_reason, bestGatesPassing, tsvPath).

Also note the intentional maxIterations change from 3 to 10 in the documentation.
  </action>
  <verify>
- `grep 'simulateSolutionLoop' commands/nf/model-driven-fix.md` — require() pattern present
- `grep 'onTweakFix' commands/nf/model-driven-fix.md` — callback wiring present
- `grep -c 'node bin/solution-simulation-loop.cjs' commands/nf/model-driven-fix.md` — returns 0 (CLI removed)
  </verify>
  <done>
model-driven-fix.md Phase 4.5 uses require() with onTweakFix callback instead of CLI. maxIterations documented as 10. Result parsing handles extended return type.
  </done>
</task>

</tasks>

<verification>
1. `node --test bin/solution-simulation-loop.test.cjs` — 19 tests pass, 0 fail
2. `node -e "const m = require('./bin/solution-simulation-loop.cjs'); console.log(Object.keys(m))"` — exports simulateSolutionLoop
3. `grep -c 'onTweakFix' bin/solution-simulation-loop.cjs` — multiple matches (parameter, invocation, null check)
4. `grep 'simulation-results.tsv' bin/solution-simulation-loop.cjs` — TSV path reference exists
5. `grep 'stuck_reason' bin/solution-simulation-loop.cjs` — when-stuck return field exists
6. `grep 'simulateSolutionLoop' commands/nf/model-driven-fix.md` — require() wiring present
7. `grep 'onTweakFix' commands/nf/model-driven-fix.md` — callback wiring present
</verification>

<success_criteria>
- All 19 tests pass (10 existing + 9 new)
- onTweakFix callback receives iteration context with gate results and TSV history
- Null onTweakFix return skips iteration as no-op
- Omitting onTweakFix entirely preserves backward-compatible behavior
- TSV file written to reproducing model directory with per-iteration gate results
- When-stuck returns early after 3+ consecutive same-gate-failure iterations
- Default maxIterations is 10 (intentional change from 3 — documented)
- Return type includes stuck_reason, bestGatesPassing, tsvPath
- model-driven-fix.md Phase 4.5 uses require() with onTweakFix (not CLI)
- No git commits per iteration, no circuit breaker triggers
</success_criteria>

<output>
After completion, create `.planning/quick/350-add-autoresearch-style-iteration-to-solu/350-SUMMARY.md`
</output>

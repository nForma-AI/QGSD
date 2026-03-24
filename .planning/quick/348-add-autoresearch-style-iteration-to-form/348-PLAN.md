---
phase: quick-348
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/autoresearch-refine.cjs
  - bin/autoresearch-refine.test.cjs
  - commands/nf/model-driven-fix.md
  - commands/nf/solve-remediate.md
autonomous: true
formal_artifacts: none
requirements:
  - INTENT-01

must_haves:
  truths:
    - "autoresearch-refine.cjs is a module-only API (require(), not CLI) with onTweak callback for model edits"
    - "Each iteration uses in-memory backup for rollback; no per-iteration git commits (single final commit by caller)"
    - "TSV log tracks iteration/checker_result/states/status/description (TSV-as-memory replaces git-as-memory)"
    - "After 3+ consecutive discards, a when-stuck protocol triggers with TSV history context"
    - "model-driven-fix Phase 3 require()s autoresearch-refine and passes onTweak callback"
    - "solve-remediate b_to_f layer documents autoresearch protocol used by model-driven-fix"
  artifacts:
    - path: "bin/autoresearch-refine.cjs"
      provides: "Autoresearch-style refinement loop with in-memory rollback and TSV-as-memory logging"
      exports: ["refine", "_setDeps"]
      min_lines: 150
    - path: "bin/autoresearch-refine.test.cjs"
      provides: "Comprehensive tests for autoresearch-refine"
      min_lines: 100
  key_links:
    - from: "bin/autoresearch-refine.cjs"
      to: "bin/run-tlc.cjs"
      via: "execFileSync checker dispatch"
      pattern: "run-tlc\\.cjs"
    - from: "bin/autoresearch-refine.cjs"
      to: "bin/run-alloy.cjs"
      via: "execFileSync checker dispatch"
      pattern: "run-alloy\\.cjs"
    - from: "bin/autoresearch-refine.cjs"
      to: "bin/config-update.cjs"
      via: "getMaxIterations for default iteration cap"
      pattern: "getMaxIterations"
    - from: "commands/nf/model-driven-fix.md"
      to: "bin/autoresearch-refine.cjs"
      via: "Phase 3 dispatch"
      pattern: "autoresearch-refine"
    - from: "commands/nf/solve-remediate.md"
      to: "bin/autoresearch-refine.cjs"
      via: "b_to_f blind spot dispatch"
      pattern: "autoresearch-refine"
  consumers:
    - artifact: "bin/autoresearch-refine.cjs"
      consumed_by: "commands/nf/model-driven-fix.md"
      integration: "Phase 3 Refinement dispatches autoresearch-refine.cjs instead of close-formal-gaps --batch"
      verify_pattern: "autoresearch-refine"
    - artifact: "bin/autoresearch-refine.cjs"
      consumed_by: "commands/nf/solve-remediate.md"
      integration: "b_to_f covered_not_reproduced dispatches autoresearch-refine.cjs"
      verify_pattern: "autoresearch-refine"
---

<objective>
Add an autoresearch-style micro-loop for formal model refinement that enforces one-tweak-per-iteration discipline with mechanical verification, in-memory rollback, and TSV-as-memory logging.

Purpose: The current refinement-loop.cjs runs the checker but relies on external orchestration for model tweaks. This new script is a **loop controller** (not an editor): it manages the iteration lifecycle (backup/tweak/verify/decide/restore-or-keep/log) while the **calling Agent subprocess** (model-driven-fix Phase 3) performs the actual model edits between iterations via an onTweak callback. This separation mirrors autoresearch's architecture where the loop harness controls the experiment cycle and the agent provides the creative edits.

**Key architectural clarification:** autoresearch-refine.cjs is a **module-only API** (not a CLI). The calling Agent subprocess `require()`s the module and passes an `onTweak` callback inline. This avoids the CLI-vs-callback gap entirely:
- close-formal-gaps creates the initial model skeleton (Phase 1 — unchanged)
- The Agent subprocess calls `require('./bin/autoresearch-refine.cjs').refine({ onTweak: async (path, ctx) => { /* edit model */ return description; }, ... })`
- autoresearch-refine.cjs manages the iteration lifecycle: call onTweak, run checker, decide keep/discard, log TSV

**Circuit breaker safety — batch commit strategy:** The script does NOT commit/revert each iteration. Instead it works on the model file in-place during the loop, only tracking state internally. Only the **final converged model** (or best-effort after max iterations) is committed once by the caller. This completely avoids triggering the circuit breaker's oscillation detector since there's at most one commit for the entire refinement session. TSV-as-memory replaces git-as-memory: iteration history is tracked in the TSV log, not git commits.

Output: bin/autoresearch-refine.cjs (new script), bin/autoresearch-refine.test.cjs (tests), updated model-driven-fix.md and solve-remediate.md wiring.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@bin/refinement-loop.cjs
@bin/solution-simulation-loop.cjs
@bin/config-update.cjs
@commands/nf/model-driven-fix.md
@commands/nf/solve-remediate.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create bin/autoresearch-refine.cjs with tests</name>
  <files>bin/autoresearch-refine.cjs, bin/autoresearch-refine.test.cjs</files>
  <action>
Create `bin/autoresearch-refine.cjs` implementing the autoresearch refinement protocol.

**Module-only API (no CLI):**

This is a library, not a CLI tool. It is `require()`d by the calling Agent subprocess.

**Module exports:** `{ refine, _setDeps }`

**Signature:**
```javascript
async function refine({ modelPath, bugContext, formalism, maxIterations, verbose, onTweak })
// onTweak: async (modelPath, { checkerOutput, tsvHistory, consecutiveDiscards }) => string|null
```

**Return type from refine():**
```
{ converged: boolean, iterations: number, finalModel: string, resultsLog: string, stuck_reason: string|null }
```

**Core algorithm (one iteration):**

The `refine()` function accepts an `onTweak` callback: `async (modelPath, iterationContext) => description|null`. The caller (Agent subprocess in model-driven-fix) provides this callback to perform the actual model edit. The callback receives the current model path and iteration context (previous checker output, TSV history, consecutive_discards) and returns a one-sentence description of what was changed. If the callback returns null/empty, the iteration is logged as "no-op" and skipped.

**No per-iteration commits.** The script works on the model file in-place. Only the final result is committed by the caller after refine() returns. This avoids circuit breaker oscillation entirely.

1. Save a backup of the current model file content (in-memory snapshot for rollback)
2. Call `onTweak(modelPath, iterationContext)` — caller edits the model file on disk, returns description
3. Run checker via execFileSync: `node bin/run-tlc.cjs <model>` or `node bin/run-alloy.cjs <model>`
   - Parse exit code: 0 = pass (model still incomplete for bug repro), non-zero = violation found
   - Extract state count from output (regex: `/(\d+)\s+distinct\s+states/i` or `/(\d+)\s+states?\s+found/i`)
4. Append TSV row to `refinement-results.tsv` (in same directory as model):
   - Columns: `iteration\tcommit\tchecker_result\tstates\tstatus\tdescription`
   - checker_result: "pass" or "violation"
   - status: "kept" (improved or converged), "discarded" (regressed), "converged"
5. Decision logic:
   - If violation found (inverted semantics: bug reproduced = success): mark converged, return
   - If state count increased vs previous iteration: KEEP (progress toward capturing bug)
   - If state count decreased or unchanged AND no violation: DISCARD — restore model from in-memory backup snapshot
   - Track consecutive_discards counter
6. "When stuck" protocol: if consecutive_discards >= 3:
   - Log to stderr: `"[autoresearch-refine] STUCK: 3+ consecutive discards. TSV history shows pattern..."`
   - Return with converged=false and a structured stuck_reason field including last 5 TSV entries

**TSV-as-memory:** Each iteration's context includes the full TSV history so the onTweak callback can learn from what was tried. The TSV log replaces git-as-memory since we don't commit per iteration.

**Dependency injection pattern** (matching refinement-loop.cjs):
```javascript
let deps = { execFileSync, existsSync: fs.existsSync, readFileSync: fs.readFileSync, writeFileSync: fs.writeFileSync, appendFileSync: fs.appendFileSync };
function _setDeps(overrides) { deps = { ...deps, ...overrides }; }
```

For testing, _setDeps allows mocking execFileSync (git commands + checker), readFileSync, writeFileSync, appendFileSync.

**TSV file:** Created with header on first iteration if not exists. Path: `<model_dir>/refinement-results.tsv`

**Error handling:** Fail-open on git errors (log warning, continue without commit/revert). Fail-open on TSV write errors. Checker timeout: 120s (configurable).

Create `bin/autoresearch-refine.test.cjs` using node:test + node:assert (matching project pattern):

Test cases:
1. **Converges on first iteration** — mock checker returns non-zero (violation found), verify converged=true, iterations=1, TSV has 1 row with status "converged"
2. **Keeps iteration when state count increases** — mock checker returns 0 with increasing state counts across iterations, verify "kept" status in TSV
3. **Discards iteration on regression** — mock checker returns 0 with decreasing state count, verify model file restored from backup, "discarded" in TSV
4. **When-stuck protocol triggers after 3 consecutive discards** — mock 3+ iterations all discarded, verify converged=false, stuck_reason populated with last 5 TSV entries
5. **TSV header written once** — run 2 iterations, verify header appears only once
6. **TSV-as-memory passed to onTweak** — verify iterationContext includes tsvHistory array
7. **Respects max-iterations cap** — set max=2, verify stops after 2 iterations
8. **Fail-open on checker errors** — mock execFileSync to throw on checker, verify loop continues gracefully
9. **onTweak returning null skips iteration** — verify "no-op" status in TSV, no file restore
  </action>
  <verify>
Run: `node --test bin/autoresearch-refine.test.cjs` — all tests pass.
Verify exports: `node -p "const m = require('./bin/autoresearch-refine.cjs'); [typeof m.refine, typeof m._setDeps]"` outputs `[ 'function', 'function' ]`
  </verify>
  <done>
bin/autoresearch-refine.cjs exports { refine, _setDeps }. Module-only API with onTweak callback. Implements one-tweak-per-iteration with in-memory backup/rollback (no per-iteration commits), TSV logging, state-space tracking, and when-stuck protocol after 3+ consecutive discards. All tests pass.
  </done>
</task>

<task type="auto">
  <name>Task 2: Wire autoresearch-refine into model-driven-fix and solve-remediate</name>
  <files>commands/nf/model-driven-fix.md, commands/nf/solve-remediate.md</files>
  <action>
**model-driven-fix.md Phase 3 update:**

In the `<step name="refinement">` section, replace the current dispatch to `close-formal-gaps --batch` with dispatch to `autoresearch-refine.cjs`. Specifically:

Add documentation in Phase 3 explaining that the Agent subprocess should `require('./bin/autoresearch-refine.cjs')` and call `refine()` with an `onTweak` callback that edits the model file. The existing close-formal-gaps dispatch is kept as INITIAL MODEL CREATION — it creates the skeleton model. Then the Agent enters the autoresearch-refine loop to iteratively improve it:

```
Phase 3 flow:
1. If no existing model: /nf:close-formal-gaps --bug-context --batch → creates initial model
2. Agent subprocess calls require('./bin/autoresearch-refine.cjs').refine({
     modelPath: '<path to model>',
     bugContext: '<bug description>',
     formalism: 'tla|alloy',
     maxIterations: 10,
     verbose: VERBOSE,
     onTweak: async (path, ctx) => {
       // Agent reads ctx.checkerOutput + ctx.tsvHistory
       // Agent makes ONE targeted edit to the model file
       // Returns description string or null to skip
     }
   })
3. Parse result: converged=true → "reproduced", converged=false → "not_reproduced"
4. Final model committed ONCE by the Agent after refine() returns
```

Keep the existing close-formal-gaps dispatch as initial model creation. The autoresearch-refine loop runs AFTER initial creation to iteratively improve the model.

Add a note about the TSV results log: "Iteration log available at: {resultsLog path}" in verbose mode.

**solve-remediate.md 3a-extra (b_to_f) update:**

In the "Phase 2 -- Route covered_not_reproduced blind spots" section, after the existing dispatch to `/nf:model-driven-fix`, add an alternative path:

When model-driven-fix Phase 3 is invoked for blind spots, it now uses autoresearch-refine internally. Add a note in the section explaining this:
```
Note: model-driven-fix Phase 3 now uses autoresearch-refine.cjs for iterative
refinement (up to 10 iterations with in-memory rollback and TSV-as-memory logging).
The TSV results log is written alongside the model file. Single final commit by caller.
```

Also update the log message to reference the autoresearch protocol:
```
"B->F: dispatching model-driven-fix (autoresearch-refine, in-memory rollback) for blind spot {bug_id}"
```

Do NOT change the dispatch mechanism itself (still dispatches /nf:model-driven-fix) -- the autoresearch protocol is internal to model-driven-fix Phase 3.
  </action>
  <verify>
Verify wiring with grep:
- `grep -n 'autoresearch-refine' commands/nf/model-driven-fix.md` — returns matches in Phase 3 section
- `grep -n 'autoresearch-refine' commands/nf/solve-remediate.md` — returns matches in b_to_f section
- Verify close-formal-gaps is still referenced as initial model creation fallback: `grep -n 'close-formal-gaps' commands/nf/model-driven-fix.md` — still present
- Verify model-driven-fix Phase 3 section is syntactically valid markdown (no broken code blocks)
  </verify>
  <done>
model-driven-fix.md Phase 3 require()s autoresearch-refine.cjs with onTweak callback for iterative refinement (with close-formal-gaps as initial model creation fallback). solve-remediate.md b_to_f section documents the autoresearch protocol. Both files reference bin/autoresearch-refine.cjs.
  </done>
</task>

</tasks>

<verification>
1. `node --test bin/autoresearch-refine.test.cjs` — all tests pass
2. `node -p "typeof require('./bin/autoresearch-refine.cjs').refine"` — outputs 'function'
3. `grep 'autoresearch-refine' commands/nf/model-driven-fix.md` — wired in Phase 3
4. `grep 'autoresearch-refine' commands/nf/solve-remediate.md` — referenced in b_to_f
5. `grep 'close-formal-gaps' commands/nf/model-driven-fix.md` — still present as fallback
</verification>

<success_criteria>
- bin/autoresearch-refine.cjs exists, exports { refine, _setDeps }, module-only API with onTweak callback
- All tests pass (9+ test cases covering converge, keep, discard, stuck, TSV, tsv-as-memory, cap, fail-open, no-op)
- TSV logging writes iteration/checker_result/states/status/description (TSV-as-memory)
- In-memory backup/rollback: no per-iteration git commits, single final commit by caller
- When-stuck triggers after 3+ consecutive discards with TSV history context
- model-driven-fix Phase 3 require()s autoresearch-refine with onTweak callback
- solve-remediate b_to_f section documents autoresearch protocol
</success_criteria>

<output>
After completion, create `.planning/quick/348-add-autoresearch-style-iteration-to-form/348-SUMMARY.md`
</output>

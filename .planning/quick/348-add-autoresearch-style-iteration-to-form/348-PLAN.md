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
    - "autoresearch-refine.cjs makes one atomic model tweak per iteration and verifies mechanically"
    - "Each iteration commits before verification; regression auto-reverts via git revert"
    - "TSV log tracks iteration/commit/checker_result/states/status/description"
    - "After 3+ consecutive discards, a when-stuck protocol triggers"
    - "model-driven-fix Phase 3 dispatches autoresearch-refine instead of close-formal-gaps --batch"
    - "solve-remediate b_to_f layer uses autoresearch-refine for covered_not_reproduced blind spots"
  artifacts:
    - path: "bin/autoresearch-refine.cjs"
      provides: "Autoresearch-style refinement loop with git-as-memory and TSV logging"
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
Add an autoresearch-style micro-loop for formal model refinement that enforces one-tweak-per-iteration discipline with mechanical verification, git-as-memory for rollback, and TSV logging.

Purpose: The current refinement-loop.cjs runs the checker but relies on external orchestration for model tweaks. This new script wraps the refinement cycle with autoresearch protocol: atomic commits before verify, auto-revert on regression, state-space tracking as progress signal, and a "when stuck" escalation after 3+ consecutive discards. This makes formal model refinement self-correcting and observable.

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

**CLI interface:**
- `--model <path>` (required) — path to formal model (.als/.tla/.pm)
- `--bug-context <text>` (required) — bug description text or file path
- `--formalism tla|alloy` (required) — which checker to use
- `--max-iterations N` (optional, default from config.json via getMaxIterations(), cap at 10)
- `--verbose` (optional) — show full checker output

**Module exports:** `{ refine, _setDeps }`

**Return type from refine():**
```
{ converged: boolean, iterations: number, finalModel: string, resultsLog: string }
```

**Core algorithm (one iteration):**
1. Read current model file content
2. Git commit the model file: `git add <model> && git commit -m "autoresearch-refine: iteration N — <short description>"`
   - Record the commit SHA
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
   - If state count decreased or unchanged AND no violation: DISCARD via `git revert HEAD --no-edit`
   - Track consecutive_discards counter
6. "When stuck" protocol: if consecutive_discards >= 3:
   - Log to stderr: `"[autoresearch-refine] STUCK: 3+ consecutive discards. Reading git log for pattern..."`
   - Read last 5 git log entries for the model file: `git log -5 --oneline -- <model>`
   - Return with converged=false and a structured stuck_reason field

**Git-as-memory:** Each iteration reads `git log -3 --oneline -- <model>` to include recent history in verbose output, providing context for the next tweak.

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
3. **Discards iteration on regression** — mock checker returns 0 with decreasing state count, verify git revert called, "discarded" in TSV
4. **When-stuck protocol triggers after 3 consecutive discards** — mock 3+ iterations all discarded, verify converged=false, stuck_reason populated
5. **TSV header written once** — run 2 iterations, verify header appears only once
6. **Git-as-memory reads log** — verify git log called with model path each iteration
7. **Respects max-iterations cap** — set max=2, verify stops after 2 iterations
8. **Fail-open on git errors** — mock execFileSync to throw on git commands, verify loop continues
9. **CLI arg parsing** — verify --model, --bug-context, --formalism, --max-iterations, --verbose parsed correctly
  </action>
  <verify>
Run: `node --test bin/autoresearch-refine.test.cjs` — all tests pass.
Run: `node bin/autoresearch-refine.cjs --help` — shows usage.
Verify exports: `node -p "const m = require('./bin/autoresearch-refine.cjs'); [typeof m.refine, typeof m._setDeps]"` outputs `[ 'function', 'function' ]`
  </verify>
  <done>
bin/autoresearch-refine.cjs exports { refine, _setDeps }. Implements one-tweak-per-iteration with git commit before verify, auto-revert on regression, TSV logging, state-space tracking, and when-stuck protocol after 3+ consecutive discards. All tests pass.
  </done>
</task>

<task type="auto">
  <name>Task 2: Wire autoresearch-refine into model-driven-fix and solve-remediate</name>
  <files>commands/nf/model-driven-fix.md, commands/nf/solve-remediate.md</files>
  <action>
**model-driven-fix.md Phase 3 update:**

In the `<step name="refinement">` section, replace the current dispatch to `close-formal-gaps --batch` with dispatch to `autoresearch-refine.cjs`. Specifically:

Replace the block that invokes:
```
/nf:close-formal-gaps --bug-context="$BUG_DESC" ... --batch
```

With:
```bash
node bin/autoresearch-refine.cjs \
  --model "$REPRODUCING_MODEL_OR_NEW" \
  --bug-context "$BUG_DESC" \
  --formalism "$FORMALISM" \
  --max-iterations 10 \
  ${VERBOSE:+--verbose}
```

Keep the existing close-formal-gaps dispatch as a FALLBACK: if no existing model was found in Phase 1 (EXISTING_MODELS is empty), first run `/nf:close-formal-gaps --bug-context="$BUG_DESC" --batch` to CREATE the initial model, THEN run autoresearch-refine on the created model to iteratively refine it. If an existing model was found but did not reproduce (Phase 2), go straight to autoresearch-refine on that model.

Update the "Parse the result" section to handle the autoresearch-refine return format: `{ converged, iterations, finalModel, resultsLog }` instead of the old refinement-loop format. Map: converged=true -> "reproduced", converged=false -> "not_reproduced". Use finalModel as the REPRODUCING_MODEL path.

Add a note about the TSV results log: "Iteration log available at: {resultsLog path}" in verbose mode.

**solve-remediate.md 3a-extra (b_to_f) update:**

In the "Phase 2 -- Route covered_not_reproduced blind spots" section, after the existing dispatch to `/nf:model-driven-fix`, add an alternative path:

When model-driven-fix Phase 3 is invoked for blind spots, it now uses autoresearch-refine internally. Add a note in the section explaining this:
```
Note: model-driven-fix Phase 3 now uses autoresearch-refine.cjs for iterative
refinement (up to 10 iterations with git-as-memory and automatic rollback).
The TSV results log is written alongside the model file.
```

Also update the log message to reference the autoresearch protocol:
```
"B->F: dispatching model-driven-fix (autoresearch-refine) for blind spot {bug_id}"
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
model-driven-fix.md Phase 3 dispatches autoresearch-refine.cjs for iterative refinement (with close-formal-gaps as initial model creation fallback). solve-remediate.md b_to_f section documents the autoresearch protocol. Both files reference bin/autoresearch-refine.cjs.
  </done>
</task>

</tasks>

<verification>
1. `node --test bin/autoresearch-refine.test.cjs` — all tests pass
2. `node bin/autoresearch-refine.cjs --help` — shows usage with all flags
3. `grep 'autoresearch-refine' commands/nf/model-driven-fix.md` — wired in Phase 3
4. `grep 'autoresearch-refine' commands/nf/solve-remediate.md` — referenced in b_to_f
5. `grep 'close-formal-gaps' commands/nf/model-driven-fix.md` — still present as fallback
</verification>

<success_criteria>
- bin/autoresearch-refine.cjs exists, exports { refine, _setDeps }, implements one-tweak-per-iteration protocol
- All tests pass (9+ test cases covering converge, keep, discard, stuck, TSV, git-memory, cap, fail-open, CLI)
- TSV logging writes iteration/commit/checker_result/states/status/description
- Git-as-memory: commits before verify, reverts on regression
- When-stuck triggers after 3+ consecutive discards
- model-driven-fix Phase 3 dispatches autoresearch-refine with --max-iterations 10
- solve-remediate b_to_f section documents autoresearch protocol
</success_criteria>

<output>
After completion, create `.planning/quick/348-add-autoresearch-style-iteration-to-form/348-SUMMARY.md`
</output>

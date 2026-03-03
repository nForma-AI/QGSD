---
phase: quick-140
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/qgsd-solve.cjs
  - bin/qgsd-solve.test.cjs
  - commands/qgsd/solve.md
autonomous: true
formal_artifacts: none
requirements: [QUICK-140]

must_haves:
  truths:
    - "Running `node bin/qgsd-solve.cjs --report-only` performs a single sweep across all 5 layer transitions (R->F, F->T, C->F, T->C, F->C) and prints a residual vector summary without modifying any files"
    - "Running `node bin/qgsd-solve.cjs` iterates up to 3 times (default), auto-closing gaps each iteration (generating test stubs, regenerating formal specs, fixing constants) until residual converges or max iterations reached"
    - "Running `node bin/qgsd-solve.cjs --max-iterations=1` limits the auto-close loop to exactly 1 iteration"
    - "Running `node bin/qgsd-solve.cjs --json` outputs a machine-readable JSON object with iteration_count, converged boolean, residual_vector, and per-layer detail sections"
    - "Running `node bin/qgsd-solve.cjs --verbose` includes per-step stderr diagnostics from child tools"
    - "The residual vector contains numeric scores for each layer transition: r_to_f (uncovered requirements), f_to_t (formal properties without test backing), c_to_f (constants mismatches), t_to_c (test failures), f_to_c (formal verification failures)"
    - "Convergence is detected when the residual vector is identical between consecutive iterations (no gaps remain to close, or auto-close cannot reduce residuals further)"
    - "The output report uses health indicators: green (0 residual), yellow (1-3 residual), red (4+ residual) per layer transition"
    - "Running `node --test bin/qgsd-solve.test.cjs` passes all tests"
    - "Invoking `/qgsd:solve` as a skill command works and displays results"
  artifacts:
    - path: "bin/qgsd-solve.cjs"
      provides: "Consistency solver orchestrator that sweeps Requirements->Formal->Tests->Code"
      exports: ["sweep", "computeResidual", "autoClose", "formatReport"]
      min_lines: 250
    - path: "bin/qgsd-solve.test.cjs"
      provides: "Test suite for qgsd-solve.cjs"
      contains: "computeResidual"
      min_lines: 100
    - path: "commands/qgsd/solve.md"
      provides: "Skill definition for /qgsd:solve command"
      contains: "qgsd-solve.cjs"
  key_links:
    - from: "bin/qgsd-solve.cjs"
      to: "bin/generate-traceability-matrix.cjs"
      via: "Spawns to compute R->F residual (uncovered requirements count)"
      pattern: "generate-traceability-matrix\\.cjs.*--json"
    - from: "bin/qgsd-solve.cjs"
      to: "bin/formal-test-sync.cjs"
      via: "Spawns for F->T residual (gap count) and C->F residual (constants mismatches)"
      pattern: "formal-test-sync\\.cjs.*--json"
    - from: "bin/qgsd-solve.cjs"
      to: "bin/run-formal-verify.cjs"
      via: "Spawns for F->C residual (formal verification failures), fail-open if not available"
      pattern: "run-formal-verify\\.cjs"
    - from: "commands/qgsd/solve.md"
      to: "bin/qgsd-solve.cjs"
      via: "Skill definition runs the solver script"
      pattern: "qgsd-solve\\.cjs"
---

<objective>
Implement `/qgsd:solve` -- the consistency solver that sweeps Requirements->Formal->Tests->Code, computes a residual vector per layer transition, and auto-closes gaps (generate test stubs, regenerate formal specs, fix constants). Iterates until residual converges (max 3 iterations). Output: summary residual vector + per-layer detail sections with health indicators.

Purpose: Provide a single command that finds and fixes all consistency gaps across the 4 verification layers, replacing the need to run individual tools manually and cross-reference their outputs.
Output: bin/qgsd-solve.cjs (orchestrator), bin/qgsd-solve.test.cjs (tests), commands/qgsd/solve.md (skill definition).
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@bin/generate-traceability-matrix.cjs
@bin/formal-test-sync.cjs
@bin/run-formal-verify.cjs
@commands/qgsd/formal-test-sync.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Build bin/qgsd-solve.cjs consistency solver orchestrator</name>
  <files>
    bin/qgsd-solve.cjs
  </files>
  <action>
Create `bin/qgsd-solve.cjs` (~350-450 lines). Shebang: `#!/usr/bin/env node`, `'use strict'`. Follow the same structural pattern as `bin/generate-traceability-matrix.cjs` and `bin/formal-test-sync.cjs` (TAG constant, CLI flags, data loading functions, processing, output).

**CLI flags:**
- `--report-only` — single sweep, no auto-close mutations, read-only
- `--max-iterations=N` — override default 3 (min 1, max 10)
- `--json` — machine-readable JSON output to stdout
- `--verbose` — pipe child process stderr to parent stderr

**Constants:**
```javascript
const TAG = '[qgsd-solve]';
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_MAX_ITERATIONS = 3;
```

**Core functions:**

1. `spawnTool(script, args, opts)` — helper that spawns a child process with `spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', cwd: ROOT, timeout: 120000 })`. Returns `{ ok: boolean, stdout: string, stderr: string }`. If `--verbose`, pipe stderr to `process.stderr`. Fail-open: if spawn fails or non-zero exit, return `{ ok: false, stdout: '', stderr: errorMessage }`.

2. `sweepRtoF()` — R->F layer (Requirements to Formal).
   - Spawn `bin/generate-traceability-matrix.cjs --json --quiet`.
   - Parse JSON stdout into the traceability matrix object.
   - Extract `coverage_summary.uncovered_requirements` array.
   - Return `{ residual: uncoveredCount, detail: { uncovered_requirements: [...], total: N, covered: M, percentage: P } }`.
   - Fail-open: if tool fails, return `{ residual: -1, detail: { error: message } }` (negative residual = unknown).

3. `sweepFtoT()` — F->T layer (Formal to Tests).
   - Spawn `bin/formal-test-sync.cjs --json --report-only`.
   - Parse JSON stdout.
   - Extract `coverage_gaps.stats.gap_count` (requirements with formal coverage but no test).
   - Return `{ residual: gapCount, detail: { gap_count: N, formal_covered: M, test_covered: T, gaps: [...requirementIds] } }`.
   - Fail-open on error.

4. `sweepCtoF()` — C->F layer (Code constants to Formal constants).
   - Spawn `bin/formal-test-sync.cjs --json --report-only`.
   - Parse JSON stdout (reuse cached result from sweepFtoT if same invocation — see optimization note below).
   - Extract `constants_validation` array, filter for entries where `match === false` AND `intentional_divergence !== true` AND `config_path !== null`.
   - Return `{ residual: mismatchCount, detail: { mismatches: [...{ constant, source, formal_value, config_value }] } }`.
   - Fail-open on error.

5. `sweepTtoC()` — T->C layer (Tests to Code).
   - Spawn `node --test` with a timeout of 120s. Use `spawnSync(process.execPath, ['--test'], { encoding: 'utf8', cwd: ROOT, timeout: 120000 })`.
   - Parse exit code: 0 = all pass, non-zero = failures exist.
   - Count failures from stderr/stdout using regex: match lines like `# fail N` or `not ok` patterns from node:test TAP output. Alternatively, look for the summary line `# tests N` / `# fail N` in the output.
   - Return `{ residual: failCount, detail: { total_tests: N, passed: P, failed: F } }`.
   - Fail-open: if spawn itself fails (timeout, etc.), return residual -1.

6. `sweepFtoC()` — F->C layer (Formal verification to Code).
   - Check if `bin/run-formal-verify.cjs` exists. If not, return `{ residual: 0, detail: { skipped: true, reason: 'run-formal-verify.cjs not found' } }`.
   - Spawn `bin/run-formal-verify.cjs` (this is expensive -- 30+ steps). Use 300s timeout.
   - Parse exit code: 0 = all pass. Non-zero = failures.
   - Parse the NDJSON results from `.formal/check-results.ndjson` after the run: count entries where `result === 'fail'`.
   - Return `{ residual: failedCheckCount, detail: { total_checks: N, passed: P, failed: F, failures: [...check_ids] } }`.
   - NOTE: In `--report-only` mode, do NOT run this step (it mutates files -- regenerates specs). Instead, read the existing `.formal/check-results.ndjson` if it exists and compute residual from that stale data, adding `stale: true` to detail.

7. `computeResidual()` — runs all 5 sweeps and returns the residual vector.
   - OPTIMIZATION: `sweepFtoT()` and `sweepCtoF()` both invoke `formal-test-sync.cjs --json --report-only`. Run it ONCE, cache the parsed JSON, and extract both F->T and C->F data from the single result.
   - Returns:
   ```javascript
   {
     r_to_f: { residual: N, detail: {...} },
     f_to_t: { residual: N, detail: {...} },
     c_to_f: { residual: N, detail: {...} },
     t_to_c: { residual: N, detail: {...} },
     f_to_c: { residual: N, detail: {...} },
     total: sumOfAllResiduals,
     timestamp: isoString
   }
   ```

8. `autoClose(residualVector)` — attempts to fix gaps found by the sweep. Only runs when NOT `--report-only`.
   - **F->T gaps (test stubs):** If `f_to_t.residual > 0`, run `node bin/formal-test-sync.cjs` (without --report-only) to generate test stubs and update sidecar.
   - **C->F mismatches (constants):** If `c_to_f.residual > 0`, log the mismatches as warnings. Auto-fix is NOT attempted for constants (too risky to modify formal specs or config automatically). Log: `"[qgsd-solve] Cannot auto-fix N constant mismatch(es) — manual review required"`.
   - **T->C failures (tests):** If `t_to_c.residual > 0`, log that tests are failing. Cannot auto-fix code. Log: `"[qgsd-solve] N test failure(s) — manual fix required"`.
   - **R->F gaps (requirements without formal models):** If `r_to_f.residual > 0`, log the uncovered requirements. Cannot auto-generate formal models. Log: `"[qgsd-solve] N requirement(s) lack formal model coverage — manual modeling required"`.
   - **F->C failures (formal verification):** If `f_to_c.residual > 0`, log failures. Cannot auto-fix. Log: `"[qgsd-solve] N formal verification failure(s) — manual fix required"`.
   - Returns `{ actions_taken: [...descriptions], stubs_generated: N }`.

9. `healthIndicator(residual)` — returns health string based on residual value.
   - -1 (unknown): `"?  UNKNOWN"`
   - 0: `"OK GREEN"`
   - 1-3: `"!! YELLOW"`
   - 4+: `"XX RED"`

10. `formatReport(iterations, finalResidual, converged)` — formats human-readable output.
    - Header: `"[qgsd-solve] Consistency Solver Report"`
    - Iteration summary: `"Iterations: N/M (converged: yes/no)"`
    - Residual vector table:
    ```
    Layer Transition    Residual  Health
    ─────────────────────────────────────
    R -> F (Req->Formal)    12    XX RED
    F -> T (Formal->Test)    2    !! YELLOW
    C -> F (Code->Formal)    0    OK GREEN
    T -> C (Test->Code)      0    OK GREEN
    F -> C (Formal->Code)    3    !! YELLOW
    ─────────────────────────────────────
    Total residual:         17
    ```
    - Per-layer detail sections (only for non-zero residuals): list the specific gaps/failures.

11. `formatJSON(iterations, residuals, converged)` — returns structured JSON object:
    ```javascript
    {
      solver_version: "1.0",
      generated_at: isoString,
      iteration_count: N,
      max_iterations: M,
      converged: boolean,
      residual_vector: { r_to_f, f_to_t, c_to_f, t_to_c, f_to_c, total },
      iterations: [ { iteration: 1, residual: {...}, actions: [...] }, ... ],
      health: { r_to_f: "GREEN", f_to_t: "YELLOW", ... }
    }
    ```

**Main flow:**

```javascript
function main() {
  const maxIter = parseMaxIterations(); // from --max-iterations=N, default 3
  const iterations = [];
  let converged = false;
  let prevTotal = null;

  for (let i = 1; i <= maxIter; i++) {
    process.stderr.write(TAG + ' Iteration ' + i + '/' + maxIter + '\n');

    const residual = computeResidual();
    iterations.push({ iteration: i, residual, actions: [] });

    // Check convergence: total residual unchanged from previous iteration
    if (prevTotal !== null && residual.total === prevTotal) {
      converged = true;
      process.stderr.write(TAG + ' Converged at iteration ' + i + ' (residual stable at ' + residual.total + ')\n');
      break;
    }

    // Check if already at zero
    if (residual.total === 0) {
      converged = true;
      process.stderr.write(TAG + ' All layers clean — residual is 0\n');
      break;
    }

    // Auto-close if not report-only and not last iteration
    if (!reportOnly) {
      const actions = autoClose(residual);
      iterations[iterations.length - 1].actions = actions.actions_taken;
    } else {
      break; // report-only = single sweep, no loop
    }

    prevTotal = residual.total;
  }

  const finalResidual = iterations[iterations.length - 1].residual;

  if (jsonMode) {
    process.stdout.write(JSON.stringify(formatJSON(iterations, finalResidual, converged), null, 2) + '\n');
  } else {
    process.stdout.write(formatReport(iterations, finalResidual, converged));
  }

  // Exit with non-zero if residual > 0 (signals gaps remain)
  process.exit(finalResidual.total > 0 ? 1 : 0);
}
```

**Export for testability:** Wrap CLI in `if (require.main === module) { main(); }` and export core functions:
```javascript
module.exports = { sweep: computeResidual, computeResidual, autoClose, formatReport, formatJSON, healthIndicator };
```

**Formal invariant check:** The convergence module declares `ConvergenceEventuallyResolves == <>(logWritten = TRUE)`. This solver's convergence loop respects this: it always terminates (bounded by max_iterations) and always writes output (the report). The solver does NOT implement the Haiku-based oscillation detection (that is the circuit breaker's domain, not the solver's). No formal invariants are violated.
  </action>
  <verify>
    1. `node bin/qgsd-solve.cjs --report-only` exits with a residual summary printed to stdout.
    2. `node bin/qgsd-solve.cjs --json --report-only | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log('keys:', Object.keys(d).join(', '))"` prints keys including `residual_vector`, `converged`, `iteration_count`.
    3. `node -e "const s = require('./bin/qgsd-solve.cjs'); console.log(typeof s.computeResidual, typeof s.healthIndicator)"` prints `function function`.
    4. `node bin/qgsd-solve.cjs --report-only --max-iterations=1 2>&1 | grep -c 'Iteration'` outputs at least 1.
  </verify>
  <done>
    bin/qgsd-solve.cjs is a working CLI that performs 5 layer-transition sweeps, computes a residual vector, auto-closes gaps via iteration (when not --report-only), outputs human-readable or JSON reports with health indicators, and exports core functions for testing. Respects convergence invariant by bounded iteration with termination guarantee.
  </done>
</task>

<task type="auto">
  <name>Task 2: Create test suite and skill definition</name>
  <files>
    bin/qgsd-solve.test.cjs
    commands/qgsd/solve.md
  </files>
  <action>
**Step 1 -- Create `bin/qgsd-solve.test.cjs`:**

Use `node:test` + `node:assert/strict` (same pattern as `bin/formal-test-sync.test.cjs` and all other test files).

**Unit tests for pure functions:**

TC-HEALTH-1: `healthIndicator(-1)` returns string containing `"UNKNOWN"`.
TC-HEALTH-2: `healthIndicator(0)` returns string containing `"GREEN"`.
TC-HEALTH-3: `healthIndicator(2)` returns string containing `"YELLOW"`.
TC-HEALTH-4: `healthIndicator(5)` returns string containing `"RED"`.

TC-FORMAT-1: `formatReport(iterations, finalResidual, true)` where finalResidual has total=0 -- output contains `"converged"` or `"Converged"` and `"GREEN"`.
TC-FORMAT-2: `formatReport(iterations, finalResidual, false)` where finalResidual has total=5 -- output contains `"RED"` or `"YELLOW"`.

TC-JSON-1: `formatJSON(iterations, finalResidual, true)` returns object with correct keys: `solver_version`, `generated_at`, `iteration_count`, `converged`, `residual_vector`, `health`.
TC-JSON-2: `formatJSON([...], { total: 0, r_to_f: { residual: 0 }, f_to_t: { residual: 0 }, c_to_f: { residual: 0 }, t_to_c: { residual: 0 }, f_to_c: { residual: 0 } }, true)` has `converged: true` and all health values contain `"GREEN"`.

**Integration tests (spawn the actual CLI):**

TC-INT-1: `node bin/qgsd-solve.cjs --json --report-only` exits without crashing (exit code 0 or 1 depending on current project state -- either is acceptable), stdout is valid JSON with `residual_vector` key.
TC-INT-2: `node bin/qgsd-solve.cjs --report-only` exits without crashing, stdout contains `"Layer Transition"` or `"Residual"` or `"qgsd-solve"` (human-readable format marker).
TC-INT-3: `node bin/qgsd-solve.cjs --report-only --max-iterations=1` -- stderr contains `"Iteration 1"`.
TC-INT-4: `node bin/qgsd-solve.cjs --json --report-only --verbose` -- exits without crash, JSON output still valid.

**Convergence logic test:**

TC-CONV-1: Mock scenario -- if residual total is identical across two iterations, the solver should report `converged: true`. Test this by calling the main logic with a mock `computeResidual` that returns the same vector twice. Implementation: since we cannot easily mock spawnSync, test this indirectly by verifying that `--report-only` mode always does exactly 1 iteration (check `iteration_count === 1` in JSON output).

Import functions: `const { healthIndicator, formatReport, formatJSON } = require('./qgsd-solve.cjs');`

Use `spawnSync` for integration tests, same pattern as formal-test-sync.test.cjs.

**Step 2 -- Create `commands/qgsd/solve.md` skill definition:**

Follow the exact pattern from `commands/qgsd/formal-test-sync.md`:

```markdown
---
name: qgsd:solve
description: Run the consistency solver - sweeps Requirements->Formal->Tests->Code, computes residual vector, auto-closes gaps
argument-hint: [--report-only] [--max-iterations=N] [--json] [--verbose]
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
---

<objective>
Run the QGSD consistency solver. Sweeps 5 layer transitions (R->F, F->T, C->F, T->C, F->C), computes a residual vector showing gaps at each boundary, and optionally auto-closes gaps by generating test stubs, regenerating formal specs, and fixing constants. Iterates until residual converges or max iterations reached.
</objective>

<execution_context>
None required -- self-contained orchestrator.
</execution_context>

<process>
Run `node bin/qgsd-solve.cjs $ARGUMENTS` and display results.

Default mode (no flags): runs up to 3 iterations of sweep + auto-close. Generates test stubs for uncovered invariants, updates traceability data.

Use `--report-only` for read-only analysis (single sweep, no mutations).

Use `--json` for machine-readable output.

Use `--max-iterations=N` to control iteration limit (default 3, max 10).

Use `--verbose` for detailed per-step diagnostics.

**Interpreting the residual vector:**
- GREEN (0): Layer transition is fully consistent
- YELLOW (1-3): Minor gaps exist
- RED (4+): Significant gaps requiring attention

**Layer transitions:**
- R->F: Requirements lacking formal model coverage
- F->T: Formal invariants lacking test backing
- C->F: Code constants diverging from formal specs
- T->C: Failing unit tests
- F->C: Failing formal verification checks
</process>
```
  </action>
  <verify>
    1. `node --test bin/qgsd-solve.test.cjs` -- all tests pass.
    2. `cat commands/qgsd/solve.md | head -5` -- contains `name: qgsd:solve`.
    3. `grep -c 'healthIndicator\|formatReport\|formatJSON\|TC-' bin/qgsd-solve.test.cjs` -- at least 10 matches (confirms test breadth).
  </verify>
  <done>
    bin/qgsd-solve.test.cjs has unit tests for healthIndicator, formatReport, formatJSON, plus integration tests that spawn the actual CLI. commands/qgsd/solve.md is a complete skill definition with argument docs and interpretation guide. All tests pass.
  </done>
</task>

</tasks>

<verification>
1. `node bin/qgsd-solve.cjs --report-only` -- prints residual vector with health indicators for all 5 layer transitions.
2. `node bin/qgsd-solve.cjs --json --report-only` -- valid JSON with residual_vector, converged, iteration_count keys.
3. `node --test bin/qgsd-solve.test.cjs` -- all TC-HEALTH, TC-FORMAT, TC-JSON, TC-INT, TC-CONV tests pass.
4. `cat commands/qgsd/solve.md` -- skill definition exists with correct frontmatter and process section.
5. `node -e "const s = require('./bin/qgsd-solve.cjs'); console.log(typeof s.healthIndicator)"` -- prints `function` (exports work).
</verification>

<success_criteria>
- `node bin/qgsd-solve.cjs --json --report-only` exits with valid JSON containing residual_vector
- `node bin/qgsd-solve.cjs --report-only` exits with human-readable report containing health indicators
- `node --test bin/qgsd-solve.test.cjs` exits 0 (all tests pass)
- `commands/qgsd/solve.md` exists with `name: qgsd:solve` in frontmatter
- Core functions (computeResidual, healthIndicator, formatReport, formatJSON) are exported for testability
</success_criteria>

<output>
After completion, create `.planning/quick/140-implement-qgsd-solve-consistency-solver-/140-SUMMARY.md`
</output>

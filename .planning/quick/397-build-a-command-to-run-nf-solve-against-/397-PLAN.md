---
phase: 397-nf-benchmark-solve
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/nf-benchmark-solve.cjs
  - .planning/formal/solve-benchmark-fixtures.json
  - package.json
autonomous: true
requirements: [INTENT-01]
formal_artifacts: none

must_haves:
  truths:
    - "Running `node bin/nf-benchmark-solve.cjs --dry-run` exits 0 and prints fixture names without invoking nf-solve"
    - "Running `node bin/nf-benchmark-solve.cjs` against a fixture set reports pass/fail per issue with overall pass rate and duration"
    - "`npm run benchmark:solve` is a valid script entry in package.json"
    - "The --fixture flag accepts a custom JSON path to override the default fixture file"
    - "Each fixture result reports: issue label, pass/fail, total residual, duration_ms"
  artifacts:
    - path: "bin/nf-benchmark-solve.cjs"
      provides: "Benchmark runner for nf:solve end-to-end validation"
      min_lines: 80
    - path: ".planning/formal/solve-benchmark-fixtures.json"
      provides: "Fixture definitions for synthetic benchmark issues"
      contains: "\"fixtures\""
  key_links:
    - from: "bin/nf-benchmark-solve.cjs"
      to: "bin/nf-solve.cjs"
      via: "spawnSync with --report-only --json --no-timeout --project-root flags"
      pattern: "nf-solve.cjs"
    - from: "package.json scripts.benchmark:solve"
      to: "bin/nf-benchmark-solve.cjs"
      via: "npm run benchmark:solve"
      pattern: "benchmark:solve"
---

<objective>
Create `bin/nf-benchmark-solve.cjs` — a command that runs nf:solve against a fixture set of synthetic issues and reports pass/fail per issue plus aggregate metrics (pass rate, total duration).

Purpose: Validate nf:solve's autonomous issue resolution capacity against a repeatable, version-controlled benchmark. Enables regression detection as the solver evolves.
Output: `bin/nf-benchmark-solve.cjs`, `.planning/formal/solve-benchmark-fixtures.json`, `package.json` script entry.
</objective>

<execution_context>
@./.claude/nf/workflows/execute-plan.md
@./.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/quick/397-build-a-command-to-run-nf-solve-against-/scope-contract.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create solve-benchmark-fixtures.json with synthetic issue fixtures</name>
  <files>.planning/formal/solve-benchmark-fixtures.json</files>
  <action>
Create `.planning/formal/solve-benchmark-fixtures.json` with a `fixtures` array. Each fixture describes a synthetic issue that nf-solve should be able to resolve or report on. The benchmark does NOT create temporary repos — instead each fixture runs nf-solve against the CURRENT repo root with controlled flags to measure its diagnostic capacity.

Each fixture has:
- `id` (string): short unique identifier, e.g. "f2t-gap-detection"
- `label` (string): human-readable description
- `args` (array of strings): CLI flags passed to nf-solve.cjs (always include `--report-only`, `--json`, `--no-timeout`, `--max-iterations=1`)
- `expect_convergence` (boolean): whether the solver should report converged=true
- `min_residual` (number | null): minimum expected total residual (null = no assertion)
- `max_residual` (number | null): maximum expected total residual (null = no assertion)
- `pass_condition` (string): one of "exits_zero", "converged", "residual_lte:<N>", "residual_gte:<N>"

Include at minimum 5 fixtures covering distinct solve modes:
1. `{ id: "report-only-fast", label: "Fast report-only sweep (skip proximity)", args: ["--report-only", "--json", "--no-timeout", "--max-iterations=1", "--fast", "--skip-proximity"], expect_convergence: false, min_residual: null, max_residual: null, pass_condition: "exits_zero" }`
2. `{ id: "report-only-full", label: "Full report-only single-iteration sweep", args: ["--report-only", "--json", "--no-timeout", "--max-iterations=1"], expect_convergence: false, min_residual: null, max_residual: null, pass_condition: "exits_zero" }`
3. `{ id: "skip-layers-r2f", label: "Skip R->F layer, single iteration", args: ["--report-only", "--json", "--no-timeout", "--max-iterations=1", "--skip-layers=r_to_f"], expect_convergence: false, min_residual: null, max_residual: null, pass_condition: "exits_zero" }`
4. `{ id: "focus-formal", label: "Focus filter on 'formal model' topic", args: ["--report-only", "--json", "--no-timeout", "--max-iterations=1", "--focus=formal model"], expect_convergence: false, min_residual: null, max_residual: null, pass_condition: "exits_zero" }`
5. `{ id: "zero-residual-check", label: "Assert solver reports a numeric residual (not -1 error)", args: ["--report-only", "--json", "--no-timeout", "--max-iterations=1", "--fast"], expect_convergence: false, min_residual: 0, max_residual: null, pass_condition: "exits_zero" }`

Top-level structure: `{ "version": 1, "description": "nf:solve benchmark fixture set", "fixtures": [...] }`
  </action>
  <verify>node -e "const f = require('./.planning/formal/solve-benchmark-fixtures.json'); console.log('fixtures:', f.fixtures.length, 'version:', f.version);" 2>&1 | grep "fixtures: 5"</verify>
  <done>File exists with version=1, fixtures array of 5 entries, each having id/label/args/pass_condition fields.</done>
</task>

<task type="auto">
  <name>Task 2: Create bin/nf-benchmark-solve.cjs and add package.json script</name>
  <files>bin/nf-benchmark-solve.cjs, package.json</files>
  <action>
Create `bin/nf-benchmark-solve.cjs` following the coding-style rules: `'use strict'`, CommonJS, shebang `#!/usr/bin/env node`.

The script must:

**CLI flags:**
- `--dry-run`: print fixture names and args, skip running nf-solve, exit 0
- `--fixture <path>`: override default fixture JSON path (default: `.planning/formal/solve-benchmark-fixtures.json`)
- `--verbose`: pipe nf-solve stderr to parent stderr during each run

**Execution flow:**
1. Parse CLI args for `--dry-run`, `--fixture`, `--verbose`
2. Resolve fixture JSON path; read and parse it. If missing, print error and exit 1 (pre-flight check: `if (!fs.existsSync(fixturePath)) { console.error('ERROR: fixture file not found: ' + fixturePath); process.exit(1); }`)
3. Print header: `nf:solve benchmark — N fixtures`
4. If `--dry-run`, print each fixture as `  [dry-run] <id>: <label>  args: <args.join(' ')>` then exit 0
5. For each fixture in order:
   a. Record `start = Date.now()`
   b. Run nf-solve via `spawnSync(process.execPath, [solveScript, ...fixture.args, '--project-root=' + ROOT], { cwd: ROOT, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 })` where `solveScript = path.join(__dirname, 'nf-solve.cjs')` and `ROOT = process.cwd()`
   c. Record `duration = Date.now() - start`
   d. Parse stdout as JSON (fail-open: if parse fails, treat as `{}`)
   e. Extract `residual` from JSON (sum `iterations[last].residuals` values — or `result.total_residual` if present — or default -1). Extract `converged` boolean from JSON (default false).
   f. Evaluate pass condition:
      - `"exits_zero"`: spawnSync status === 0
      - `"converged"`: parsed.converged === true
      - `"residual_lte:<N>"`: residual <= N
      - `"residual_gte:<N>"`: residual >= N
   g. Apply min_residual/max_residual assertions on top of pass_condition (both must pass)
   h. Print per-fixture line: `  [PASS|FAIL] <id>: <label>  residual=<N>  duration=<Xms>`
   i. Collect result into results array
6. Print summary table:
   ```
   ─────────────────────────────────────────
   Results: <passed>/<total> passed  (<rate>%)
   Total duration: <Xms>
   ─────────────────────────────────────────
   ```
7. Exit with code 0 if all passed, 1 if any failed.

**JSON output for --json** (if flag present): print `{ passed, failed, total, pass_rate, duration_ms, results: [...] }` to stdout instead of table. (Keep --json optional — not required for task to be done.)

**Residual extraction helper:**
```js
function extractResidual(parsed) {
  if (!parsed || typeof parsed !== 'object') return -1;
  // nf-solve --json output: { iterations: [{residuals: {r_to_f: N, ...}}], ...}
  if (Array.isArray(parsed.iterations) && parsed.iterations.length > 0) {
    const last = parsed.iterations[parsed.iterations.length - 1];
    if (last && last.residuals && typeof last.residuals === 'object') {
      return Object.values(last.residuals).reduce((s, v) => s + (typeof v === 'number' && v >= 0 ? v : 0), 0);
    }
  }
  if (typeof parsed.total_residual === 'number') return parsed.total_residual;
  return -1;
}
```

**package.json change:** In the `"scripts"` object, add `"benchmark:solve": "node bin/nf-benchmark-solve.cjs"` after the existing `"formal-verify:petri"` entry. Read package.json first, add the key, write back with `JSON.stringify(obj, null, 2) + '\n'`.

Do NOT use `sed` or heredoc for package.json — read it with `fs.readFileSync`, mutate the object, write with `fs.writeFileSync`. Do this inside the executor task as a step (write the script first, then edit package.json programmatically or as a direct JSON edit).
  </action>
  <verify>node bin/nf-benchmark-solve.cjs --dry-run 2>&1 | grep "dry-run" && node -e "const p = require('./package.json'); console.log(p.scripts['benchmark:solve'])" | grep "nf-benchmark-solve"</verify>
  <done>`--dry-run` lists all 5 fixtures without invoking nf-solve and exits 0. `npm run benchmark:solve -- --dry-run` works. package.json has `"benchmark:solve"` script entry.</done>
</task>

</tasks>

<verification>
1. `node bin/nf-benchmark-solve.cjs --dry-run` exits 0, prints 5 fixture lines, no nf-solve processes spawned
2. `node -e "const p = require('./package.json'); console.log(p.scripts['benchmark:solve'])"` prints `node bin/nf-benchmark-solve.cjs`
3. `node -e "const f = require('./.planning/formal/solve-benchmark-fixtures.json'); f.fixtures.forEach(x => { ['id','label','args','pass_condition'].forEach(k => { if (!x[k]) throw new Error('missing ' + k + ' in ' + x.id); }); }); console.log('fixtures valid');"` prints "fixtures valid"
4. Script contains shebang, `'use strict'`, uses CommonJS `require`/`module.exports` pattern
5. `node bin/nf-benchmark-solve.cjs --fixture /nonexistent/path.json` exits 1 with "ERROR: fixture file not found"
</verification>

<success_criteria>
- `bin/nf-benchmark-solve.cjs` exists and is runnable
- `--dry-run` flag lists fixtures without running nf-solve
- `--fixture <path>` flag is parsed and respected (pre-flight error on missing file)
- `package.json` has `"benchmark:solve": "node bin/nf-benchmark-solve.cjs"`
- `.planning/formal/solve-benchmark-fixtures.json` has 5 fixtures with required fields
- Full run (no --dry-run) invokes nf-solve once per fixture via spawnSync and reports PASS/FAIL per fixture plus aggregate metrics
</success_criteria>

<output>
After completion, create `.planning/quick/397-build-a-command-to-run-nf-solve-against-/397-SUMMARY.md`
</output>

---
phase: quick-402
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/benchmark-utils.cjs
  - bin/nf-benchmark.cjs
  - bin/nf-benchmark-solve.cjs
  - benchmarks/quick/fixtures.json
  - benchmarks/quick/baseline.json
  - .github/workflows/benchmark-gate.yml
autonomous: true
requirements: [BENCH-01, BENCH-02, BENCH-03, BENCH-04, BENCH-05, BENCH-06]
formal_artifacts: none

must_haves:
  truths:
    - "node bin/nf-benchmark.cjs --skill=quick --track=smoke --json exits 0 and outputs valid JSON with a numeric pass_rate field"
    - "benchmarks/quick/fixtures.json exists and contains at least one fixture with pass_condition: exits_zero that requires no LLM API key"
    - "benchmarks/quick/baseline.json exists with a numeric pass_rate floor"
    - "benchmark-gate.yml runs both the solve smoke benchmark and the quick smoke benchmark; the job fails if either score drops below its baseline"
    - "evaluatePassCondition, extractResidual, snapshotFormalJson, and restoreFormalJson are exported from bin/benchmark-utils.cjs and imported (not re-inlined) by both nf-benchmark-solve.cjs and nf-benchmark.cjs"
    - "No fixture in the quick smoke track sets ANTHROPIC_API_KEY or calls any LLM endpoint"
  artifacts:
    - path: bin/benchmark-utils.cjs
      provides: "Shared benchmark utilities: evaluatePassCondition, extractResidual, extractLayerResidual, snapshotFormalJson, restoreFormalJson, setNestedField"
      exports: [evaluatePassCondition, extractResidual, extractLayerResidual, snapshotFormalJson, restoreFormalJson, setNestedField]
    - path: bin/nf-benchmark.cjs
      provides: "Generic benchmark runner supporting --skill=<name> --track=<name> --json"
      min_lines: 80
    - path: benchmarks/quick/fixtures.json
      provides: "Smoke fixtures for nf:quick skill"
      contains: "exits_zero"
    - path: benchmarks/quick/baseline.json
      provides: "Baseline floor for quick smoke benchmark gate"
      contains: "pass_rate"
    - path: .github/workflows/benchmark-gate.yml
      provides: "CI gate running both solve and quick benchmarks"
  key_links:
    - from: bin/nf-benchmark-solve.cjs
      to: bin/benchmark-utils.cjs
      via: "require('./benchmark-utils.cjs')"
      pattern: "require.*benchmark-utils"
    - from: bin/nf-benchmark.cjs
      to: bin/benchmark-utils.cjs
      via: "require('./benchmark-utils.cjs')"
      pattern: "require.*benchmark-utils"
    - from: .github/workflows/benchmark-gate.yml
      to: bin/nf-benchmark.cjs
      via: "node bin/nf-benchmark.cjs --skill=quick --track=smoke --json"
      pattern: "nf-benchmark"
    - from: scripts/check-benchmark-gate.cjs
      to: benchmarks/quick/baseline.json
      via: "second positional arg to check-benchmark-gate.cjs"
      pattern: "quick/baseline"
---

<objective>
Build the generic benchmark runner for nForma skills (issue #107).

Purpose: Enable consistent, CI-enforced quality gates for multiple skills (starting with quick smoke) using shared infrastructure extracted from the existing solve benchmark.
Output: bin/benchmark-utils.cjs (shared utilities), bin/nf-benchmark.cjs (generic runner), benchmarks/quick/ (fixtures + baseline), updated benchmark-gate.yml running both skills.
</objective>

<execution_context>
@./.claude/nf/workflows/execute-plan.md
@./.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/quick/402-build-generic-benchmark-runner-for-nform/scope-contract.json
@bin/nf-benchmark-solve.cjs
@scripts/check-benchmark-gate.cjs
@benchmarks/solve-baseline.json
@.github/workflows/benchmark-gate.yml
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extract benchmark-utils, create nf-benchmark.cjs, add quick skill fixtures and baseline</name>
  <files>
    bin/benchmark-utils.cjs
    bin/nf-benchmark.cjs
    bin/nf-benchmark-solve.cjs
    benchmarks/quick/fixtures.json
    benchmarks/quick/baseline.json
  </files>
  <action>
**Step 1 — Create bin/benchmark-utils.cjs**

Extract the following functions verbatim from bin/nf-benchmark-solve.cjs into a new CommonJS module bin/benchmark-utils.cjs (no changes to logic):
- `evaluatePassCondition(fixture, spawnResult, parsed, residual)` — evaluates pass_condition string against a spawn result
- `extractResidual(parsed)` — extracts total residual from nf-solve --json output
- `extractLayerResidual(parsed, layer)` — extracts per-layer residual from nf-solve --json output
- `snapshotFormalJson()` — captures all .json files in .planning/formal/ top-level
- `restoreFormalJson(snap)` — restores files captured in snapshot
- `setNestedField(obj, dotPath, value)` — sets a dot-path field on an object

The module must export all six functions: `module.exports = { evaluatePassCondition, extractResidual, extractLayerResidual, snapshotFormalJson, restoreFormalJson, setNestedField };`

Note: `snapshotFormalJson` and `restoreFormalJson` reference `FORMAL_DIR` = `path.join(process.cwd(), '.planning', 'formal')` — define this constant inside the module (not as a captured closure from the caller).

**Step 2 — Refactor bin/nf-benchmark-solve.cjs to import from utils**

Remove the six extracted function bodies from nf-benchmark-solve.cjs. Add at the top (after the existing `require` lines):
```js
const { evaluatePassCondition, extractResidual, extractLayerResidual, snapshotFormalJson, restoreFormalJson, setNestedField } = require('./benchmark-utils.cjs');
```
Remove the local `FORMAL_DIR` constant and `setNestedField` definition — they now come from benchmark-utils. The rest of the file stays identical.

Verify no re-inlining: the local function bodies for these six functions must NOT appear in nf-benchmark-solve.cjs after the edit.

**Step 3 — Create bin/nf-benchmark.cjs (generic runner)**

Create a new runner that mirrors the structure of nf-benchmark-solve.cjs but works generically for any skill. The runner:

CLI interface:
```
node bin/nf-benchmark.cjs --skill=<name> --track=<name> [--json] [--dry-run] [--verbose]
```

Defaults: `--track=smoke`, `--json` is off by default.

Fixture loading:
- Fixture file path: `benchmarks/<skill>/fixtures.json`
- The fixture JSON schema is: `{ "version": 1, "fixtures": [ { "id", "label", "command", "args", "pass_condition", "env_required": [] } ] }`
- Each fixture specifies a `command` (e.g., `"node"`) and `args` array. The runner spawns the command + args using `spawnSync` with `cwd: process.cwd()`, `encoding: 'utf8'`, `maxBuffer: 8 * 1024 * 1024`, `timeout: 60000`.
- Pass condition evaluation: call `evaluatePassCondition(fixture, spawnResult, parsed, residual)` from benchmark-utils. For the `quick` skill smoke fixtures the `exits_zero` condition is sufficient — no residual parsing is needed.

Pre-flight check: before each fixture, if `fixture.env_required` is a non-empty array, check that each env var is set in `process.env`. If any is missing, skip the fixture with `skip_reason: "env var <NAME> not set"`. This enforces AC-6 (no API key required in smoke track).

JSON output shape (same as nf-benchmark-solve):
```json
{
  "skill": "<name>",
  "track": "<name>",
  "passed": N,
  "failed": N,
  "total": N,
  "pass_rate": N,
  "duration_ms": N,
  "results": [...]
}
```

Exit code: 1 if any fixture failed (not skipped), 0 otherwise.

**Step 4 — Create benchmarks/quick/fixtures.json**

Create the directory `benchmarks/quick/` and write fixtures.json with version 1 and three smoke fixtures for nf:quick — all using `pass_condition: "exits_zero"`, `env_required: []` (no API key), and invoking node scripts that are deterministic and fast:

```json
{
  "version": 1,
  "description": "nf:quick skill smoke fixtures — no LLM API key required",
  "fixtures": [
    {
      "id": "bench-pure-util-identity",
      "label": "bench-pure-util identity function returns input",
      "command": "node",
      "args": ["-e", "const m=require('./bin/bench-pure-util.cjs'); process.exit(m.identity(42)===42?0:1)"],
      "pass_condition": "exits_zero",
      "env_required": []
    },
    {
      "id": "bench-feature-handler-process",
      "label": "bench-feature-handler processFeature returns processed:true",
      "command": "node",
      "args": ["-e", "const m=require('./bin/bench-feature-handler.cjs'); const r=m.processFeature({name:'smoke'}); process.exit(r.processed===true?0:1)"],
      "pass_condition": "exits_zero",
      "env_required": []
    },
    {
      "id": "bench-utility-transform",
      "label": "bench-utility benchTransform filters empty lines",
      "command": "node",
      "args": ["-e", "const m=require('./bin/bench-utility.cjs'); const r=m.benchTransform('a\\n\\nb'); process.exit(r.length===2?0:1)"],
      "pass_condition": "exits_zero",
      "env_required": []
    }
  ]
}
```

**Step 5 — Create benchmarks/quick/baseline.json**

```json
{
  "pass_rate": 100,
  "updated_at": "2026-04-17",
  "note": "Floor for the quick smoke benchmark. A release PR is blocked if its pass_rate < this value."
}
```
  </action>
  <verify>
    1. `node bin/nf-benchmark.cjs --skill=quick --track=smoke --json` exits 0 and the stdout is valid JSON containing a numeric `pass_rate` field.
    2. `grep -c 'require.*benchmark-utils' bin/nf-benchmark-solve.cjs` returns at least 1.
    3. Confirm none of the six extracted function bodies appear in nf-benchmark-solve.cjs: `grep -c 'function evaluatePassCondition\|function extractResidual\|function snapshotFormalJson\|function restoreFormalJson\|function setNestedField\|function extractLayerResidual' bin/nf-benchmark-solve.cjs` returns 0.
    4. `node -e "const u=require('./bin/benchmark-utils.cjs'); const fns=['evaluatePassCondition','extractResidual','extractLayerResidual','snapshotFormalJson','restoreFormalJson','setNestedField']; fns.forEach(f=>{if(typeof u[f]!=='function')throw new Error(f+' missing')}); console.log('ok')"` prints ok.
    5. `cat benchmarks/quick/baseline.json` shows a JSON object with numeric pass_rate.
  </verify>
  <done>
    bin/benchmark-utils.cjs exports all six shared utility functions. bin/nf-benchmark-solve.cjs imports from it with no re-inlined function bodies. bin/nf-benchmark.cjs --skill=quick --track=smoke --json exits 0 with valid JSON output containing pass_rate. benchmarks/quick/fixtures.json has three exits_zero fixtures with no env_required entries. benchmarks/quick/baseline.json exists.
  </done>
</task>

<task type="auto">
  <name>Task 2: Update benchmark-gate.yml to enforce both solve and quick baselines</name>
  <files>
    .github/workflows/benchmark-gate.yml
  </files>
  <action>
Rewrite .github/workflows/benchmark-gate.yml to run two benchmark jobs in sequence: solve smoke and quick smoke. Both must pass for the gate to succeed.

The new structure:

```yaml
name: Benchmark gate

on:
  pull_request:
    branches: [main]

jobs:
  benchmark-solve:
    name: Solve smoke benchmark
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install dependencies
        run: npm ci --ignore-scripts || npm install --ignore-scripts
      - name: Build artifacts
        run: npm run build:hooks && npm run build:machines
      - name: Run solve smoke benchmark
        id: bench
        run: |
          node bin/nf-benchmark-solve.cjs --json --track=smoke > bench-solve-output.json 2>&1 || true
          cat bench-solve-output.json
      - name: Check score against baseline
        run: node scripts/check-benchmark-gate.cjs bench-solve-output.json benchmarks/solve-baseline.json

  benchmark-quick:
    name: Quick smoke benchmark
    runs-on: ubuntu-latest
    timeout-minutes: 5
    needs: benchmark-solve
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install dependencies
        run: npm ci --ignore-scripts || npm install --ignore-scripts
      - name: Build artifacts
        run: npm run build:hooks && npm run build:machines
      - name: Run quick smoke benchmark
        run: |
          node bin/nf-benchmark.cjs --skill=quick --track=smoke --json > bench-quick-output.json 2>&1 || true
          cat bench-quick-output.json
      - name: Check score against baseline
        run: node scripts/check-benchmark-gate.cjs bench-quick-output.json benchmarks/quick/baseline.json
```

The `needs: benchmark-solve` ensures quick only runs after solve passes. `check-benchmark-gate.cjs` already accepts a second positional argument for the baseline path, so no changes to that script are needed.

Also update the existing solve baseline path reference: the check-benchmark-gate step in benchmark-solve now explicitly passes `benchmarks/solve-baseline.json` as the second argument to avoid ambiguity (previously it relied on the default path which was already correct, but this makes it explicit and symmetrical with the quick job).
  </action>
  <verify>
    1. `cat .github/workflows/benchmark-gate.yml | grep -c 'nf-benchmark.cjs'` returns at least 1.
    2. `cat .github/workflows/benchmark-gate.yml | grep -c 'quick/baseline.json'` returns at least 1.
    3. `cat .github/workflows/benchmark-gate.yml | grep 'needs:'` shows `benchmark-solve`.
    4. `node scripts/check-benchmark-gate.cjs bench-quick-output.json benchmarks/quick/baseline.json` — verify the script accepts two args without error by running it against the output from Task 1's verify step.
  </verify>
  <done>
    benchmark-gate.yml has two jobs: benchmark-solve and benchmark-quick. benchmark-quick needs benchmark-solve. Both use check-benchmark-gate.cjs with explicit baseline paths. The gate will block a PR if either benchmark drops below its floor.
  </done>
</task>

</tasks>

<verification>
Full acceptance check:
1. `node bin/nf-benchmark.cjs --skill=quick --track=smoke --json` exits 0 and outputs `{ "pass_rate": 100, ... }` (AC-1)
2. `cat benchmarks/quick/fixtures.json | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); process.exit(d.fixtures.some(f=>f.pass_condition==='exits_zero')?0:1)"` exits 0 (AC-2)
3. `ls benchmarks/quick/baseline.json` exists (AC-3)
4. `grep 'nf-benchmark' .github/workflows/benchmark-gate.yml` shows quick runner invocation (AC-4)
5. `node -e "const u=require('./bin/benchmark-utils.cjs'); console.log(typeof u.evaluatePassCondition)"` prints `function` (AC-5)
6. `cat benchmarks/quick/fixtures.json | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); const bad=d.fixtures.filter(f=>Array.isArray(f.env_required)&&f.env_required.length>0); process.exit(bad.length===0?0:1)"` exits 0 (AC-6)
</verification>

<success_criteria>
- bin/benchmark-utils.cjs exports 6 functions; neither nf-benchmark-solve.cjs nor nf-benchmark.cjs re-inlines them
- `node bin/nf-benchmark.cjs --skill=quick --track=smoke --json` exits 0 with valid JSON containing pass_rate
- benchmarks/quick/fixtures.json has >= 1 exits_zero fixture with env_required: []
- benchmarks/quick/baseline.json exists with numeric pass_rate
- benchmark-gate.yml runs both solve and quick smoke benchmarks and enforces both baselines
</success_criteria>

<output>
After completion, create `.planning/quick/402-build-generic-benchmark-runner-for-nform/402-SUMMARY.md`
</output>

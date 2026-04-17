---
phase: 403-add-nf-debug-benchmark-track-with-generi
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/bench-buggy-sort.cjs
  - bin/bench-buggy-filter.cjs
  - bin/bench-buggy-counter.cjs
  - bin/benchmark-utils.cjs
  - bin/nf-benchmark.cjs
  - benchmarks/debug/fixtures.json
  - benchmarks/debug/baseline.json
  - .planning/formal/spec/debug-bench-sort/bug.tla
  - .planning/formal/spec/debug-bench-sort/bug.cfg
  - .planning/formal/spec/debug-bench-sort/fix.tla
  - .planning/formal/spec/debug-bench-sort/fix.cfg
  - .planning/formal/spec/debug-bench-filter/bug.tla
  - .planning/formal/spec/debug-bench-filter/bug.cfg
  - .planning/formal/spec/debug-bench-filter/fix.tla
  - .planning/formal/spec/debug-bench-filter/fix.cfg
  - .planning/formal/spec/debug-bench-counter/bug.tla
  - .planning/formal/spec/debug-bench-counter/bug.cfg
  - .planning/formal/spec/debug-bench-counter/fix.tla
  - .planning/formal/spec/debug-bench-counter/fix.cfg
  - .github/workflows/benchmark-gate.yml
autonomous: true
requirements: [BENCH-DEBUG-01]
formal_artifacts: create

must_haves:
  truths:
    - "node bin/nf-benchmark.cjs --skill=debug --track=full runs without error"
    - "Three buggy stubs exist and each exports the intentionally broken function"
    - "Six TLA+ models exist — one bug.tla and one fix.tla per stub"
    - "benchmark-utils.cjs evaluatePassCondition handles tlc_counterexample_found and tlc_fix_verified"
    - "benchmarks/debug/fixtures.json contains 6 fixtures (bug + fix per stub) with correct pass_conditions"
    - "CI benchmark-gate.yml runs the debug full-track benchmark on every PR"
    - "Each fixture result in the JSON output contains a traces array with raw TLC output lines"
  artifacts:
    - path: "bin/bench-buggy-sort.cjs"
      provides: "Buggy sort (>= comparator) — exports buggySort"
    - path: "bin/bench-buggy-filter.cjs"
      provides: "Buggy filter (> threshold) — exports buggyFilter"
    - path: "bin/bench-buggy-counter.cjs"
      provides: "Buggy counter (< hi) — exports buggyCounter"
    - path: "bin/benchmark-utils.cjs"
      provides: "evaluatePassCondition extended with TLC pass conditions; sets fixture._traces on each evaluation"
    - path: "bin/nf-benchmark.cjs"
      provides: "Runner patched to include traces: fixture._traces || [] in each result object"
    - path: "benchmarks/debug/fixtures.json"
      provides: "6 fixtures: 3 × tlc_counterexample_found + 3 × tlc_fix_verified"
    - path: "benchmarks/debug/baseline.json"
      provides: "Baseline floor for debug track gate"
    - path: ".planning/formal/spec/debug-bench-sort/bug.tla"
      provides: "TLA+ model of sort bug — TLC should find counterexample"
    - path: ".planning/formal/spec/debug-bench-sort/fix.tla"
      provides: "TLA+ model of sort fix — TLC should verify clean"
    - path: ".planning/formal/spec/debug-bench-filter/bug.tla"
      provides: "TLA+ model of filter bug — TLC should find counterexample"
    - path: ".planning/formal/spec/debug-bench-filter/fix.tla"
      provides: "TLA+ model of filter fix — TLC should verify clean"
    - path: ".planning/formal/spec/debug-bench-counter/bug.tla"
      provides: "TLA+ model of counter bug — TLC should find counterexample"
    - path: ".planning/formal/spec/debug-bench-counter/fix.tla"
      provides: "TLA+ model of counter fix — TLC should verify clean"
  key_links:
    - from: "benchmarks/debug/fixtures.json"
      to: "bin/nf-benchmark.cjs"
      via: "loaded via fixturePath = benchmarks/<skill>/fixtures.json"
      pattern: "skill.*debug"
    - from: "benchmarks/debug/fixtures.json"
      to: "bin/benchmark-utils.cjs evaluatePassCondition"
      via: "fixture.pass_condition checked in evaluatePassCondition"
      pattern: "tlc_counterexample_found|tlc_fix_verified"
    - from: ".planning/formal/spec/debug-bench-*/bug.tla"
      to: "bin/benchmark-utils.cjs runTlcOnModel"
      via: "fixture.bug_model or fixture.fix_model path → spawnSync java TLC"
      pattern: "bug_model|fix_model"
    - from: "bin/benchmark-utils.cjs evaluatePassCondition"
      to: "bin/nf-benchmark.cjs result object"
      via: "fixture._traces set during evaluatePassCondition, read back as traces: fixture._traces || [] in result push"
      pattern: "fixture\\._traces"
    - from: ".github/workflows/benchmark-gate.yml"
      to: "node bin/nf-benchmark.cjs --skill=debug --track=full"
      via: "new benchmark-debug CI job"
      pattern: "skill=debug"
---

<objective>
Create the nf:debug benchmark track: 3 buggy bench stubs with seeded defects, 6 TLA+ models (bug/fix pairs per stub), new TLC pass condition types in benchmark-utils, fixture + baseline JSON, and a CI gate job.

Purpose: Enables automated validation that the debug workflow can detect seeded algorithmic bugs and verify their fixes via TLC counterexample/verification.
Output: benchmarks/debug/ directory with fixtures and baseline, 6 TLA+ model pairs under .planning/formal/spec/debug-bench-*/, extended evaluatePassCondition, and CI gate job.
</objective>

<execution_context>
@./.claude/nf/workflows/execute-plan.md
@./.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/quick/403-add-nf-debug-benchmark-track-with-generi/scope-contract.json
@bin/nf-benchmark.cjs
@bin/benchmark-utils.cjs
@benchmarks/quick/fixtures.json
@benchmarks/quick/baseline.json
@.planning/formal/tla/NFSolveConvergence.tla
@.planning/formal/tla/MCaccount-manager.cfg
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create three buggy bench stubs</name>
  <files>
    bin/bench-buggy-sort.cjs
    bin/bench-buggy-filter.cjs
    bin/bench-buggy-counter.cjs
  </files>
  <action>
Create three CommonJS modules following the pattern of bin/bench-pure-util.cjs (use strict, exports only):

**bin/bench-buggy-sort.cjs**
```
'use strict';
// BUG: >= comparator swaps equal elements causing unstable unnecessary swaps
// Fix: change >= to >
function buggySort(arr) {
  const a = [...arr];
  for (let i = 0; i < a.length; i++)
    for (let j = i + 1; j < a.length; j++)
      if (a[i] >= a[j]) { const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}
module.exports = { buggySort };
```

**bin/bench-buggy-filter.cjs**
```
'use strict';
// BUG: > threshold excludes threshold value that should be included
// Fix: change > to >=
function buggyFilter(arr, threshold) {
  return arr.filter(function(x) { return x > threshold; });
}
module.exports = { buggyFilter };
```

**bin/bench-buggy-counter.cjs**
```
'use strict';
// BUG: < hi misses upper boundary element that should be counted
// Fix: change < hi to <= hi
function buggyCounter(arr, lo, hi) {
  return arr.filter(function(x) { return x >= lo && x < hi; }).length;
}
module.exports = { buggyCounter };
```

Verify that each stub loads without error and exports the expected function name (not the fix).
  </action>
  <verify>
    node -e "const m=require('./bin/bench-buggy-sort.cjs'); console.log(typeof m.buggySort)"
    node -e "const m=require('./bin/bench-buggy-filter.cjs'); console.log(typeof m.buggyFilter)"
    node -e "const m=require('./bin/bench-buggy-counter.cjs'); console.log(typeof m.buggyCounter)"
    All three should print "function".
    Also verify the bugs are present:
    node -e "const m=require('./bin/bench-buggy-sort.cjs'); const r=m.buggySort([1,1,2]); console.log(JSON.stringify(r))" — should complete without error (bug is logical, not a crash)
    node -e "const m=require('./bin/bench-buggy-filter.cjs'); const r=m.buggyFilter([3,4,5],4); console.log(r.length===1?'BUG_PRESENT':'UNEXPECTED')" — should print BUG_PRESENT (4 excluded)
    node -e "const m=require('./bin/bench-buggy-counter.cjs'); const r=m.buggyCounter([1,2,3],1,3); console.log(r===2?'BUG_PRESENT':'UNEXPECTED')" — should print BUG_PRESENT (3 excluded)
  </verify>
  <done>
    Three stub files exist. Each loads cleanly and exports exactly one named function. The bug in buggyFilter and buggyCounter is verifiable by a simple node -e call (threshold/boundary element missing from result).
  </done>
</task>

<task type="auto">
  <name>Task 2: Create six TLA+ model pairs for debug bench fixtures</name>
  <files>
    .planning/formal/spec/debug-bench-sort/bug.tla
    .planning/formal/spec/debug-bench-sort/bug.cfg
    .planning/formal/spec/debug-bench-sort/fix.tla
    .planning/formal/spec/debug-bench-sort/fix.cfg
    .planning/formal/spec/debug-bench-filter/bug.tla
    .planning/formal/spec/debug-bench-filter/bug.cfg
    .planning/formal/spec/debug-bench-filter/fix.tla
    .planning/formal/spec/debug-bench-filter/fix.cfg
    .planning/formal/spec/debug-bench-counter/bug.tla
    .planning/formal/spec/debug-bench-counter/bug.cfg
    .planning/formal/spec/debug-bench-counter/fix.tla
    .planning/formal/spec/debug-bench-counter/fix.cfg
  </files>
  <action>
Create directories and TLA+ model pairs. Keep state spaces tiny (2–3 values each dimension) for fast TLC execution. Follow the TLA+ style seen in .planning/formal/tla/NFSolveConvergence.tla: EXTENDS Integers TLC, VARIABLES, Init, Next, Spec, INVARIANT to violate.

Each bug.tla must have an invariant that the bug VIOLATES (so TLC finds a counterexample).
Each fix.tla must have the same invariant but the fixed behavior satisfies it (TLC passes).

---

**debug-bench-sort/bug.tla** — Models a 2-element comparison swap. State: a, b in 0..2, swapped BOOLEAN. The buggy comparator fires on equal elements (a >= b includes a=b). Property violated: NoUnnecessarySwap == ~(a = b /\ swapped = TRUE).

```tla
---- MODULE bug ----
EXTENDS Integers, TLC
VARIABLES a, b, swapped

Init == a \in {1, 2} /\ b \in {1, 2} /\ swapped = FALSE

\* Buggy comparator: fires when a >= b (includes equal)
Next == IF a >= b
        THEN /\ swapped' = TRUE
             /\ a' = b
             /\ b' = a
        ELSE /\ swapped' = FALSE
             /\ UNCHANGED <<a, b>>

Spec == Init /\ [][Next]_<<a, b, swapped>>

\* BUG: this invariant is violated because a=b=1 causes a swap
NoUnnecessarySwap == ~(a = b /\ swapped = TRUE)

====
```

**debug-bench-sort/bug.cfg**
```
SPECIFICATION Spec
INVARIANT NoUnnecessarySwap
```

**debug-bench-sort/fix.tla** — Same model but comparator uses a > b (strict), so equal elements never swap.

```tla
---- MODULE fix ----
EXTENDS Integers, TLC
VARIABLES a, b, swapped

Init == a \in {1, 2} /\ b \in {1, 2} /\ swapped = FALSE

\* Fixed comparator: only fires when a > b (strict)
Next == IF a > b
        THEN /\ swapped' = TRUE
             /\ a' = b
             /\ b' = a
        ELSE /\ swapped' = FALSE
             /\ UNCHANGED <<a, b>>

Spec == Init /\ [][Next]_<<a, b, swapped>>

NoUnnecessarySwap == ~(a = b /\ swapped = TRUE)

====
```

**debug-bench-sort/fix.cfg**
```
SPECIFICATION Spec
INVARIANT NoUnnecessarySwap
```

---

**debug-bench-filter/bug.tla** — Models a filter with threshold=4. State: x in {3,4,5}, result BOOLEAN (whether x is included). Buggy: includes x only if x > 4 (so x=4 excluded). Property violated: ThresholdIncluded == ~(x = 4 /\ result = FALSE).

Wait — that invariant says "it's not the case that x=4 AND result=FALSE". With the bug, when x=4 result=FALSE, so this is violated. Correct.

```tla
---- MODULE bug ----
EXTENDS Integers, TLC
VARIABLES x, result

Init == x \in {3, 4, 5} /\ result = FALSE

\* Buggy: includes only if x > 4, so x=4 is excluded (result stays FALSE)
Next == /\ result' = (x > 4)
        /\ UNCHANGED x

Spec == Init /\ [][Next]_<<x, result>>

\* BUG: when x=4, result=FALSE — threshold value excluded
ThresholdIncluded == ~(x = 4 /\ result = FALSE)

====
```

**debug-bench-filter/bug.cfg**
```
SPECIFICATION Spec
INVARIANT ThresholdIncluded
```

**debug-bench-filter/fix.tla** — Fixed: includes x if x >= 4. When x=4, result=TRUE. Invariant holds.

```tla
---- MODULE fix ----
EXTENDS Integers, TLC
VARIABLES x, result

Init == x \in {3, 4, 5} /\ result = FALSE

\* Fixed: includes if x >= 4, so x=4 is included
Next == /\ result' = (x >= 4)
        /\ UNCHANGED x

Spec == Init /\ [][Next]_<<x, result>>

ThresholdIncluded == ~(x = 4 /\ result = FALSE)

====
```

**debug-bench-filter/fix.cfg**
```
SPECIFICATION Spec
INVARIANT ThresholdIncluded
```

---

**debug-bench-counter/bug.tla** — Models a range counter with lo=1, hi=3. State: x in {1,2,3}, counted BOOLEAN. Buggy: counted = (x >= lo /\ x < hi), so x=3 (the hi boundary) is not counted. Property violated: BoundaryIncluded == ~(x = 3 /\ counted = FALSE).

```tla
---- MODULE bug ----
EXTENDS Integers, TLC
VARIABLES x, counted

CONSTANTS Lo, Hi

Init == x \in {1, 2, 3} /\ counted = FALSE

\* Buggy: x < Hi excludes the upper boundary element
Next == /\ counted' = (x >= Lo /\ x < Hi)
        /\ UNCHANGED x

Spec == Init /\ [][Next]_<<x, counted>>

\* BUG: x=Hi is not counted
BoundaryIncluded == ~(x = Hi /\ counted = FALSE)

====
```

**debug-bench-counter/bug.cfg**
```
SPECIFICATION Spec
CONSTANTS
    Lo = 1
    Hi = 3
INVARIANT BoundaryIncluded
```

**debug-bench-counter/fix.tla** — Fixed: x <= Hi includes the boundary.

```tla
---- MODULE fix ----
EXTENDS Integers, TLC
VARIABLES x, counted

CONSTANTS Lo, Hi

Init == x \in {1, 2, 3} /\ counted = FALSE

\* Fixed: x <= Hi includes the upper boundary
Next == /\ counted' = (x >= Lo /\ x <= Hi)
        /\ UNCHANGED x

Spec == Init /\ [][Next]_<<x, counted>>

BoundaryIncluded == ~(x = Hi /\ counted = FALSE)

====
```

**debug-bench-counter/fix.cfg**
```
SPECIFICATION Spec
CONSTANTS
    Lo = 1
    Hi = 3
INVARIANT BoundaryIncluded
```

Create the six directories and write all 12 files. The TLA+ syntax must be valid: module name in the file header must exactly match the filename without extension (e.g., `---- MODULE bug ----` for `bug.tla`).
  </action>
  <verify>
    ls .planning/formal/spec/debug-bench-sort/
    ls .planning/formal/spec/debug-bench-filter/
    ls .planning/formal/spec/debug-bench-counter/
    Each directory should contain: bug.tla, bug.cfg, fix.tla, fix.cfg.
    grep "MODULE bug" .planning/formal/spec/debug-bench-sort/bug.tla — confirms module name matches file.
    grep "MODULE fix" .planning/formal/spec/debug-bench-sort/fix.tla — confirms module name matches file.
    grep "NoUnnecessarySwap" .planning/formal/spec/debug-bench-sort/bug.tla — invariant present.
    grep "ThresholdIncluded" .planning/formal/spec/debug-bench-filter/bug.tla — invariant present.
    grep "BoundaryIncluded" .planning/formal/spec/debug-bench-counter/bug.tla — invariant present.
  </verify>
  <done>
    12 files exist (6 .tla + 6 .cfg) across 3 directories. Each bug.tla has an invariant that the buggy behavior violates. Each fix.tla has the same invariant that the fixed behavior satisfies. Module names match filenames.
  </done>
</task>

<task type="auto">
  <name>Task 3: Add TLC pass conditions, fixtures, baseline, CI gate job, and wire traces into result output</name>
  <files>
    bin/benchmark-utils.cjs
    bin/nf-benchmark.cjs
    benchmarks/debug/fixtures.json
    benchmarks/debug/baseline.json
    .github/workflows/benchmark-gate.yml
  </files>
  <action>
**1. Extend bin/benchmark-utils.cjs — add runTlcOnModel and two new pass conditions:**

Add after the existing `evaluatePassCondition` function (before the exports block):

```js
// ─────────────────────────────────────────────────────────────────────────────
// TLC runner for debug-bench pass conditions
// ─────────────────────────────────────────────────────────────────────────────

function runTlcOnModel(modelPath, cfgPath) {
  // Locate TLC jar: check standard nForma locations
  const tlcCandidates = [
    path.join(process.cwd(), 'bin', 'tla2tools.jar'),
    path.join(process.cwd(), '.planning', 'formal', 'tla2tools.jar'),
    path.join(process.env.HOME || '', '.tla', 'tla2tools.jar')
  ];
  const tlcJar = tlcCandidates.find(function(p) { return fs.existsSync(p); });

  if (!tlcJar) {
    return { exit_code: -1, output: 'tla2tools.jar not found', has_counterexample: false, traces: [] };
  }

  const result = spawnSync('java', ['-jar', tlcJar, '-config', cfgPath, modelPath], {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
    timeout: 30000
  });

  const output = (result.stdout || '') + (result.stderr || '');
  const lines = output.split('\n').filter(Boolean);
  // TLC prints "Error: Invariant X is violated" on counterexample
  const has_counterexample = output.includes('is violated') || output.includes('Error:') || result.status !== 0;

  return {
    exit_code: result.status,
    output: output,
    has_counterexample: has_counterexample,
    traces: lines.slice(0, 30)  // cap to 30 lines for JSON output
  };
}
```

Also add `const { spawnSync } = require('child_process');` at the top of the file if not already present (check first — it is NOT currently imported in benchmark-utils.cjs). Add it after the existing `const fs = require('fs');` line.

Then extend `evaluatePassCondition` to handle the two new condition types. Add these two branches BEFORE the fall-through comment `// Unknown condition`. Note: assign `fixture._traces` unconditionally (not guarded), so the runner can always read it back:

```js
  if (cond === 'tlc_counterexample_found') {
    // Pass if TLC finds a counterexample in the bug model
    const bugModel = path.resolve(process.cwd(), fixture.bug_model);
    const bugCfg = bugModel.replace(/\.tla$/, '.cfg');
    const tlcResult = runTlcOnModel(bugModel, bugCfg);
    fixture._traces = tlcResult.traces;  // always set so runner can include in output
    return tlcResult.has_counterexample;
  }
  if (cond === 'tlc_fix_verified') {
    // Pass if TLC finds NO counterexample in the fix model
    const fixModel = path.resolve(process.cwd(), fixture.fix_model);
    const fixCfg = fixModel.replace(/\.tla$/, '.cfg');
    const tlcResult = runTlcOnModel(fixModel, fixCfg);
    fixture._traces = tlcResult.traces;  // always set so runner can include in output
    return !tlcResult.has_counterexample;
  }
```

Export `runTlcOnModel` by adding it to the `module.exports` object.

**2. Patch bin/nf-benchmark.cjs — include traces in each result object:**

After `evaluatePassCondition` is called for a fixture, the runner builds a result object and pushes it to the `results` array. Locate the `results.push({...})` block inside the fixture loop (around line 184 in the current file). Add `traces: fixture._traces || []` to that object so TLC output lines are included in the final JSON.

The result push currently looks like:
```js
  results.push({
    id: fixture.id,
    label: fixture.label,
    passed: passed,
    skipped: false,
    skip_reason: null,
    exit_status: spawnResult.status,
    duration_ms: duration
  });
```

Change it to:
```js
  results.push({
    id: fixture.id,
    label: fixture.label,
    passed: passed,
    skipped: false,
    skip_reason: null,
    exit_status: spawnResult.status,
    duration_ms: duration,
    traces: fixture._traces || []
  });
```

This is the only change to nf-benchmark.cjs. Do not alter any other part of the file. The `fixture._traces` property is set by `evaluatePassCondition` (in benchmark-utils.cjs) during the pass condition evaluation that runs just before this push.

**3. Create benchmarks/debug/fixtures.json:**

Six fixtures — one tlc_counterexample_found and one tlc_fix_verified per stub. Each fixture sets `bug_model` or `fix_model` to the .tla path (relative to repo root).

```json
{
  "version": 1,
  "description": "nf:debug benchmark track — seeded defect detection via TLC",
  "fixtures": [
    {
      "id": "debug-sort-bug-counterexample",
      "label": "Sort off-by-one: TLC finds counterexample in bug model",
      "track": "full",
      "command": "node",
      "args": ["-e", "process.exit(0)"],
      "pass_condition": "tlc_counterexample_found",
      "bug_model": ".planning/formal/spec/debug-bench-sort/bug.tla",
      "env_required": []
    },
    {
      "id": "debug-sort-fix-verified",
      "label": "Sort off-by-one: TLC verifies fix model clean",
      "track": "full",
      "command": "node",
      "args": ["-e", "process.exit(0)"],
      "pass_condition": "tlc_fix_verified",
      "fix_model": ".planning/formal/spec/debug-bench-sort/fix.tla",
      "env_required": []
    },
    {
      "id": "debug-filter-bug-counterexample",
      "label": "Filter wrong predicate: TLC finds counterexample in bug model",
      "track": "full",
      "command": "node",
      "args": ["-e", "process.exit(0)"],
      "pass_condition": "tlc_counterexample_found",
      "bug_model": ".planning/formal/spec/debug-bench-filter/bug.tla",
      "env_required": []
    },
    {
      "id": "debug-filter-fix-verified",
      "label": "Filter wrong predicate: TLC verifies fix model clean",
      "track": "full",
      "command": "node",
      "args": ["-e", "process.exit(0)"],
      "pass_condition": "tlc_fix_verified",
      "fix_model": ".planning/formal/spec/debug-bench-filter/fix.tla",
      "env_required": []
    },
    {
      "id": "debug-counter-bug-counterexample",
      "label": "Counter boundary miss: TLC finds counterexample in bug model",
      "track": "full",
      "command": "node",
      "args": ["-e", "process.exit(0)"],
      "pass_condition": "tlc_counterexample_found",
      "bug_model": ".planning/formal/spec/debug-bench-counter/bug.tla",
      "env_required": []
    },
    {
      "id": "debug-counter-fix-verified",
      "label": "Counter boundary miss: TLC verifies fix model clean",
      "track": "full",
      "command": "node",
      "args": ["-e", "process.exit(0)"],
      "pass_condition": "tlc_fix_verified",
      "fix_model": ".planning/formal/spec/debug-bench-counter/fix.tla",
      "env_required": []
    }
  ]
}
```

NOTE on the `command`/`args` fields: `nf-benchmark.cjs` currently spawns the command/args and tries to parse stdout as JSON for pass condition evaluation. For TLC-based fixtures, the pass condition evaluation happens inside `evaluatePassCondition` using `fixture.bug_model`/`fixture.fix_model`, not from the spawned command's output. The `command: "node", args: ["-e", "process.exit(0)"]` is a no-op placeholder that exits 0 (the runner needs a valid command to spawn). The TLC invocation happens entirely within the extended `evaluatePassCondition`.

**4. Create benchmarks/debug/baseline.json:**

```json
{
  "pass_rate": 0,
  "updated_at": "2026-04-17",
  "note": "Debug track floor. Set to 0 initially — raise after TLC infrastructure confirmed available in CI."
}
```

Set to 0% initially because TLC (tla2tools.jar) may not be installed in CI yet. This lets the gate register without blocking. A follow-up task should raise the floor once TLC availability is confirmed.

**5. Add CI job to .github/workflows/benchmark-gate.yml:**

Append a new job `benchmark-debug` after `benchmark-quick`. It follows the exact same structure as `benchmark-quick` but runs the debug full track:

```yaml
  benchmark-debug:
    name: Debug full benchmark
    runs-on: ubuntu-latest
    timeout-minutes: 10
    needs: benchmark-quick
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
      - name: Run debug full benchmark
        run: |
          node bin/nf-benchmark.cjs --skill=debug --track=full --json > bench-debug-output.json 2>&1 || true
          cat bench-debug-output.json
      - name: Check score against baseline
        run: node scripts/check-benchmark-gate.cjs bench-debug-output.json benchmarks/debug/baseline.json
```

When editing benchmark-gate.yml, preserve all existing job formatting and indentation (2-space YAML). The new job must be appended at the end of the `jobs:` block, after `benchmark-quick`.
  </action>
  <verify>
    # Verify fixture file is valid JSON
    node -e "JSON.parse(require('fs').readFileSync('benchmarks/debug/fixtures.json','utf8')); console.log('fixtures OK')"
    # Verify baseline is valid JSON
    node -e "JSON.parse(require('fs').readFileSync('benchmarks/debug/baseline.json','utf8')); console.log('baseline OK')"
    # Verify benchmark-utils exports runTlcOnModel
    node -e "const m=require('./bin/benchmark-utils.cjs'); console.log(typeof m.runTlcOnModel)"
    # Should print "function"
    # Verify evaluatePassCondition sets fixture._traces unconditionally
    node -e "const {evaluatePassCondition}=require('./bin/benchmark-utils.cjs'); const f={pass_condition:'tlc_counterexample_found',bug_model:'.planning/formal/spec/debug-bench-sort/bug.tla'}; evaluatePassCondition(f,{status:0},{},-1); console.log(Array.isArray(f._traces)?'traces_array':'MISSING')"
    # Should print "traces_array"
    # Verify nf-benchmark.cjs result push includes traces field
    grep "fixture\._traces" bin/nf-benchmark.cjs
    # Should match at least one line in the results.push block
    # Verify CI job added to benchmark-gate.yml
    grep "benchmark-debug" .github/workflows/benchmark-gate.yml
    grep "skill=debug" .github/workflows/benchmark-gate.yml
    # Verify dry-run of debug track
    node bin/nf-benchmark.cjs --skill=debug --track=full --dry-run
    # Should list 6 fixtures without error
  </verify>
  <done>
    benchmarks/debug/fixtures.json has 6 fixtures with valid JSON. benchmarks/debug/baseline.json exists. benchmark-utils.cjs exports runTlcOnModel and evaluatePassCondition sets fixture._traces unconditionally for tlc_counterexample_found and tlc_fix_verified. bin/nf-benchmark.cjs result push includes traces: fixture._traces || []. .github/workflows/benchmark-gate.yml contains benchmark-debug job. Dry-run lists all 6 fixtures.
  </done>
</task>

</tasks>

<verification>
After all tasks complete:

1. Stub exports verified: all three buggy functions load and exhibit the intended bug behavior.
2. TLA+ files verified: 12 files across 3 directories, module names match filenames, invariants present.
3. Fixture JSON loads cleanly, 6 fixtures present, all have correct pass_condition values.
4. benchmark-utils.cjs exports runTlcOnModel, evaluatePassCondition handles both new condition types and sets fixture._traces unconditionally.
5. nf-benchmark.cjs result push includes traces: fixture._traces || [] — verify with grep "fixture\._traces" bin/nf-benchmark.cjs.
6. Dry-run: node bin/nf-benchmark.cjs --skill=debug --track=full --dry-run lists 6 fixtures.
7. CI gate YAML contains benchmark-debug job with correct skill and baseline path.
</verification>

<success_criteria>
- node bin/nf-benchmark.cjs --skill=debug --track=full --dry-run exits 0 and lists 6 fixture IDs
- bin/benchmark-utils.cjs exports runTlcOnModel (typeof === 'function')
- evaluatePassCondition sets fixture._traces as an array for tlc_counterexample_found and tlc_fix_verified inputs
- bin/nf-benchmark.cjs result push includes traces: fixture._traces || [] (grep confirms)
- All 12 TLA+ files exist with correct MODULE names and invariant declarations
- .github/workflows/benchmark-gate.yml contains benchmark-debug job
- benchmarks/debug/baseline.json exists with pass_rate: 0 (safe floor pending TLC CI availability)
</success_criteria>

<output>
After completion, create `.planning/quick/403-add-nf-debug-benchmark-track-with-generi/403-SUMMARY.md`
</output>

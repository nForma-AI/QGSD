---
phase: quick-398
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/nf-benchmark-solve.cjs
  - .planning/formal/solve-benchmark-fixtures.json
autonomous: true
requirements:
  - SOLVE-11
formal_artifacts:
  update:
    - .planning/formal/solve-benchmark-fixtures.json

must_haves:
  truths:
    - "Running `node bin/nf-benchmark-solve.cjs` executes both Track A (smoke) and Track B (autonomy) fixtures and reports a combined pass/fail"
    - "Track B fixtures snapshot `.planning/formal/` JSON files before seeding a defect, run nf-solve without --report-only, score residual change, then restore the snapshot unconditionally (even on error)"
    - "An autonomy fixture passes when the f_to_t layer residual decreases from its seeded value to its post-remediation value (post < pre)"
    - "The `.planning/formal/` files are byte-identical to their pre-test state after any autonomy fixture run"
  artifacts:
    - path: "bin/nf-benchmark-solve.cjs"
      provides: "Benchmark runner with snapshot/restore logic and autonomy fixture support"
      contains: "snapshotFormalJson|restoreFormalJson|autonomy_fixtures"
    - path: ".planning/formal/solve-benchmark-fixtures.json"
      provides: "Fixture set with autonomy_fixtures array"
      contains: "autonomy_fixtures"
  key_links:
    - from: "bin/nf-benchmark-solve.cjs"
      to: ".planning/formal/solve-benchmark-fixtures.json"
      via: "fixtureData.autonomy_fixtures"
      pattern: "autonomy_fixtures"
    - from: "autonomy fixture runner"
      to: ".planning/formal/*.json"
      via: "snapshot/restore"
      pattern: "snapshotFormalJson|restoreFormalJson"
---

<objective>
Add Track B (autonomy) to the nf:solve benchmark: seed a synthetic defect into `.planning/formal/` JSON files, run nf-solve without `--report-only` to trigger real remediation, score whether the target layer residual decreased, then restore all snapshotted files. This proves nf:solve can actually close gaps, not just detect them.

Purpose: Track A (smoke) verifies nf-solve doesn't crash. Track B verifies nf-solve's autoClose actually reduces residual when given a closeable gap — turning the benchmark into a real autonomy validator.

Output: Updated `bin/nf-benchmark-solve.cjs` with snapshot/restore logic + autonomy runner; updated `solve-benchmark-fixtures.json` with `autonomy_fixtures` array containing 1-2 fixtures targeting the f_to_t layer.
</objective>

<execution_context>
@./.claude/nf/workflows/execute-plan.md
@./.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/398-improve-the-benchmark-to-actually-test-n/398-PLAN.md
@bin/nf-benchmark-solve.cjs
@.planning/formal/solve-benchmark-fixtures.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add snapshot/restore helpers and autonomy runner to nf-benchmark-solve.cjs</name>
  <files>bin/nf-benchmark-solve.cjs</files>
  <action>
Add three capabilities to `bin/nf-benchmark-solve.cjs`. All new code must follow existing style: CommonJS, `'use strict'`, fail-open with try/catch, `spawnSync` for subprocesses.

**1. Snapshot/restore helpers**

After the existing `extractResidual` function, add:

```js
// ── Track B: snapshot/restore helpers ───────────────────────────────────────

const FORMAL_DIR = path.join(ROOT, '.planning', 'formal');

function snapshotFormalJson() {
  // Capture all .json files in .planning/formal/ (non-recursive — top-level only)
  const snap = {};
  try {
    const entries = fs.readdirSync(FORMAL_DIR);
    for (const entry of entries) {
      if (!entry.endsWith('.json')) continue;
      const fullPath = path.join(FORMAL_DIR, entry);
      try {
        snap[fullPath] = fs.readFileSync(fullPath, 'utf8');
      } catch (_) { /* skip unreadable files fail-open */ }
    }
  } catch (_) { /* fail-open: if formal dir unreadable, return empty snap */ }
  return snap;
}

function restoreFormalJson(snap) {
  // Restore every file captured in the snapshot to its original content.
  // Called unconditionally (even after errors) to guarantee clean state.
  for (const [fullPath, content] of Object.entries(snap)) {
    try {
      fs.writeFileSync(fullPath, content, 'utf8');
    } catch (_) { /* fail-open: log to stderr, don't throw */ 
      process.stderr.write('WARN: could not restore ' + fullPath + '\n');
    }
  }
}
```

**2. Autonomy fixture runner**

After the existing main loop (`for (const fixture of fixtures)`), add a new section that runs `fixtureData.autonomy_fixtures` if present. Use the `--track` CLI arg to let callers run only smoke (`--track=smoke`) or only autonomy (`--track=autonomy`), defaulting to both.

Parse `--track`:
```js
const trackArg = args.find(a => a.startsWith('--track='));
const track = trackArg ? trackArg.slice('--track='.length) : 'all';
const runSmoke = track === 'all' || track === 'smoke';
const runAutonomy = track === 'all' || track === 'autonomy';
```

Guard the existing smoke loop with `if (runSmoke) { ... }`.

For the autonomy loop (only runs when `runAutonomy` is true and `fixtureData.autonomy_fixtures` is a non-empty array):

```
for each autonomy_fixture:
  1. snap = snapshotFormalJson()
  2. Apply the fixture's seed_mutation:
     - Read the target file (seed_mutation.file)
     - Apply the mutation described by seed_mutation.type:
       - type "set_field": set seed_mutation.field to seed_mutation.value in the parsed JSON and write back
       - type "remove_key": delete seed_mutation.key from the top-level object and write back
     - Record pre_residual by parsing seed_mutation.pre_residual_field from the mutated file if provided, or -1
  3. Run nf-solve with autonomy_fixture.args (no --report-only), capturing JSON output
  4. Parse stdout as JSON; extract post_residual for seed_mutation.target_layer using extractResidual
     (also check parsed.iterations last entry's residuals[target_layer] directly for per-layer value)
  5. Evaluate pass_condition:
     - "residual_decreased": post_layer_residual < pre_layer_residual (where pre is determined by running nf-solve --report-only --json before mutation to get baseline, minus seeded amount — see fixture field `seeded_delta`)
     - "exits_zero": result.status === 0
     - "converged": parsed.converged === true
  6. restoreFormalJson(snap)  ← unconditional, inside finally block
  7. Record result
```

Per-layer residual extraction helper (add after `extractResidual`):
```js
function extractLayerResidual(parsed, layer) {
  if (!parsed || typeof parsed !== 'object') return -1;
  if (Array.isArray(parsed.iterations) && parsed.iterations.length > 0) {
    const last = parsed.iterations[parsed.iterations.length - 1];
    if (last && last.residuals && typeof last.residuals[layer] === 'object') {
      const v = last.residuals[layer];
      return typeof v.residual === 'number' ? v.residual : -1;
    }
    if (last && last.residuals && typeof last.residuals[layer] === 'number') {
      return last.residuals[layer];
    }
  }
  return -1;
}
```

For `residual_decreased` pass condition evaluation:
- The fixture includes `seeded_delta` (integer: how many units were artificially added by the mutation)
- Before the mutation, run nf-solve with `['--report-only', '--json', '--no-timeout', '--max-iterations=1', '--fast']` to get `baseline_residual[target_layer]`
- `pre_residual = baseline_residual + seeded_delta` (expected residual after seeding)
- After running with autonomy args (no --report-only), compare `post_layer_residual < pre_residual`

NOTE: Use `--report-only` for the baseline measurement so it does NOT mutate files.

Wrap the entire autonomy fixture execution (steps 1-7) in try/finally to guarantee restore:
```js
const snap = snapshotFormalJson();
try {
  // ... mutation + run + score ...
} finally {
  restoreFormalJson(snap);
}
```

**3. Combined summary output**

After both loops, merge autonomy results into the summary. Report autonomy results separately in non-JSON mode:
```
── Track B: autonomy ──────────────────
  [PASS] seed-f2t-stub-gap: residual decreased 13→12  duration=8240ms
────────────────────────────────────────
Autonomy: 1/1 passed (100%)
```

In JSON mode, include `autonomy_results` array alongside `results` in the output object.

The exit code should be non-zero if ANY fixture (smoke or autonomy) fails.

Update the usage comment at the top of the file to document:
- `--track=smoke` / `--track=autonomy` / `--track=all` (default)
</action>
  <verify>
node bin/nf-benchmark-solve.cjs --dry-run --track=smoke 2>/dev/null | grep -c "dry-run"
# expect: at least 1 line (existing smoke fixtures listed)

node bin/nf-benchmark-solve.cjs --dry-run --track=autonomy 2>/dev/null
# expect: lists autonomy fixture(s) or "no autonomy fixtures" if array is empty

node bin/nf-benchmark-solve.cjs --json --track=smoke 2>/dev/null | node << 'NF_EVAL'
const d = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
console.log('smoke total:', d.total, 'has autonomy_results:', 'autonomy_results' in d);
NF_EVAL
# expect: smoke total >= 6, has autonomy_results: false (or true if autonomy also ran)
  </verify>
  <done>
- `snapshotFormalJson` and `restoreFormalJson` functions exist in nf-benchmark-solve.cjs
- `--track=smoke` runs only existing fixtures and exits zero
- `--track=autonomy` parses `fixtureData.autonomy_fixtures` (even if empty array)
- `--json` output includes `autonomy_results` key when autonomy track ran
- No `.planning/formal/*.json` file is modified after the runner completes (snapshot restored)
  </done>
</task>

<task type="auto">
  <name>Task 2: Add autonomy_fixtures to solve-benchmark-fixtures.json and run end-to-end</name>
  <files>.planning/formal/solve-benchmark-fixtures.json</files>
  <action>
Add an `autonomy_fixtures` array to `.planning/formal/solve-benchmark-fixtures.json`. Use the `f_to_t` layer as the target because `autoClose` in nf-solve DOES auto-generate test stubs for f_to_t gaps via `bin/formal-test-sync.cjs` (unlike r_to_f which only logs). This guarantees residual can actually decrease.

The seed mutation strategy for f_to_t:
- `unit-test-coverage.json` tracks requirement→test coverage
- Remove the `covered: true` entry for one requirement by setting it to `{ "covered": false, "test_cases": [] }` — this creates a synthetic uncovered requirement
- After nf-solve runs (no --report-only), `formal-test-sync.cjs` is called by autoClose and regenerates the stub, restoring coverage
- The f_to_t residual decreases from (baseline + 1) back toward baseline

Add these fixtures to the JSON file:

```json
{
  "version": 1,
  "description": "nf:solve benchmark fixture set",
  "fixtures": [
    ... existing smoke fixtures unchanged ...
  ],
  "autonomy_fixtures": [
    {
      "id": "seed-f2t-uncover-ACT-01",
      "label": "Seed f_to_t gap by marking ACT-01 uncovered — verify nf-solve auto-generates stub",
      "args": ["--json", "--no-timeout", "--max-iterations=1", "--fast"],
      "seed_mutation": {
        "type": "set_field",
        "file": ".planning/formal/unit-test-coverage.json",
        "field": "requirements.ACT-01",
        "value": { "covered": false, "test_cases": [] },
        "target_layer": "f_to_t",
        "seeded_delta": 1
      },
      "pass_condition": "residual_decreased"
    }
  ]
}
```

Note: `ACT-01` is a covered requirement (confirmed by reading unit-test-coverage.json — all ACT-* entries are `covered: true`). Marking it `covered: false` increases f_to_t residual by exactly 1.

The `set_field` mutation uses dot-notation (`requirements.ACT-01`) — the runner must handle nested dot-notation when applying the mutation. Implement `setNestedField(obj, dotPath, value)` helper in the runner:
```js
function setNestedField(obj, dotPath, value) {
  const parts = dotPath.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur[parts[i]] === undefined) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}
```

Pre-flight check in the runner: before applying seed mutation, verify the target file exists. If not, mark fixture as SKIP with reason "seed target file missing" (not FAIL — environment may differ).

After writing the fixture JSON, run the full benchmark to confirm Track A still passes and Track B executes:

```bash
node bin/nf-benchmark-solve.cjs --track=smoke
# expect: all 6 smoke fixtures pass, exits zero

node bin/nf-benchmark-solve.cjs --track=autonomy --verbose
# observe: snapshot taken, mutation applied, nf-solve runs, restore happens
# result: PASS or SKIP (never FAIL due to missing dependency)
```

If the autonomy fixture fails on this codebase because formal-test-sync.cjs doesn't reduce f_to_t residual in a single fast iteration, that is acceptable — the infrastructure is correct. Document in the fixture label if the expected behavior requires more than 1 iteration. The benchmark itself remains informative even if the fixture result is FAIL (it proves the round-trip executes).
  </action>
  <verify>
node << 'NF_EVAL'
const d = JSON.parse(require('fs').readFileSync('/Users/jonathanborduas/code/QGSD/.planning/formal/solve-benchmark-fixtures.json', 'utf8'));
console.log('smoke fixtures:', d.fixtures.length);
console.log('autonomy fixtures:', d.autonomy_fixtures ? d.autonomy_fixtures.length : 0);
if (d.autonomy_fixtures && d.autonomy_fixtures.length > 0) {
  console.log('first autonomy id:', d.autonomy_fixtures[0].id);
  console.log('target_layer:', d.autonomy_fixtures[0].seed_mutation.target_layer);
}
NF_EVAL
# expect: smoke fixtures: 6, autonomy fixtures: 1, target_layer: f_to_t

node bin/nf-benchmark-solve.cjs --track=smoke --json 2>/dev/null | node << 'NF_EVAL'
const d = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
console.log('passed:', d.passed, '/', d.total, 'rate:', d.pass_rate + '%');
NF_EVAL
# expect: passed: 6 / 6 rate: 100%

# Verify snapshot/restore works — formal dir files are unchanged after autonomy run
node << 'NF_EVAL'
const fs = require('fs');
const before = fs.readFileSync('/Users/jonathanborduas/code/QGSD/.planning/formal/unit-test-coverage.json', 'utf8');
console.log('ACT-01 covered before:', JSON.parse(before).requirements['ACT-01'].covered);
NF_EVAL
# expect: ACT-01 covered before: true (restored to original after any previous run)
  </verify>
  <done>
- `solve-benchmark-fixtures.json` has `autonomy_fixtures` array with at least 1 entry
- First autonomy fixture targets f_to_t layer with seed_mutation on unit-test-coverage.json
- `node bin/nf-benchmark-solve.cjs --track=smoke` exits 0 with all 6 smoke fixtures passing
- `node bin/nf-benchmark-solve.cjs --track=autonomy` completes without error and leaves unit-test-coverage.json byte-identical to its state before the run
- `node bin/nf-benchmark-solve.cjs --json` (all tracks) produces JSON with both `results` and `autonomy_results` keys
  </done>
</task>

</tasks>

<verification>
1. Smoke track unaffected: `node bin/nf-benchmark-solve.cjs --track=smoke` exits 0, all 6 pass
2. Autonomy track runs end-to-end: `node bin/nf-benchmark-solve.cjs --track=autonomy --verbose` completes and logs snapshot/restore actions to stderr
3. Snapshot integrity: `unit-test-coverage.json` ACT-01 entry is `covered: true` after any autonomy run
4. JSON output: `--json` flag produces valid JSON with `autonomy_results` array
5. No formal files mutated: `git diff .planning/formal/` shows no changes after running the full benchmark
</verification>

<success_criteria>
- Track A (smoke) continues to work exactly as before
- Track B (autonomy) adds a real mutation → nf-solve run → residual comparison → restore cycle
- The snapshot/restore is unconditional (try/finally) so formal files are always left clean
- The benchmark can be invoked with `--track=smoke`, `--track=autonomy`, or `--track=all` (default)
- JSON output separates smoke `results` from `autonomy_results` for downstream tooling
</success_criteria>

<output>
After completion, create `.planning/quick/398-improve-the-benchmark-to-actually-test-n/398-SUMMARY.md`
</output>

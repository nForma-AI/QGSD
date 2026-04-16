---
phase: quick-401
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/nf-solve.cjs
  - bin/solve-benchmark-fixtures.json
autonomous: true
requirements: [BENCH-DETECT-01, BENCH-DETECT-02, BENCH-DETECT-03]
formal_artifacts: none

must_haves:
  truths:
    - "cross-layer-alignment challenges detect layer mutations (l1_to_l3 and l3_to_tc residuals are non-(-1) in fast mode)"
    - "formal_lint residual is non-(-1) in fast mode so multi-layer formal_lint-targeted challenges can detect mutations"
    - "documentation challenges detect d_to_c or d_to_r residual increases when benchmark injects a broken doc claim"
    - "multi-layer r_to_f-targeted challenges detect residual increase after requirements.json mutation"
    - "benchmark overall pass rate reaches >=35% (up from 20.4%)"
  artifacts:
    - path: "bin/nf-solve.cjs"
      provides: "nf-solve with fast-mode guards removed from sweepL1toL3, sweepL3toTC, sweepFormalLint + d_to_c claim-injection detection"
      contains: "sweepL1toL3"
  key_links:
    - from: "computeResidual (line 4509)"
      to: "sweepL1toL3"
      via: "effectiveFastMode() guard in computeResidual must be removed"
      pattern: "effectiveFastMode.*sweepL1toL3"
    - from: "computeResidual (line 4513)"
      to: "sweepL3toTC"
      via: "effectiveFastMode() guard in computeResidual must be removed"
      pattern: "effectiveFastMode.*sweepL3toTC"
    - from: "sweepFormalLint (line 3729)"
      to: "lint-formal-models.cjs"
      via: "fastMode guard blocks spawn in fast mode"
      pattern: "if.*fastMode.*return.*residual.*-1"
---

<objective>
Fix nf-solve benchmark detection gaps across three 0%-scoring categories — documentation (0/16), cross-layer-alignment (0/11), and multi-layer (0/10) — to raise the overall benchmark pass rate from 20.4% to >=35%.

Purpose: Benchmark CI validates nf-solve's ability to detect mutations. Three categories score 0% due to systematic detection blind spots: layer sweeps bailed early in --fast mode, and doc mutation sensitivity gaps.

Output: Modified bin/nf-solve.cjs that removes fast-mode early-exit guards from sweepL1toL3, sweepL3toTC, sweepFormalLint, and adds a file-hash sentinel path to d_to_c to detect when doc files are externally modified.
</objective>

<execution_context>
@./.claude/nf/workflows/execute-plan.md
@./.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

# Confirmed diagnosis from actual nf-solve --fast run:
# residual_vector emitted: d_to_c=96, d_to_r=3, l1_to_l3=-1, l3_to_tc=-1, formal_lint=-1
#
# Root cause 1: cross-layer-alignment (l1_to_l2, l2_to_l3)
#   - Benchmark LAYER_ALIASES: l1_to_l2 -> l1_to_l3, l2_to_l3 -> l3_to_tc
#   - sweepL1toL3 (line 3402) and sweepL3toTC (line 3440) both bail with residual=-1 if fastMode
#   - computeResidual (line 4509-4514) also applies effectiveFastMode() guard, skipping these sweeps entirely
#   - Both sweeps are pure file reads via getAggregateGates() -- no slow operations
#   - Fix: remove effectiveFastMode() guard in computeResidual AND remove fastMode check inside sweep functions
#
# Root cause 2: formal_lint (multi-layer challenges BENCH-225, BENCH-226, BENCH-228)
#   - sweepFormalLint (line 3728) bails with residual=-1 if fastMode
#   - formal_lint is NOT gated in computeResidual (line 4550 calls it unconditionally)
#   - Fix: remove fastMode guard inside sweepFormalLint (line 3729-3731)
#   - NOTE: sweepFormalLint spawns lint-formal-models.cjs and check-liveness-fairness.cjs
#     These are fast operations (static analysis, no network). Safe to enable in fast mode.
#
# Root cause 3: documentation (d_to_c, d_to_r)
#   - benchmark file-modify mutation appends "\n// modified by benchmark" to docs files
#   - sweepDtoC looks for broken command references and stale structural claims -- a trivial
#     append does NOT create a new broken claim, so d_to_c residual stays at 96
#   - sweepDtoR looks for requirements not mentioned in docs -- a trivial append does NOT
#     remove requirement mentions, so d_to_r stays at 3
#   - Fix: add a sentinel detection path in sweepDtoC: if any doc file has been modified
#     more recently than the formal/.planning/state timestamp, flag a "doc-freshness" gap
#   - Better fix: d_to_c should scan for known broken patterns injected by the mutator.
#     The benchmark's file-modify appends "// modified by benchmark" comment. Add a
#     claim-injection detector: if a doc file mentions "nf:bench-analyze" (a non-existent
#     command), sweepDtoC should detect it as a broken claim.
#   - Actual fix: modify sweepDtoC to detect explicit "nf:bench-" prefixed commands in docs
#     that have no backing in package.json scripts or known command registry
#   - Better actual fix: check BENCH-051 challenge description -- it says "Add reference to
#     nf:bench-analyze command that doesn't exist". The d_to_c sweep already scans for
#     command claims but may not scan for nf: slash-commands specifically.
#   - Add nf: slash-command existence check to sweepDtoC: scan docs for `/nf:*` command
#     patterns and verify each against commands/ directory entries.

@bin/nf-solve.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remove fast-mode guards from cross-layer sweeps and formal_lint</name>
  <files>bin/nf-solve.cjs</files>
  <action>
Three targeted changes to bin/nf-solve.cjs, all within the fast-mode guard removal scope:

**Change 1: sweepL1toL3 (line ~3403) — remove fastMode early-exit**
Replace:
```js
function sweepL1toL3() {
  if (fastMode) {
    return { residual: -1, detail: { skipped: true, reason: 'fast mode' } };
  }
```
With:
```js
function sweepL1toL3() {
  // Note: fastMode guard removed — getAggregateGates() is a lightweight file read,
  // not a slow operation. Required for benchmark detection of cross-layer mutations.
```
(Keep the rest of the function unchanged.)

**Change 2: sweepL3toTC (line ~3441) — remove fastMode early-exit**
Replace:
```js
function sweepL3toTC() {
  if (fastMode) {
    return { residual: -1, detail: { skipped: true, reason: 'fast mode' } };
  }
```
With:
```js
function sweepL3toTC() {
  // Note: fastMode guard removed — getAggregateGates() is a lightweight file read.
  // Required for benchmark detection of cross-layer mutations.
```
(Keep the rest of the function unchanged. The `!reportOnly` guard inside for `spawnTool('bin/test-recipe-gen.cjs')` stays in place — no writes in fast+report-only mode.)

**Change 3: computeResidual (line ~4509) — remove effectiveFastMode() guard for l1_to_l3 and l3_to_tc**
Replace:
```js
  const l1_to_l3 = checkLayerSkip('l1_to_l3') || (effectiveFastMode() || pastDeadline() ? skipLayer : sweepL1toL3());
```
With:
```js
  const l1_to_l3 = checkLayerSkip('l1_to_l3') || (pastDeadline() ? skipLayer : sweepL1toL3());
```
Replace:
```js
  const l3_to_tc = checkLayerSkip('l3_to_tc') || (effectiveFastMode() || pastDeadline() ? skipLayer : sweepL3toTC());
```
With:
```js
  const l3_to_tc = checkLayerSkip('l3_to_tc') || (pastDeadline() ? skipLayer : sweepL3toTC());
```

**Change 4: sweepFormalLint (line ~3729) — remove fastMode early-exit**
Replace:
```js
function sweepFormalLint() {
  if (fastMode) {
    return { residual: -1, detail: { skipped: true, reason: 'fast mode' } };
  }
```
With:
```js
function sweepFormalLint() {
  // Note: fastMode guard removed — lint-formal-models.cjs is static analysis (fast).
  // Required for benchmark detection of formal model mutation in multi-layer challenges.
```
(Keep the rest of the function unchanged.)

IMPORTANT: Do NOT touch sweepPerModelGates fastMode guard — per_model_gates spawns
compute-per-model-gates.cjs which writes files and is expensive. Leave it guarded.

Also do NOT change the per_model_gates computeResidual guard at line ~4518.
  </action>
  <verify>
Run nf-solve in fast+report-only mode and confirm l1_to_l3, l3_to_tc, formal_lint now emit non-(-1) residuals:

```bash
node bin/nf-solve.cjs --report-only --json --fast --no-timeout --max-iterations=1 --skip-heatmap --skip-proximity --no-auto-commit --no-coderlm 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
rv=d.get('residual_vector',{})
for k in ['l1_to_l3','l3_to_tc','formal_lint']:
    v=rv.get(k,{})
    r=v.get('residual',-99) if isinstance(v,dict) else v
    status='OK' if r != -1 else 'STILL SKIPPED'
    print(f'{k}: residual={r} [{status}]')
"
```

All three must show residual != -1.

Also verify exits zero:
```bash
node bin/nf-solve.cjs --report-only --json --fast --no-timeout --max-iterations=1 --skip-heatmap --skip-proximity --no-auto-commit --no-coderlm 2>/dev/null; echo "exit=$?"
```
  </verify>
  <done>
- l1_to_l3 residual is a numeric value >= 0 (not -1) in fast mode
- l3_to_tc residual is a numeric value >= 0 (not -1) in fast mode
- formal_lint residual is a numeric value >= 0 (not -1) in fast mode
- nf-solve exits 0 with --fast --report-only
- per_model_gates residual is still -1 in fast mode (unchanged)
  </done>
</task>

<task type="auto">
  <name>Task 2: Add nf: slash-command existence check to sweepDtoC for documentation detection</name>
  <files>bin/nf-solve.cjs</files>
  <action>
The benchmark's documentation challenges (BENCH-051 through BENCH-066) inject mutations like
"Add reference to nf:bench-analyze command that doesn't exist" into doc files. The current
sweepDtoC does not scan for `/nf:*` slash-command references in docs and verify their existence
against the commands registry. This causes 0/16 detection rate.

In sweepDtoC (starting at line ~1963), after the existing broken-claim scanning loop but before
the weighted-residual computation block (the `for (const bc of brokenClaims)` loop at line ~2296),
add a new ghost-command detection block:

**Add nf: slash-command scan to sweepDtoC:**

Locate the line `// Weighted residual: user-facing broken claims count more` (line ~2293) and
insert the following block immediately before it:

```js
  // Scan docs for /nf: slash-command references and verify existence
  // (handles benchmark mutations that inject references to non-existent commands)
  {
    const nfCommandsDir = path.join(ROOT, 'commands');
    const nfCommandPattern = /\/nf:([a-zA-Z0-9_-]+)/g;
    let ghostCommands = 0;
    if (fs.existsSync(nfCommandsDir)) {
      // Build set of known command names from commands/ directory
      const knownCommands = new Set();
      try {
        const walkCommands = (dir) => {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isDirectory()) walkCommands(path.join(dir, entry.name));
            else if (entry.name.endsWith('.md')) {
              const stem = entry.name.replace(/\.md$/, '');
              knownCommands.add(stem);
            }
          }
        };
        walkCommands(nfCommandsDir);
      } catch (_) { /* fail-open */ }

      // Scan all doc files for /nf: references
      for (const { absPath, category } of docFiles) {
        const nfCmdContent = (() => {
          try { return fs.readFileSync(absPath, 'utf8'); } catch (_) { return ''; }
        })();
        let m;
        nfCommandPattern.lastIndex = 0;
        while ((m = nfCommandPattern.exec(nfCmdContent)) !== null) {
          const cmdName = m[1];
          if (!knownCommands.has(cmdName)) {
            ghostCommands++;
            brokenClaims.push({
              doc_file: path.relative(ROOT, absPath),
              line: null,
              type: 'ghost_command',
              value: '/nf:' + cmdName,
              reason: 'nf: command not found in commands/ directory',
              category,
              weight: CATEGORY_WEIGHT[category] || 1,
            });
          }
        }
      }
    }
  }
```

IMPORTANT: The variable used by sweepDtoC is `brokenClaims` (initialized at line ~2084 as
`const brokenClaims = [];`). Append ghost-command entries directly to `brokenClaims` — the
weighted-residual loop at line ~2296 will pick them up automatically via each entry's `weight`
field and include them in `Math.ceil(weightedResidual)`. No changes to the return statement
are needed.

Also add `ghost_commands` to the detail object in the return statement at line ~2352:
```js
      ghost_commands: ghostCommands,  // add after suppressed_fp_count
```
To do this: declare `let ghostCommandCount = 0;` before the ghost-command block, accumulate
`ghostCommandCount += ghostCommands;` inside the block, and then reference it in the detail.
  </action>
  <verify>
1. Verify the ghost-command detection works by checking the commands/ directory exists and the scan logic compiles:
```bash
node << 'NF_EVAL'
const fs = require('fs');
const path = require('path');
const ROOT = process.cwd();
const nfCommandsDir = path.join(ROOT, 'commands');
const exists = fs.existsSync(nfCommandsDir);
console.log('commands/ dir exists:', exists);
if (exists) {
  const entries = fs.readdirSync(nfCommandsDir, { withFileTypes: true });
  console.log('commands/ entries:', entries.map(e => e.name).slice(0, 5));
}
NF_EVAL
```

2. Run nf-solve and check that d_to_c still exits without error:
```bash
node bin/nf-solve.cjs --report-only --json --fast --no-timeout --max-iterations=1 --skip-heatmap --skip-proximity --no-auto-commit --no-coderlm 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
rv=d.get('residual_vector',{})
dtoc=rv.get('d_to_c',{})
r=dtoc.get('residual',-99) if isinstance(dtoc,dict) else dtoc
print('d_to_c residual:', r)
print('exit check: JSON parsed OK')
"
```

3. Run all existing benchmark smoke tests to confirm no regression:
```bash
node bin/nf-benchmark-solve.cjs --track=smoke 2>/dev/null; echo "exit=$?"
```
Smoke track must pass 6/6 (or same as before).
  </verify>
  <done>
- nf-solve exits 0 in fast+report-only mode after changes
- d_to_c residual is a non-negative integer (no parse errors from ghost-command block)
- Smoke track: 6/6 passed (no regression)
- Ghost-command scan logs appear in d_to_c detail when /nf: commands are mentioned in docs
  </done>
</task>

<task type="auto">
  <name>Task 3: Verify benchmark detection lift and update solve-benchmark-fixtures.json baseline assertions</name>
  <files>bin/solve-benchmark-fixtures.json</files>
  <action>
After the nf-solve.cjs changes in Tasks 1-2, run a diagnostic to measure actual benchmark
improvement by testing key representative challenges from the 0% categories.

**Step 1: Run nf-solve with benchmark flags and check actual residual_vector.**

```bash
node bin/nf-solve.cjs --report-only --json --fast --no-timeout --max-iterations=1 --skip-heatmap --skip-proximity --no-auto-commit --no-coderlm 2>/dev/null > /tmp/nf-solve-baseline.json
```

Inspect the output to confirm:
- `l1_to_l3.residual` >= 0
- `l3_to_tc.residual` >= 0
- `formal_lint.residual` >= 0
- `d_to_c.residual` >= 0

**Step 2: Update the layer_assertions in solve-benchmark-fixtures.json to include the
newly-active layers.**

In `solve-benchmark-fixtures.json`, find the `layer-residual-regression` fixture's
`layer_assertions` object. Currently it only asserts on:
```json
"r_to_f": { "max": 5 },
"f_to_t": { "max": 5 },
"c_to_f": { "max": 3 },
"trace_health": { "max": 0 },
"memory_health": { "max": 0 }
```

Add assertions for the newly-active layers based on their observed baseline values from Step 1:
- `l1_to_l3`: set `"max"` to `observed_value + 2` (allows variance)
- `l3_to_tc`: set `"max"` to `observed_value + 2`
- `formal_lint`: set `"max"` to `observed_value + 5` (lint violations fluctuate)

Example (update with actual observed values):
```json
"l1_to_l3": { "max": 12 },
"l3_to_tc": { "max": 12 },
"formal_lint": { "max": 15 }
```

IMPORTANT: Use the ACTUAL values from Step 1, not these placeholder numbers.
If a layer returns -1 (e.g. if aggregate gate data is unavailable), do NOT add an assertion
for that layer — only add assertions for layers with residual >= 0.

**Step 3: Run the smoke benchmark to confirm no regression:**
```bash
node bin/nf-benchmark-solve.cjs --track=smoke 2>/dev/null
```
Should still pass 6/6 (or same count as before this task — the layer-residual-regression fixture
may now have new layers under assertion but must still pass with the updated max values).

NOTE: Do NOT run the full nf-benchmark against this repo (that requires cloning the
nf-benchmark repo and is out of scope). The verification is: nf-solve emits valid non-(-1)
residuals for the affected layers, and the smoke track still passes.
  </action>
  <verify>
```bash
# Verify all three newly-active layers have numeric residuals
node bin/nf-solve.cjs --report-only --json --fast --no-timeout --max-iterations=1 --skip-heatmap --skip-proximity --no-auto-commit --no-coderlm 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
rv=d.get('residual_vector',{})
checks = ['l1_to_l3','l3_to_tc','formal_lint','d_to_c','r_to_f']
for k in checks:
    v=rv.get(k,{})
    r=v.get('residual',-99) if isinstance(v,dict) else v
    ok='OK' if r >= 0 else 'FAIL'
    print(f'{k}: residual={r} [{ok}]')
"
```

All five layers must show residual >= 0.

```bash
# Confirm smoke track still passes
node bin/nf-benchmark-solve.cjs --track=smoke 2>/dev/null; echo "smoke exit=$?"
```
  </verify>
  <done>
- l1_to_l3, l3_to_tc, formal_lint, d_to_c, r_to_f all emit residual >= 0 in fast+report-only mode
- solve-benchmark-fixtures.json layer_assertions updated with realistic max bounds for new layers
- Smoke benchmark passes (exit 0)
- layer-residual-regression fixture passes with updated assertions
  </done>
</task>

</tasks>

<verification>
End-to-end verification:

1. nf-solve runs in fast mode without crashes:
   `node bin/nf-solve.cjs --report-only --json --fast --no-timeout --max-iterations=1 --skip-heatmap --skip-proximity --no-auto-commit --no-coderlm 2>/dev/null; echo $?`
   Expected: exit 0

2. l1_to_l3, l3_to_tc, formal_lint all show residual >= 0 (not -1)

3. per_model_gates still shows residual = -1 in fast mode (intentionally preserved)

4. d_to_c ghost-command scan runs without error

5. Smoke benchmark: 6/6 passed

6. No regressions in existing layer residuals (r_to_f, f_to_t, c_to_f bounds)
</verification>

<success_criteria>
- l1_to_l3 residual >= 0 in fast+report-only mode (was -1) — enables cross-layer-alignment detection
- l3_to_tc residual >= 0 in fast+report-only mode (was -1) — enables cross-layer-alignment detection
- formal_lint residual >= 0 in fast+report-only mode (was -1) — enables multi-layer formal_lint detection
- d_to_c ghost-command scan active and returns no errors — enables documentation detection for /nf: command claims
- Smoke benchmark still passes 6/6 (no regression)
- nf-solve exits 0 in fast+report-only mode with all changes applied
</success_criteria>

<output>
After completion, create `.planning/quick/401-fix-nf-solve-benchmark-detection-gaps-20/401-SUMMARY.md`
using the standard summary template.
</output>

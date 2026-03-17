---
phase: quick-303
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/hypothesis-measure.cjs
  - bin/nf-solve.cjs
  - bin/layer-constants.cjs
  - bin/solve-wave-dag.cjs
  - commands/nf/solve-diagnose.md
  - commands/nf/solve-remediate.md
autonomous: true
requirements: [QUICK-303]
formal_artifacts: none

must_haves:
  truths:
    - "Running `node bin/hypothesis-measure.cjs --json` produces hypothesis-measurements.json with CONFIRMED/VIOLATED/UNMEASURABLE verdicts for tier-1 assumptions"
    - "nf-solve.cjs includes h_to_m in its residual vector, with residual = count of VIOLATED assumptions"
    - "Existing solve runs do not break when hypothesis-measurements.json is absent (backward-compatible default)"
    - "solve-diagnose.md Step 0e calls hypothesis-measure.cjs between Step 0d and Step 1"
    - "solve-remediate.md has an h_to_m remediation section that dispatches constant alignment fixes"
  artifacts:
    - path: "bin/hypothesis-measure.cjs"
      provides: "Hypothesis measurement collection — reads proposed-metrics.json tier-1 assumptions, compares against trace/scoreboard/telemetry data"
      exports: ["measureHypotheses", "loadActualData"]
    - path: "bin/nf-solve.cjs"
      provides: "Updated computeResidual() with sweepHtoM() and h_to_m in return object"
      contains: "sweepHtoM"
    - path: "bin/layer-constants.cjs"
      provides: "Updated LAYER_KEYS with h_to_m"
      contains: "h_to_m"
  key_links:
    - from: "bin/hypothesis-measure.cjs"
      to: ".planning/formal/evidence/proposed-metrics.json"
      via: "JSON read of tier-1 metrics"
      pattern: "proposed-metrics\\.json"
    - from: "bin/hypothesis-measure.cjs"
      to: ".planning/formal/evidence/hypothesis-measurements.json"
      via: "JSON write of verdicts"
      pattern: "hypothesis-measurements\\.json"
    - from: "bin/nf-solve.cjs"
      to: "bin/hypothesis-measure.cjs"
      via: "require and call measureHypotheses()"
      pattern: "hypothesis-measure"
    - from: "bin/solve-wave-dag.cjs"
      to: "h_to_m layer"
      via: "LAYER_DEPS entry"
      pattern: "h_to_m"
---

<objective>
Add a hypothesis measurement collection step (H->M) to the nForma solve loop. This creates a new residual layer that extracts tier-1 formal model assumptions (the `assume` constants from TLA+/PRISM), measures them against actual trace/scoreboard/telemetry data, and flags VIOLATED assumptions as residuals for remediation.

Purpose: Formal models contain numeric assumptions (e.g., MaxDeliberationRounds=5, TP rate priors) that may drift from reality. This layer closes the feedback loop by detecting when assumptions diverge from observed data, enabling automatic constant realignment.

Output: `bin/hypothesis-measure.cjs`, updated residual vector in `nf-solve.cjs`, updated workflow docs in `solve-diagnose.md` and `solve-remediate.md`.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@bin/nf-solve.cjs
@bin/layer-constants.cjs
@bin/solve-wave-dag.cjs
@bin/export-prism-constants.cjs
@bin/telemetry-collector.cjs
@.planning/formal/evidence/proposed-metrics.json
@commands/nf/solve-diagnose.md
@commands/nf/solve-remediate.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create bin/hypothesis-measure.cjs and wire into nf-solve.cjs residual vector</name>
  <files>
    bin/hypothesis-measure.cjs
    bin/nf-solve.cjs
    bin/layer-constants.cjs
    bin/solve-wave-dag.cjs
  </files>
  <action>
**1a. Create `bin/hypothesis-measure.cjs`** — a pure CJS module following the exact pattern of `bin/export-prism-constants.cjs` (pure functions exported via `module.exports._pure`, `require.main === module` guard for CLI).

The script:
1. Reads `.planning/formal/evidence/proposed-metrics.json` and filters to `tier: 1` entries only (these are the `assume` constants from TLA+/PRISM — directly measurable).
2. For each tier-1 metric, extracts `assumption_name`, `source_model`, `assumption_type`, and `formal_ref`.
3. Loads actual data from up to 4 sources (all fail-open, graceful on missing files):
   - `.planning/formal/trace/conformance-events.jsonl` — parse NDJSON, extract actual max rounds observed, actual state transition counts
   - `.planning/quorum-scoreboard.json` — use the same `computeSlotRates()` pattern from `export-prism-constants.cjs` to get actual TP/UNAVAIL rates per slot
   - `.planning/telemetry/report.json` — actual p95 latencies, failure counts, hang counts from `telemetry-collector.cjs` output
   - `.claude/circuit-breaker-state.json` — actual trigger count
4. For each tier-1 assumption, attempts to match it to an actual measurement:
   - Parse the `assumption_name` to identify the metric category (e.g., names containing "Max" match against observed maximums, names containing "Rate" or "tp_" match against scoreboard rates, names containing "Timeout" or "Latency" match against telemetry p95)
   - If a matching actual value is found, compare: if actual exceeds formal assumption by >10% relative (or >2 absolute for small values), verdict = `VIOLATED`; if within bounds, verdict = `CONFIRMED`
   - If no matching actual data source exists, verdict = `UNMEASURABLE`
5. Writes `.planning/formal/evidence/hypothesis-measurements.json`:
   ```json
   {
     "schema_version": "1",
     "generated": "<ISO timestamp>",
     "total_measured": N,
     "verdicts": { "CONFIRMED": N, "VIOLATED": N, "UNMEASURABLE": N },
     "measurements": [
       {
         "assumption_name": "MaxDeliberationRounds",
         "source_model": "tla/NFDeliberation.tla",
         "formal_value": null,
         "actual_value": null,
         "actual_source": "conformance-events.jsonl",
         "verdict": "UNMEASURABLE",
         "reason": "formal value not extractable from proposed-metrics"
       }
     ]
   }
   ```

**Important design notes:**
- The `formal_value` for tier-1 assumptions is NOT in proposed-metrics.json (it only has metric metadata). The script must parse the actual TLA+/PRISM source files to extract the constant value. For TLA+: regex `CONSTANT\s+{name}` or `{name}\s*==\s*\d+` or `ASSUME\s+{name}\s*\\in\s*\d+\.\.\d+`. For PRISM: regex `const\s+\w+\s+{name}\s*=\s*[\d.]+`. If the value cannot be extracted, the measurement is still recorded but with `formal_value: null` and verdict `UNMEASURABLE`.
- Use `require('./planning-paths.cjs')` with try/catch fallback for path resolution, same pattern as telemetry-collector.cjs.
- Export pure functions: `measureHypotheses(root)` returns the full measurement object, `loadActualData(root)` returns the aggregated actual data from all 4 sources. Both exported via `module.exports._pure = { measureHypotheses, loadActualData }`.
- CLI mode (`--json` flag): writes to disk and prints JSON to stdout. Without `--json`, prints human-readable summary.

**1b. Add `h_to_m` to `bin/layer-constants.cjs`** — append `'h_to_m'` to the LAYER_KEYS array. Place it after `'hazard_model'` (the last current entry). Update the JSDoc comment to say "19-layer" instead of "18-layer".

**1c. Add `sweepHtoM()` to `bin/nf-solve.cjs`** — following the exact pattern of `sweepHazardModel()` (lines ~2662-2692):
1. Add `const { measureHypotheses } = require('./hypothesis-measure.cjs')._pure;` near the top imports
2. Create `function sweepHtoM()` that:
   - Calls `measureHypotheses(ROOT)`
   - If it returns null or errors, return `{ residual: -1, detail: { error: true, stderr: 'sweepHtoM failed: ...' } }`
   - Otherwise return `{ residual: result.verdicts.VIOLATED, detail: { total: result.total_measured, confirmed: result.verdicts.CONFIRMED, violated: result.verdicts.VIOLATED, unmeasurable: result.verdicts.UNMEASURABLE, measurements_path: '.planning/formal/evidence/hypothesis-measurements.json' } }`
3. Call `sweepHtoM()` in `computeResidual()` after `const hazard_model = sweepHazardModel();` — add `const h_to_m = sweepHtoM();`
4. Add `h_to_m` to the `informational` bucket sum (same treatment as `hazard_model` — informational, not automatable, because violated assumptions need human judgment)
5. Add `h_to_m` to the return object of `computeResidual()` (after `hazard_model`)
6. **Backward compatibility**: If `hypothesis-measurements.json` does not exist, `measureHypotheses()` should return `{ total_measured: 0, verdicts: { CONFIRMED: 0, VIOLATED: 0, UNMEASURABLE: 0 }, measurements: [] }` so the residual defaults to 0.

**1d. Add `h_to_m` to `bin/solve-wave-dag.cjs`** — add entry to `LAYER_DEPS`:
```javascript
h_to_m: [],  // No dependencies — hypothesis measurement is independent
```
Place it after the `per_model_gates` entry.
  </action>
  <verify>
1. `node -e "const { LAYER_KEYS } = require('./bin/layer-constants.cjs'); console.log(LAYER_KEYS.includes('h_to_m'), LAYER_KEYS.length)"` prints `true 19`
2. `node -e "const d = require('./bin/solve-wave-dag.cjs'); console.log('h_to_m' in (d.LAYER_DEPS || d))"` — verifying h_to_m is in the DAG (check if LAYER_DEPS is exported or access it via the module)
3. `node bin/hypothesis-measure.cjs --json 2>/dev/null; echo $?` exits 0
4. `node -e "const fs=require('fs'); const j=JSON.parse(fs.readFileSync('.planning/formal/evidence/hypothesis-measurements.json','utf8')); console.log(j.schema_version, j.verdicts)"` shows schema_version 1 and verdict counts
5. `node bin/nf-solve.cjs --json --report-only --fast 2>/dev/null | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d);console.log('h_to_m' in j.residual_vector)})"` prints `true`
  </verify>
  <done>
- `bin/hypothesis-measure.cjs` exists and produces `hypothesis-measurements.json` with tier-1 assumption verdicts
- `LAYER_KEYS` contains `h_to_m` (19 keys total)
- `nf-solve.cjs` computes `h_to_m` residual in its residual vector
- `solve-wave-dag.cjs` has `h_to_m` in LAYER_DEPS
- Existing `nf-solve.cjs --report-only` runs do not error (backward-compatible)
  </done>
</task>

<task type="auto">
  <name>Task 2: Update solve-diagnose.md and solve-remediate.md workflow docs</name>
  <files>
    commands/nf/solve-diagnose.md
    commands/nf/solve-remediate.md
  </files>
  <action>
**2a. Update `commands/nf/solve-diagnose.md`** — Add Step 0e between Step 0d (Inline Observe Refresh + Debt Load) and Step 1 (Initial Diagnostic Sweep).

Insert after the `### Step 0d` section ends (before `## Step 1: Initial Diagnostic Sweep`):

```markdown
### Step 0e: Hypothesis Measurement Collection

Measure formal model assumptions against actual observed data to detect violated hypotheses.

Run the hypothesis measurement collector:

```bash
node ~/.claude/nf-bin/hypothesis-measure.cjs --json --project-root=$(pwd) 2>/dev/null
```

If `~/.claude/nf-bin/hypothesis-measure.cjs` does not exist, fall back to `bin/hypothesis-measure.cjs` (CWD-relative).
If neither exists, skip this step silently.

Parse the JSON output:
- If `verdicts.VIOLATED > 0`: log `"Step 0e: {VIOLATED} hypothesis violation(s) detected out of {total_measured} tier-1 assumptions — flagged for remediation"`
- If `verdicts.VIOLATED === 0`: log `"Step 0e: All {total_measured} tier-1 assumptions confirmed or unmeasurable"`

Store the measurement result in solve context. The h_to_m residual layer in nf-solve.cjs will pick up `hypothesis-measurements.json` during the diagnostic sweep.

**Important:** This step is fail-open. If the measurement script errors or is not found, log the issue and proceed to Step 1. Hypothesis measurement failure must never block the diagnostic sweep.
```

Also update the `<objective>` description at the top to mention "hypothesis measurement" in the list of steps. Update the output_contract JSON to include `"hypothesis_measurements"` field (nullable).

**2b. Update `commands/nf/solve-remediate.md`** — Add h_to_m remediation section.

1. In the **Layer reference table** (around line 148), add a new row:
   ```
   | h_to_m | 3n. H->M Gaps | Yes -- dispatches /nf:quick |
   ```

2. Add a new section `### 3n. H->M Gaps (residual_vector.h_to_m.residual > 0)` after section 3m-extra (Per-Model Gates), before the "## Collation: capped_layers" section:

   ```markdown
   ### 3n. H->M Gaps (residual_vector.h_to_m.residual > 0)

   Hypothesis violations — formal model assumptions that diverge from observed reality. Each violated assumption represents a model constant that needs updating.

   Extract detail from `residual_vector.h_to_m.detail`:
   - `violated` — count of VIOLATED assumptions
   - `measurements_path` — path to full measurement data

   Read `.planning/formal/evidence/hypothesis-measurements.json` and filter to entries with `verdict: "VIOLATED"`.

   For each violated measurement:
   1. If `actual_source` is "scoreboard" and assumption relates to TP/UNAVAIL rates: dispatch `/nf:quick` to update the PRISM model constants (same flow as C->F constant alignment)
   2. If `actual_source` is "conformance-events" and assumption relates to max rounds/iterations: dispatch `/nf:quick` to update the TLA+ CONSTANT definition
   3. If `actual_source` is "telemetry" and assumption relates to timeouts/latencies: dispatch `/nf:quick` to update the relevant formal spec bound
   4. Otherwise: log as informational — `"H->M: {assumption_name} violated but no auto-fix strategy — manual review required"`

   **Max dispatches: 3 per solve cycle.** Track a counter for H->M dispatches. If the counter reaches 3, log `"H->M: max remediation dispatches (3) reached this cycle"`, append `{ "layer": "h_to_m", "dispatched": 3, "max": 3 }` to the `capped_layers` array, and skip further auto-fixes.

   All `/nf:quick` dispatches use default mode (no `--full` flag).

   Log: `"H->M: {violated} violated assumptions, {dispatched} auto-fix dispatches, {skipped} manual-only"`
   ```

3. In the `LAYER_DEPS` comment at the top or the dependency ordering section, note that `h_to_m` has no dependencies and can run in Wave 1.

4. Update the `<objective>` description to say "14 layer remediation steps (3a-3n)" instead of "13 layer remediation steps (3a-3m)".

5. In the "Collation: capped_layers" section, add "H->M (3n)" to the list of gates that contribute capped_layers entries.

6. In the Important Constraints section, add h_to_m to constraint 9 noting that H->M remediation is bounded by the max-3 cap per cycle.
  </action>
  <verify>
1. `grep -c 'Step 0e' commands/nf/solve-diagnose.md` returns 1 or more (Step 0e exists)
2. `grep -c 'h_to_m' commands/nf/solve-remediate.md` returns 3+ (layer table row, section header, remediation logic)
3. `grep '3n\. H->M' commands/nf/solve-remediate.md` matches the new section
4. `grep '14 layer' commands/nf/solve-remediate.md` confirms updated count
  </verify>
  <done>
- solve-diagnose.md has Step 0e calling hypothesis-measure.cjs between Step 0d and Step 1
- solve-remediate.md has section 3n for H->M gap remediation with max-3 dispatch cap
- Layer reference table includes h_to_m row
- Objective descriptions updated to reflect new step/layer counts
  </done>
</task>

</tasks>

<verification>
1. Full backward compatibility: `node bin/nf-solve.cjs --json --report-only --fast 2>/dev/null` completes without error and includes `h_to_m` in residual_vector
2. Measurement script standalone: `node bin/hypothesis-measure.cjs --json` writes hypothesis-measurements.json
3. Layer count: LAYER_KEYS has 19 entries
4. Wave DAG accepts h_to_m: `node -e "const {computeWaves}=require('./bin/solve-wave-dag.cjs'); console.log(computeWaves({h_to_m:{residual:1}}))"` returns a valid wave array
5. Workflow docs reference the new step/section correctly
</verification>

<success_criteria>
- hypothesis-measure.cjs reads tier-1 assumptions from proposed-metrics.json, compares against 4 actual data sources, writes hypothesis-measurements.json
- nf-solve.cjs residual vector includes h_to_m with residual = VIOLATED count
- Backward compatible: missing hypothesis-measurements.json produces residual 0, not an error
- solve-diagnose.md Step 0e and solve-remediate.md section 3n are present and correctly structured
</success_criteria>

<output>
After completion, create `.planning/quick/303-add-hypothesis-measurement-collection-st/303-SUMMARY.md`
</output>

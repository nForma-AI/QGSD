---
phase: quick-234
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/compute-per-model-gates.cjs
  - bin/nf-solve.cjs
autonomous: true
formal_artifacts: none
requirements: [GATE-01, GATE-02, GATE-03, GATE-04]

must_haves:
  truths:
    - "Each model in model-registry.json gets a per-model gate score (0-3) based on Gate A/B/C pass/fail"
    - "Models that meet SOFT_GATE criteria are auto-promoted from ADVISORY"
    - "nf-solve includes per-model gate results in its sweep output"
    - "compute-per-model-gates.cjs --json produces machine-readable per-model breakdown"
  artifacts:
    - path: "bin/compute-per-model-gates.cjs"
      provides: "Per-model gate scoring and auto-promotion"
      min_lines: 120
    - path: "bin/nf-solve.cjs"
      provides: "sweepPerModelGates function wired after layer alignment sweeps"
      contains: "sweepPerModelGates"
  key_links:
    - from: "bin/compute-per-model-gates.cjs"
      to: ".planning/formal/model-registry.json"
      via: "reads models, writes updated gate_maturity and layer_maturity"
      pattern: "model-registry\\.json"
    - from: "bin/compute-per-model-gates.cjs"
      to: "bin/promote-gate-maturity.cjs"
      via: "reuses validateCriteria and inferSourceLayer functions"
      pattern: "promote-gate-maturity"
    - from: "bin/nf-solve.cjs"
      to: "bin/compute-per-model-gates.cjs"
      via: "spawnTool call in sweepPerModelGates"
      pattern: "compute-per-model-gates"
  consumers:
    - artifact: "bin/compute-per-model-gates.cjs"
      consumed_by: "bin/nf-solve.cjs"
      integration: "spawnTool() call in sweepPerModelGates()"
      verify_pattern: "compute-per-model-gates"
---

<objective>
Create per-model gate maturity scoring that computes which gates (A/B/C) each formal model passes, updates layer_maturity scores (0-3), auto-promotes eligible models, and wires results into nf-solve as a new sweep layer.

Purpose: Currently all 119 models sit at ADVISORY/layer_maturity=0. Gate scoring is global-only (pooled across all models). This task makes gate assessment per-model so the system can track individual model readiness and auto-promote models that meet criteria.

Output: bin/compute-per-model-gates.cjs script, updated nf-solve.cjs with sweepPerModelGates integration.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@bin/promote-gate-maturity.cjs
@bin/nf-solve.cjs
@bin/gate-a-grounding.cjs
@bin/gate-b-abstraction.cjs
@bin/gate-c-validation.cjs
@.planning/formal/model-registry.json
@.planning/formal/layer-manifest.json
@.planning/formal/traceability-matrix.json
@.planning/formal/gates/gate-a-grounding.json
@.planning/formal/gates/gate-b-abstraction.json
@.planning/formal/gates/gate-c-validation.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create bin/compute-per-model-gates.cjs</name>
  <files>bin/compute-per-model-gates.cjs</files>
  <action>
Create `bin/compute-per-model-gates.cjs` that computes per-model gate pass/fail and updates model-registry.json.

**CLI interface:**
- `node bin/compute-per-model-gates.cjs` — human-readable summary
- `node bin/compute-per-model-gates.cjs --json` — machine-readable JSON to stdout
- `node bin/compute-per-model-gates.cjs --dry-run` — compute scores but do NOT write registry
- Supports `--project-root=` flag (same pattern as other gate scripts)

**Per-model gate scoring logic:**

For each model key in model-registry.json (keys starting with `.`):

1. **Gate A (grounding) relevance:** A model passes Gate A if:
   - It has `source_layer` assigned (or inferable via `inferSourceLayer()` from promote-gate-maturity.cjs)
   - Its `requirements[]` array maps to at least one requirement in traceability-matrix.json that has a check-result entry with `result: "pass"` in check-results.ndjson
   - OR: the layer-manifest.json shows `grounding_status: "has_semantic_declarations"` for this model path
   - Rationale: Gate A measures L1-L2 grounding. A model is "grounded" if it has semantic declarations or its requirements have passing trace checks.

2. **Gate B (abstraction) relevance:** A model passes Gate B if:
   - It has `source_layer` assigned
   - AND the model appears in any L3 reasoning artifact's `derived_from` links (check `reasoning/hazard-model.json` entries for `derived_from[].artifact` matching the model path)
   - OR: the model itself is in L3 (source_layer === 'L3') and has non-empty `requirements[]`
   - Rationale: Gate B measures L2-L3 traceability. A model passes if it's referenced by L3 reasoning.

3. **Gate C (validation) relevance:** A model passes Gate C if:
   - Its `requirements[]` array maps to at least one failure mode in `reasoning/failure-mode-catalog.json` that has a corresponding test recipe in `test-recipes/test-recipes.json`
   - OR: it has a passing check-result in check-results.ndjson with the model's tool name or check_id matching
   - Rationale: Gate C measures L3-to-test coverage. A model passes if its failure modes have test recipes.

**Scoring:**
- `layer_maturity` = count of gates passed (0-3)
- Store per-model breakdown: `{ gate_a: boolean, gate_b: boolean, gate_c: boolean }` (in output JSON, not in registry)

**Auto-promotion:**
- After computing scores, for each model:
  - If `layer_maturity >= 1` AND current `gate_maturity === "ADVISORY"` AND model has `source_layer`: auto-promote to `SOFT_GATE` using the same validation logic from `promote-gate-maturity.cjs` (`validateCriteria()`)
  - If `layer_maturity >= 3` AND has passing check-result: auto-promote to `HARD_GATE`
- Do NOT demote models (that's `promote-gate-maturity.cjs --check --fix`'s job)
- Write updated `layer_maturity` and any promotions back to model-registry.json (unless `--dry-run`)

**Output JSON shape (--json mode):**
```json
{
  "generated": "ISO timestamp",
  "total_models": 119,
  "scores": {
    "gate_a_pass": N,
    "gate_b_pass": N,
    "gate_c_pass": N,
    "avg_layer_maturity": N.N
  },
  "promotions": [
    { "model": "path", "from": "ADVISORY", "to": "SOFT_GATE" }
  ],
  "per_model": {
    ".planning/formal/alloy/foo.als": {
      "gate_a": true,
      "gate_b": false,
      "gate_c": false,
      "layer_maturity": 1,
      "gate_maturity": "SOFT_GATE",
      "promoted": true
    }
  }
}
```

**Import from promote-gate-maturity.cjs:** Require and reuse `validateCriteria`, `inferSourceLayer`, `loadCheckResults`, and `getModelKeys` from promote-gate-maturity.cjs rather than reimplementing.

**Error handling:** fail-open. If a data source (traceability-matrix, hazard-model, failure-mode-catalog) is missing, treat that gate as not-passed for all models. Log a warning to stderr.
  </action>
  <verify>
Run `node bin/compute-per-model-gates.cjs --json --dry-run` and confirm:
1. JSON output parses without error
2. `total_models` matches model-registry model count
3. `per_model` object has entries for all models
4. At least some models show `gate_a: true` (the 24 with `has_semantic_declarations` in layer-manifest should pass Gate A)
5. `layer_maturity` values are 0-3 integers

Then run without --dry-run: `node bin/compute-per-model-gates.cjs --json` and verify model-registry.json has updated `layer_maturity` values for models that scored > 0.
  </verify>
  <done>
bin/compute-per-model-gates.cjs exists, produces valid per-model gate scoring JSON, auto-promotes eligible models to SOFT_GATE, and writes updated layer_maturity to model-registry.json. Models with has_semantic_declarations show gate_a: true and layer_maturity >= 1.
  </done>
</task>

<task type="auto">
  <name>Task 2: Wire sweepPerModelGates into nf-solve.cjs</name>
  <files>bin/nf-solve.cjs</files>
  <action>
Add a `sweepPerModelGates()` function and wire it into the solve orchestrator.

**1. Add sweepPerModelGates function** (place it after the `sweepL3toTC` function, around line 2226):

```javascript
/**
 * Per-model gate maturity sweep.
 * Spawns compute-per-model-gates.cjs --json --dry-run (in report-only mode)
 * or --json (in mutation mode) and returns summary as residual.
 * Residual = number of models still at layer_maturity 0.
 */
function sweepPerModelGates() {
  if (fastMode) {
    return { residual: -1, detail: { skipped: true, reason: 'fast mode' } };
  }

  const dryRunFlag = reportOnly ? '--dry-run' : '';
  const args = ['--json'];
  if (reportOnly) args.push('--dry-run');

  const result = spawnTool('bin/compute-per-model-gates.cjs', args);

  if (!result.ok && !result.stdout) {
    return { residual: -1, detail: { error: true, stderr: (result.stderr || '').slice(0, 500) } };
  }

  try {
    const data = JSON.parse(result.stdout);
    const totalModels = data.total_models || 0;
    const avgMaturity = (data.scores && data.scores.avg_layer_maturity) || 0;
    // Residual: models at maturity 0 (unscored)
    const zeroMaturityCount = Object.values(data.per_model || {})
      .filter(m => m.layer_maturity === 0).length;
    return {
      residual: zeroMaturityCount,
      detail: {
        total_models: totalModels,
        avg_layer_maturity: avgMaturity,
        gate_a_pass: (data.scores && data.scores.gate_a_pass) || 0,
        gate_b_pass: (data.scores && data.scores.gate_b_pass) || 0,
        gate_c_pass: (data.scores && data.scores.gate_c_pass) || 0,
        promotions: (data.promotions || []).length,
      },
    };
  } catch (err) {
    return { residual: -1, detail: { error: true, stderr: 'JSON parse failed: ' + err.message } };
  }
}
```

**2. Wire into computeResidual():**
- After the `l3_to_tc` assignment (around line 2439), add:
  ```javascript
  const per_model_gates = fastMode ? skipLayer : sweepPerModelGates();
  ```
- Add `per_model_gates` to the returned residual object (alongside l1_to_l2, l2_to_l3, l3_to_tc)
- Do NOT add per_model_gates residual to `layer_total` — it is informational (like git_heatmap). The layer_total tracks cross-layer gate alignment scores, not per-model counts.

**3. Add to module.exports:**
Add `sweepPerModelGates` to the module.exports object.

**4. Do NOT modify autoClose** — per-model gate scoring is informational. Auto-promotion happens inside compute-per-model-gates.cjs itself during the sweep (when not in report-only mode).
  </action>
  <verify>
1. `grep 'sweepPerModelGates' bin/nf-solve.cjs` returns matches for function definition, call in computeResidual, and module.exports
2. `grep 'compute-per-model-gates' bin/nf-solve.cjs` returns match in spawnTool call
3. `grep 'per_model_gates' bin/nf-solve.cjs` returns matches for variable assignment and inclusion in return object
4. Run `node bin/nf-solve.cjs --report-only --json --max-iterations=1 2>/dev/null | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log('per_model_gates' in d.iterations[0].residual)"` — should print `true`
  </verify>
  <done>
nf-solve.cjs includes sweepPerModelGates() that spawns compute-per-model-gates.cjs, includes per_model_gates in the residual output, and exports the function. Running nf-solve --json shows per_model_gates in the residual vector with gate pass counts and avg_layer_maturity.
  </done>
</task>

</tasks>

<verification>
1. `node bin/compute-per-model-gates.cjs --json --dry-run | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(d.total_models, d.scores)"` — shows 119 models with gate scores
2. `node bin/compute-per-model-gates.cjs --json` — writes to model-registry.json, verify with: `node -e "const r=JSON.parse(require('fs').readFileSync('.planning/formal/model-registry.json','utf8')); const m=Object.entries(r.models).filter(([k,v])=>v.layer_maturity>0); console.log(m.length, 'models with maturity>0')"`
3. `node bin/nf-solve.cjs --report-only --max-iterations=1 2>/dev/null` — no crash, per_model_gates shows in output
4. `node bin/promote-gate-maturity.cjs --check --json` — no new violations introduced
</verification>

<success_criteria>
- bin/compute-per-model-gates.cjs produces per-model gate scores for all 119 models
- Models with has_semantic_declarations in layer-manifest pass Gate A and get layer_maturity >= 1
- Eligible ADVISORY models are auto-promoted to SOFT_GATE
- nf-solve includes per_model_gates in residual vector
- No regressions in existing gate scripts or promote-gate-maturity checks
</success_criteria>

<output>
After completion, create `.planning/quick/234-per-formal-model-gate-maturity-tracking-/234-SUMMARY.md`
</output>

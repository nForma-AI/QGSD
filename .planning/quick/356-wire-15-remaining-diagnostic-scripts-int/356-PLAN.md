---
phase: quick-356
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/nf-solve.cjs
autonomous: true
formal_artifacts: none
requirements:
  - INTENT-01

must_haves:
  truths:
    - "All 15 diagnostic scripts are invoked by nf-solve.cjs during computeResidual"
    - "7 new sweeps produce {residual, detail} objects consistent with existing pattern"
    - "8 folds enrich their host sweeps with additional diagnostic data"
    - "New sweeps appear in the residual table renderer output"
    - "New automatable sweeps are included in automatable/informational totals"
    - "New sweep layer keys appear in DEFAULT_WAVES for autoClose dispatch"
  artifacts:
    - path: "bin/nf-solve.cjs"
      provides: "All 15 diagnostic integrations"
      contains: "sweepConfigHealth"
  key_links:
    - from: "sweepConfigHealth"
      to: "computeResidual"
      via: "variable assignment in computeResidual body"
      pattern: "config_health.*sweepConfigHealth"
    - from: "sweepSecurity"
      to: "computeResidual"
      via: "variable assignment in computeResidual body"
      pattern: "security.*sweepSecurity"
    - from: "new sweep keys"
      to: "DEFAULT_WAVES"
      via: "layer key strings in DEFAULT_WAVES array"
      pattern: "config_health.*security.*trace_health.*asset_stale.*arch_constraints.*debt_health.*memory_health"
---

<objective>
Wire 15 remaining diagnostic scripts into nf-solve.cjs as new sweeps or folds into existing sweeps,
so that every diagnostic tool participates in the residual vector and solve report table.

Purpose: Complete diagnostic coverage -- all bin/ analysis tools feed into the solve loop.
Output: Updated bin/nf-solve.cjs with 7 new sweep functions + 8 fold enrichments + table rows + totals + DEFAULT_WAVES entries.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@bin/nf-solve.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create 7 new sweep functions and fold 8 scripts into existing sweeps</name>
  <files>bin/nf-solve.cjs</files>
  <action>
**A) Create 7 new sweep functions** (place near existing sweepReqQuality around line ~3440):

Each follows the pattern: try/catch, fail-open with `{residual: -1, detail: {skipped: true, reason: ...}}`, return `{residual: N, detail: {...}}`.

1. **sweepConfigHealth()** — `spawnTool('bin/config-audit.cjs', ['--json'])`, parse JSON, residual = warnings.length + missing.length. Detail: `{warnings, missing}`.

2. **sweepSecurity()** — `spawnTool('bin/security-sweep.cjs', ['--json'])`, parse JSON array, residual = findings.length. Detail: `{findings_count, findings}`.

3. **sweepTraceHealth()** — Two-part:
   a) `spawnTool('bin/validate-traces.cjs', [])` — parse stdout as JSON lines (split on newline, JSON.parse each), count divergences.
   b) `spawnTool('bin/check-trace-schema-drift.cjs', [])` — check exit code (0 = clean, non-0 = drift found, add 1 to residual).
   Residual = divergence_count + schema_drift_count. Detail: `{divergences, schema_drift}`.

4. **sweepAssetStaleness()** — `spawnTool('bin/check-assets-stale.cjs', [])`, residual = exit code === 0 ? 0 : 1. Detail: `{stale: exitCode !== 0, stderr}`.

5. **sweepArchConstraints()** — `spawnTool('bin/check-bundled-sdks.cjs', [])`, residual = exit code === 0 ? 0 : 1. Detail: `{violations: exitCode !== 0, output: stdout}`.

6. **sweepDebtHealth()** — `require('bin/debt-retention.cjs')`, call `applyRetentionPolicy()`. If it returns an object with counts, residual = expired_count (or items.length). Wrap in try/catch, fail-open. Detail: `{expired, retained}`.

7. **sweepMemoryHealth()** — Try `require('bin/validate-memory.cjs')` for `validateMemory()` export. If no export, fall back to `spawnTool('bin/validate-memory.cjs', [])` and check exit code. Residual = issue count or exit code. Detail: `{issues}`.

**B) Fold 8 scripts into existing sweeps** — add secondary diagnostics AFTER the primary logic in each host sweep's try block, merging results into the detail object:

1. **sweepReqQuality** += `spawnTool('bin/aggregate-requirements.cjs', [])` — check exit code, add `aggregate_sync: exitCode === 0` to detail. If exit non-0, add 1 to residual.

2. **sweepReqQuality** += `require('bin/baseline-drift.cjs').detectBaselineDrift()` — if drift detected, add drift count to residual, add `baseline_drift` to detail.

3. **sweepFtoC** += `spawnTool('bin/check-spec-sync.cjs', [])` — check exit code, if non-0 add 1 to residual, add `spec_sync_drift: true` to detail.

4. **sweepFtoT** += `spawnTool('bin/annotate-tests.cjs', ['--json'])` — parse JSON, add suggestion count to detail as `test_annotations`. Do NOT add to residual (informational).

5. **sweepTtoC** += `spawnTool('bin/check-coverage-guard.cjs', [])` — check exit code, if non-0 add 1 to residual, add `coverage_guard_fail: true` to detail.

6. **sweepDtoC** += `require('bin/fingerprint-drift.cjs').fingerprintDrift()` — if drift items found, add count to residual, add `fingerprint_drift` to detail.

7. **sweepFormalLint** += `spawnTool('bin/check-liveness-fairness.cjs', [])` — check exit code, if non-0 add violation count to residual, add `liveness_fairness_violations` to detail.

**Important patterns:**
- Use `if (!fs.existsSync(...))` guard before require() calls
- Every spawnTool call must check `.ok` before parsing
- Wrap each fold in its own inner try/catch so a fold failure does not break the host sweep (fail-open)
- For require() calls, use `path.join(ROOT, 'bin', 'script-name.cjs')` for the path
  </action>
  <verify>
Run `node -e "const s = require('./bin/nf-solve.cjs'); console.log('OK')"` from project root -- should not throw (syntax check).
Grep for all 7 new function names: `grep -c 'function sweep\(ConfigHealth\|Security\|TraceHealth\|AssetStaleness\|ArchConstraints\|DebtHealth\|MemoryHealth\)' bin/nf-solve.cjs` should return 7.
Grep for fold markers: `grep -c 'fingerprint-drift\|baseline-drift\|annotate-tests\|check-coverage-guard\|check-spec-sync\|check-liveness-fairness\|aggregate-requirements\|check-trace-schema-drift' bin/nf-solve.cjs` should return >= 8.
  </verify>
  <done>All 15 scripts are invoked -- 7 as new sweep functions, 8 folded into existing sweeps. Each returns {residual, detail} or enriches host detail. All fail-open on missing scripts.</done>
</task>

<task type="auto">
  <name>Task 2: Wire new sweeps into computeResidual, totals, table renderer, and DEFAULT_WAVES</name>
  <files>bin/nf-solve.cjs</files>
  <action>
**A) Wire into computeResidual (~line 3604-3693):**

Add after the existing `req_quality` call (around line 3693):

```
const config_health = checkLayerSkip('config_health') || sweepConfigHealth();
const security = checkLayerSkip('security') || sweepSecurity();
const trace_health = checkLayerSkip('trace_health') || sweepTraceHealth();
const asset_stale = checkLayerSkip('asset_stale') || sweepAssetStaleness();
const arch_constraints = checkLayerSkip('arch_constraints') || sweepArchConstraints();
const debt_health = checkLayerSkip('debt_health') || sweepDebtHealth();
const memory_health = checkLayerSkip('memory_health') || sweepMemoryHealth();
```

**B) Add to the `informational` total (~line 3714-3721):**

Add these 7 to the `informational` sum (these are diagnostic/hygiene sweeps, not forward-layer automatable):

```
(config_health.residual >= 0 ? config_health.residual : 0) +
(security.residual >= 0 ? security.residual : 0) +
(trace_health.residual >= 0 ? trace_health.residual : 0) +
(asset_stale.residual >= 0 ? asset_stale.residual : 0) +
(arch_constraints.residual >= 0 ? arch_constraints.residual : 0) +
(debt_health.residual >= 0 ? debt_health.residual : 0) +
(memory_health.residual >= 0 ? memory_health.residual : 0) +
```

**C) Add to the return object (~line 3723-3755):**

Add all 7 new keys: `config_health, security, trace_health, asset_stale, arch_constraints, debt_health, memory_health`.

**D) Add table renderer rows (~line 4300+):**

Add a new section after the "B -> F" section and before the Cross-Layer Dashboard:

```
// Diagnostic Health section (informational)
lines.push('\u2500 Diagnostic Health \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
```

Render each of the 7 new sweeps using `renderRow()` with labels:
- `CH (Config Health)` for config_health
- `SEC (Security)` for security
- `TH (Trace Health)` for trace_health
- `AS (Asset Stale)` for asset_stale
- `AC (Arch Constraints)` for arch_constraints
- `DH (Debt Health)` for debt_health
- `MH (Memory Health)` for memory_health

**E) Add to DEFAULT_WAVES (~line 4005):**

Append all 7 new layer keys to the DEFAULT_WAVES array:
`'config_health', 'security', 'trace_health', 'asset_stale', 'arch_constraints', 'debt_health', 'memory_health'`

**F) Add LAYER_HANDLERS entries (~line 3792):**

For each new sweep, add a no-op handler (these are informational, autoClose does not remediate them):

```
config_health: () => {},
security: () => {},
trace_health: () => {},
asset_stale: () => {},
arch_constraints: () => {},
debt_health: () => {},
memory_health: () => {},
```

This ensures the wave dispatcher does not warn about unknown layers.
  </action>
  <verify>
1. `grep 'config_health' bin/nf-solve.cjs | wc -l` should be >= 5 (sweep call, informational sum, return obj, table row, DEFAULT_WAVES).
2. `grep 'security' bin/nf-solve.cjs | grep -v '//' | head -5` should show the sweep wiring.
3. `grep 'Diagnostic Health' bin/nf-solve.cjs` should return 1 match (table section header).
4. `node -e "const s = require('./bin/nf-solve.cjs'); console.log('OK')"` should not throw.
5. `grep DEFAULT_WAVES bin/nf-solve.cjs` should show all 7 new keys in the array.
  </verify>
  <done>All 7 new sweeps are wired into computeResidual, included in informational totals, returned in the residual object, rendered in the table, present in DEFAULT_WAVES, and have LAYER_HANDLERS entries. The solve report now shows all 15 diagnostic scripts.</done>
</task>

</tasks>

<verification>
- `node -e "require('./bin/nf-solve.cjs')"` loads without syntax error
- All 7 new sweep function names exist in the file
- All 8 fold script names (e.g., fingerprint-drift, baseline-drift) appear in the file
- computeResidual return object includes all 7 new keys
- DEFAULT_WAVES includes all 7 new layer keys
- Table renderer has "Diagnostic Health" section with 7 rows
- informational total sums all 7 new sweep residuals
</verification>

<success_criteria>
- 15 diagnostic scripts are invoked during nf-solve execution
- 7 new sweeps return {residual, detail} following existing pattern
- 8 folds enrich existing sweep detail objects
- All new sweeps fail-open (missing script = skip, not crash)
- Table renderer displays all new sweep results
- DEFAULT_WAVES enables autoClose dispatch for new layers
</success_criteria>

<output>
After completion, create `.planning/quick/356-wire-15-remaining-diagnostic-scripts-int/356-SUMMARY.md`
</output>

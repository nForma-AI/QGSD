---
phase: quick-236
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/compute-per-model-gates.cjs
  - bin/promote-gate-maturity.cjs
  - bin/run-formal-verify.cjs
  - bin/nf-solve.cjs
  - bin/refresh-evidence.cjs
autonomous: true
formal_artifacts: none
requirements: [GATE-01, GATE-02, GATE-03, GATE-04]

must_haves:
  truths:
    - "Gate promotion considers evidence file readiness (not just source_layer + check-results)"
    - "compute-per-model-gates runs as part of run-formal-verify pipeline"
    - "Git heatmap residual contributes to the convergence grand total"
    - "Evidence files are refreshed from traces during nf-solve runs"
    - "autoClose checks evidence readiness before reporting promotion-ready status"
  artifacts:
    - path: "bin/compute-per-model-gates.cjs"
      provides: "Evidence-aware gate evaluation"
      contains: "instrumentation-map"
    - path: "bin/run-formal-verify.cjs"
      provides: "Per-model gates step in STATIC_STEPS"
      contains: "compute-per-model-gates"
    - path: "bin/nf-solve.cjs"
      provides: "Heatmap in convergence + evidence readiness in autoClose"
      contains: "heatmap_total"
    - path: "bin/refresh-evidence.cjs"
      provides: "Lightweight evidence refresh from recent traces"
      contains: "trace-corpus-stats"
  key_links:
    - from: "bin/compute-per-model-gates.cjs"
      to: ".planning/formal/evidence/*.json"
      via: "loadJSON reads evidence files for promotion scoring"
      pattern: "evidence.*instrumentation-map|state-candidates|failure-taxonomy|trace-corpus"
    - from: "bin/run-formal-verify.cjs"
      to: "bin/compute-per-model-gates.cjs"
      via: "STATIC_STEPS entry with type: node"
      pattern: "compute-per-model-gates"
    - from: "bin/nf-solve.cjs"
      to: "bin/refresh-evidence.cjs"
      via: "spawnTool call before convergence loop"
      pattern: "refresh-evidence"
---

<objective>
Wire evidence files into the gate promotion pipeline, closing 5 gaps: (1) evidence-aware promotion criteria, (2) per-model gates in run-formal-verify, (3) git heatmap in convergence, (4) normal-usage trace processing, (5) autoClose readiness checks.

Purpose: Evidence files (instrumentation-map.json, state-candidates.json, failure-taxonomy.json, trace-corpus-stats.json, proposed-metrics.json) are written by dedicated scripts but never read by the promotion pipeline. Gate promotion decisions ignore evidence quality signals.
Output: Evidence-informed gate promotion, heatmap in convergence totals, evidence refresh in solve loop, autoClose awareness.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@bin/compute-per-model-gates.cjs
@bin/promote-gate-maturity.cjs
@bin/run-formal-verify.cjs
@bin/nf-solve.cjs
@bin/trace-corpus-stats.cjs
@bin/failure-taxonomy.cjs
@bin/instrumentation-map.cjs
@bin/state-candidates.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add evidence readiness to gate promotion and wire per-model gates into run-formal-verify</name>
  <files>
    bin/compute-per-model-gates.cjs
    bin/promote-gate-maturity.cjs
    bin/run-formal-verify.cjs
  </files>
  <action>
**Gap 1 — Evidence-aware promotion in compute-per-model-gates.cjs:**

Add evidence file loading after the existing `loadJSON` calls (~line 172-177). Load these 5 evidence files:
- `evidence/instrumentation-map.json`
- `evidence/state-candidates.json`
- `evidence/failure-taxonomy.json`
- `evidence/trace-corpus-stats.json`
- `evidence/proposed-metrics.json`

Create a function `computeEvidenceReadiness(evidenceFiles)` that returns a score 0-5 (count of non-null files with valid content). Criteria for each:
- instrumentation-map: has `actions` array with length > 0
- state-candidates: has `candidates` array with length > 0
- failure-taxonomy: has `classifications` or `categories` array with length > 0
- trace-corpus-stats: has `sessions` array with length > 0
- proposed-metrics: has `metrics` array with length > 0

Use fail-open: if a file is missing or malformed, it contributes 0. The function returns `{ score, total: 5, details: { [name]: boolean } }`.

**`--skip-evidence` flag (quorum: opencode-1):**

Add a `--skip-evidence` CLI flag (parsed alongside the existing `--json` and `--dry-run` flags). When set:
- Skip all evidence file loading entirely
- Set `evidence_readiness` to `{ score: 0, total: 5, skipped: true, details: {} }` in the output
- Do NOT apply evidence-based promotion thresholds (treat as if evidence requirements are met)
- Log `TAG + ' Evidence loading skipped (--skip-evidence)'` to stderr

This provides operational flexibility for debugging scenarios where evidence loading might cause issues without affecting the core promotion logic. The flag is safe because it only relaxes evidence checks — it cannot promote a gate that wouldn't otherwise be promotable by source_layer + check-results criteria.

Wire evidence readiness into auto-promotion logic:
- For ADVISORY -> SOFT_GATE: require evidence_readiness.score >= 1 (at least one evidence file is populated). Add this as an additional condition at ~line 209 alongside `maturity >= 1`.
- For SOFT_GATE -> HARD_GATE: require evidence_readiness.score >= 3. Add at ~line 224 alongside `maturity >= 3`.
- Include evidence_readiness in the per-model output object (line 238-245).

In `promote-gate-maturity.cjs`, update `validateCriteria()` to optionally accept an `evidenceReadiness` parameter. When provided and target level is SOFT_GATE, require score >= 1. When HARD_GATE, require score >= 3. Default to no evidence check when parameter not provided (backward compat).

**Gap 2 — Add compute-per-model-gates to run-formal-verify.cjs STATIC_STEPS:**

Insert a new step after the Gate C entry (after line 417, before the closing `];` of STATIC_STEPS):

```javascript
{
  tool: 'gates', id: 'gates:per-model',
  label: 'Per-model gate maturity scoring',
  type: 'node', script: 'compute-per-model-gates.cjs', args: ['--json'],
  nonCritical: true,
},
```

This follows the exact pattern of the three gate steps above it.
  </action>
  <verify>
Run `node bin/compute-per-model-gates.cjs --json --dry-run` and confirm output includes `evidence_readiness` field.
Run `node bin/compute-per-model-gates.cjs --json --dry-run --skip-evidence` and confirm output includes `evidence_readiness.skipped: true` with score 0.
Run `node bin/run-formal-verify.cjs --only=gates:per-model --dry-run 2>&1 | head -20` and confirm it finds and attempts to run the step.
Grep: `grep 'evidence' bin/compute-per-model-gates.cjs` returns matches.
Grep: `grep 'skip-evidence' bin/compute-per-model-gates.cjs` returns match for the flag.
Grep: `grep 'per-model' bin/run-formal-verify.cjs` returns match.
  </verify>
  <done>
Gate promotion considers evidence readiness scores (SOFT_GATE needs >= 1/5, HARD_GATE needs >= 3/5). compute-per-model-gates runs inside run-formal-verify pipeline as a nonCritical step.
  </done>
</task>

<task type="auto">
  <name>Task 2: Wire heatmap into convergence, add evidence refresh, and add autoClose readiness checks</name>
  <files>
    bin/nf-solve.cjs
    bin/refresh-evidence.cjs
  </files>
  <action>
**Gap 3 — Include git heatmap in convergence grand total:**

In `nf-solve.cjs` at ~line 2982 where `grandTotal` is computed:
```javascript
const grandTotal = (finalResidual.total || 0) + rdTotal + layerTotal;
```
Change to include heatmap:
```javascript
const hmTotal = finalResidual.heatmap_total || 0;
const grandTotal = (finalResidual.total || 0) + rdTotal + layerTotal + hmTotal;
```

Also update the report display section (~line 2880-2890) to include heatmap in the "Informational" section header with its subtotal, similar to how layerTotal and rdTotal are displayed. Add after the existing heatmap detail rendering:
```javascript
lines.push('  Heatmap subtotal:      ' + hmTotal);
```

NOTE: Do NOT add heatmap_total to `residual.total` (the forward convergence variable at line 3349). The heatmap is informational for the grand total display only — it should not affect the convergence loop's `prevTotal` comparison which drives autoClose iteration. Adding it to `total` would cause the convergence loop to never stabilize since heatmap changes independently.

**Gap 4 — Create bin/refresh-evidence.cjs:**

Create a new lightweight script `bin/refresh-evidence.cjs` that runs the 4 existing evidence generators in sequence:
1. `bin/trace-corpus-stats.cjs`
2. `bin/failure-taxonomy.cjs`
3. `bin/instrumentation-map.cjs`
4. `bin/state-candidates.cjs`

Pattern: Use `spawnSync(process.execPath, [scriptPath], { cwd: ROOT, timeout: 30000, stdio: 'pipe' })` for each. Fail-open: log warnings but continue if any script fails. Output a JSON summary: `{ refreshed: N, failed: N, scripts: [{ name, ok, elapsed_ms }] }`.

Support `--json` flag for machine output and `--project-root=` for ROOT override (same pattern as other bin/ scripts).

Wire into nf-solve.cjs: In the `computeResidual()` function, add a call to refresh evidence BEFORE the convergence loop starts (before the `for` loop at ~line 3337). Add it as a one-time pre-step:
```javascript
// Refresh evidence files from recent traces before convergence loop
if (!reportOnly) {
  const evResult = spawnTool('bin/refresh-evidence.cjs', ['--json']);
  if (evResult.ok) {
    process.stderr.write(TAG + ' Evidence refresh: ' + evResult.stdout.trim() + '\n');
  }
}
```

Place this BEFORE the for-loop, not inside it (evidence refresh is expensive and only needs to run once).

**Gap 5 — autoClose evidence readiness check:**

In the `autoClose()` function in nf-solve.cjs, after the existing per-model gate maturity block (~line 2660-2750), add an evidence readiness summary block:

```javascript
// Evidence readiness check — inform whether evidence supports promotion
try {
  const evidenceDir = path.join(ROOT, '.planning', 'formal', 'evidence');
  const evidenceFiles = [
    'instrumentation-map.json', 'state-candidates.json',
    'failure-taxonomy.json', 'trace-corpus-stats.json', 'proposed-metrics.json'
  ];
  let ready = 0;
  for (const ef of evidenceFiles) {
    const efPath = path.join(evidenceDir, ef);
    if (fs.existsSync(efPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(efPath, 'utf8'));
        // Check for non-empty primary array
        const arrays = Object.values(data).filter(v => Array.isArray(v));
        if (arrays.some(a => a.length > 0)) ready++;
      } catch (e) { /* fail-open */ }
    }
  }
  if (ready < 3) {
    actions.push(
      'Evidence readiness: ' + ready + '/5 files populated — ' +
      'gate promotion blocked until >= 3 evidence files have content. ' +
      'Run `node bin/refresh-evidence.cjs` to populate from traces.'
    );
  } else {
    actions.push('Evidence readiness: ' + ready + '/5 — sufficient for gate promotion');
  }
} catch (e) {
  // fail-open: evidence check is informational
}
```

This goes AFTER the per_model_gates block and BEFORE the function's return statement.
  </action>
  <verify>
Run `node bin/refresh-evidence.cjs --json` and confirm it outputs JSON with refreshed/failed counts.
Grep: `grep 'heatmap_total\|hmTotal' bin/nf-solve.cjs` returns the new grandTotal line.
Grep: `grep 'refresh-evidence' bin/nf-solve.cjs` returns the spawnTool call.
Grep: `grep 'Evidence readiness' bin/nf-solve.cjs` returns the autoClose check.
Run `node bin/nf-solve.cjs --report-only --fast 2>&1 | tail -20` and confirm it completes without errors (evidence refresh skipped in report-only mode).
  </verify>
  <done>
Git heatmap included in grand total display. Evidence files refreshed before convergence loop. autoClose reports evidence readiness status and warns when insufficient for promotion.
  </done>
</task>

</tasks>

<verification>
1. `node bin/compute-per-model-gates.cjs --json --dry-run` includes evidence_readiness in output
1b. `node bin/compute-per-model-gates.cjs --json --dry-run --skip-evidence` shows skipped:true with score 0
2. `grep 'per-model' bin/run-formal-verify.cjs` finds the STATIC_STEPS entry
3. `node bin/refresh-evidence.cjs --json` runs all 4 evidence generators successfully
4. `grep 'hmTotal\|heatmap_total' bin/nf-solve.cjs` shows heatmap in grand total
5. `grep 'Evidence readiness' bin/nf-solve.cjs` shows autoClose check
6. `node bin/nf-solve.cjs --report-only --fast 2>&1 | tail -5` exits without crash
</verification>

<success_criteria>
All 5 gaps closed: evidence files inform gate promotion decisions, per-model gates run in formal verify pipeline, git heatmap contributes to grand total, evidence files are refreshed from traces, and autoClose reports evidence readiness.
</success_criteria>

<output>
After completion, create `.planning/quick/236-wire-evidence-files-into-gate-promotion-/236-SUMMARY.md`
</output>

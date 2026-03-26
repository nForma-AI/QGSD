---
task: 353
title: Add state-space preflight guard to run-tlc.cjs — block HIGH risk models before launching Java
type: enhancement
risk: low
formal_artifacts: none
files_modified:
  - bin/run-tlc.cjs
  - bin/analyze-state-space.cjs
must_haves:
  - run-tlc.cjs calls analyze-state-space before spawning Java TLC process
  - If estimated state-space risk is HIGH (>10M states), run-tlc.cjs writes a check result with result:'error' and triage_tags:['state-space-blocked'] then exits 1 WITHOUT launching Java
  - Guard is bypassable via NF_SKIP_STATE_SPACE_GUARD=1 env var for intentional large model runs
  - analyze-state-space.cjs exports an analyzeModel(configName, root) function for programmatic use (currently CLI-only)
  - Guard emits a clear stderr message: "[run-tlc] BLOCKED: {configName} estimated {N} states (HIGH risk). Set NF_SKIP_STATE_SPACE_GUARD=1 to override."
  - Existing run-tlc.test.cjs tests still pass (pre-existing failures accepted)
---

# Plan

## Context

`NFHazardModelMerge.tla` ran for 25+ hours because its `computedRPN \in [hazards -> 0..1000]` domain created ~8 trillion initial states. `analyze-state-space.cjs` already estimates state-space and classifies risk as MINIMAL/LOW/MODERATE/HIGH, but it only runs as a reporting step AFTER TLC — not as a pre-flight guard. The fix: wire the estimate into `run-tlc.cjs` before Java launch.

## Tasks

### Task 1: Export analyzeModel from analyze-state-space.cjs

**File:** `bin/analyze-state-space.cjs`

Extract the per-model analysis logic into an exported function so `run-tlc.cjs` can call it without subprocess overhead:

```js
// At bottom, before main()
function analyzeModel(configName, projectRoot) {
  // Returns { estimated_states, risk_level, risk_reason, has_unbounded }
  // Reuses existing parseCfg, parseTypeOK, etc. functions already in this file
}
module.exports = { analyzeModel };
```

The function takes a config name (e.g., 'MCNFHazardModelMerge') and project root, returns the risk analysis for that specific model. Reuse existing internal functions (parseCfg, parseTypeOK, parseDomain, etc.).

Ensure `main()` only runs when called as CLI (wrap in `if (require.main === module)`).

### Task 2: Add preflight guard to run-tlc.cjs

**File:** `bin/run-tlc.cjs`

After resolving specPath/cfgPath but BEFORE the `spawnSync(java, ...)` call:

```js
// State-space preflight guard
if (!process.env.NF_SKIP_STATE_SPACE_GUARD) {
  try {
    const { analyzeModel } = require('./analyze-state-space.cjs');
    const analysis = analyzeModel(configName, ROOT);
    if (analysis && analysis.risk_level === 'HIGH') {
      process.stderr.write('[run-tlc] BLOCKED: ' + configName + ' estimated ' +
        (analysis.estimated_states || 'unbounded') + ' states (HIGH risk). ' +
        'Set NF_SKIP_STATE_SPACE_GUARD=1 to override.\n');
      writeCheckResult({
        tool: 'run-tlc', formalism: 'tla', result: 'error',
        check_id, surface, property,
        runtime_ms: 0,
        summary: 'error: state-space guard blocked ' + configName + ' (HIGH risk, ~' + analysis.estimated_states + ' states)',
        requirement_ids: getRequirementIds(check_id),
        triage_tags: ['state-space-blocked'],
        metadata: { config: configName, estimated_states: analysis.estimated_states, risk: 'HIGH' }
      });
      process.exit(1);
    }
  } catch (e) {
    // Fail-open: if analysis fails, proceed with TLC launch
    process.stderr.write('[run-tlc] State-space guard skipped: ' + e.message + '\n');
  }
}
```

## Verification

- Run `node bin/analyze-state-space.cjs --json` — still works as CLI
- `require('./analyze-state-space.cjs').analyzeModel` is a function
- Run `node bin/run-tlc.cjs MCNFHazardModelMerge` on the now-fixed model — should pass guard (MINIMAL risk) and proceed
- Grep for 'state-space-blocked' in run-tlc.cjs confirms guard exists
- Grep for 'NF_SKIP_STATE_SPACE_GUARD' confirms bypass exists

---
phase: quick-381
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/nf-solve.cjs
  - bin/coderlm-adapter.cjs
autonomous: true
requirements: [INTENT-01]
formal_artifacts:
  - module: solve-convergence
    invariants_checked:
      - EventualConvergence

must_haves:
  truths:
    - "When coderlm server is healthy and NF_CODERLM_ENABLED=true, dependency edges are queried from the coderlm /callers endpoint for each active layer's associated script file"
    - "Discovered caller relationships between layer scripts produce edges in the graph passed to computeWavesFromGraph"
    - "If coderlm queries fail or return no edges, the system falls through to the heuristic wave computation (fail-open, preserving EventualConvergence invariant)"
  artifacts:
    - path: "bin/coderlm-adapter.cjs"
      provides: "getCallersSync() method on adapter — synchronous wrapper around /callers endpoint using spawnSync pattern from healthSync()"
      contains: "getCallersSync"
    - path: "bin/nf-solve.cjs"
      provides: "queryEdgesSync() helper that maps layer keys to script files, queries callers, and builds edge array"
      contains: "queryEdgesSync"
  key_links:
    - from: "bin/nf-solve.cjs:queryEdgesSync"
      to: "bin/coderlm-adapter.cjs:getCallersSync"
      via: "adapter.getCallersSync(symbol, file) call"
      pattern: "getCallersSync"
    - from: "bin/nf-solve.cjs:queryEdgesSync"
      to: "bin/solve-wave-dag.cjs:computeWavesFromGraph"
      via: "edges array passed into graph object"
      pattern: "edges.*queryEdgesSync\\|queryEdgesSync.*edges"
---

<objective>
Wire coderlm adapter queries into the nf-solve dependency graph builder, replacing the empty placeholder edge array with actual inter-layer dependency edges discovered via the coderlm /callers endpoint.

Purpose: The graph-driven wave ordering currently uses an empty edge array, making computeWavesFromGraph produce a single wave with all layers (no dependency ordering). By querying the coderlm server for caller relationships between layer handler scripts, the graph edges will reflect actual code-level dependencies, producing more accurate wave ordering.

Output: Updated bin/nf-solve.cjs with queryEdgesSync() helper and updated bin/coderlm-adapter.cjs with getCallersSync() method.
</objective>

<execution_context>
@./.claude/nf/workflows/execute-plan.md
@./.claude/nf/templates/summary.md
</execution_context>

<context>
@bin/nf-solve.cjs (lines 5790-5870 — coderlm integration block)
@bin/coderlm-adapter.cjs (full — adapter with healthSync pattern)
@bin/solve-wave-dag.cjs (LAYER_DEPS, computeWavesFromGraph)
@.planning/formal/spec/solve-convergence/invariants.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add getCallersSync to coderlm adapter</name>
  <files>bin/coderlm-adapter.cjs</files>
  <action>
Add a `getCallersSync(symbol, file)` method to the adapter object returned by `createAdapter()`, following the exact same spawnSync pattern used by `healthSync()`.

The method should:
1. Return `{ error: 'disabled' }` if `!enabled` (same guard as async getCallers)
2. Build the URL: `host + '/callers?symbol=' + encodeURIComponent(symbol) + '&file=' + encodeURIComponent(file)`
3. Use `spawnSync('node', ['-e', script])` where `script` performs an HTTP GET to the URL with the configured `timeout`
4. The inner script should: make the HTTP request, parse JSON response, extract `callers` array, output `JSON.stringify({ callers: parsed.callers || [] })` to stdout
5. On success (status 0 + stdout), parse stdout as JSON and return `{ callers: [...] }`
6. On failure, return `{ error: 'sync-spawn-failed' }` or `{ error: 'parse' }`
7. Use `timeout + 1000` for the spawnSync timeout (same margin as healthSync)

Mirror the healthSync() implementation structure exactly — same variable naming, same error handling, same try/catch wrapping. The inner script should use the same `parseUrl` decomposition approach (inline the protocol/hostname/port/path values via JSON.stringify interpolation).
  </action>
  <verify>
Run: `node -e "const {createAdapter} = require('./bin/coderlm-adapter.cjs'); const a = createAdapter({enabled: false}); console.log(JSON.stringify(a.getCallersSync('foo', 'bar.js')))"` — should output `{"error":"disabled"}`.

Run: `node -e "const {createAdapter} = require('./bin/coderlm-adapter.cjs'); const a = createAdapter({enabled: true}); const r = a.getCallersSync('test', 'test.js'); console.log(JSON.stringify(r))"` — should return either `{ callers: [...] }` or `{ error: '...' }` (not throw).

Verify the method exists: `grep 'getCallersSync' bin/coderlm-adapter.cjs` returns matches.
  </verify>
  <done>
getCallersSync method exists on adapter, returns { callers: string[] } on success or { error: string } on failure, never throws (fail-open pattern preserved).
  </done>
</task>

<task type="auto">
  <name>Task 2: Wire queryEdgesSync into nf-solve graph builder</name>
  <files>bin/nf-solve.cjs</files>
  <action>
Two changes in bin/nf-solve.cjs:

**A. Define LAYER_SCRIPT_MAP constant** (near the imports at top, or near the coderlm integration block around line 5800). This maps layer keys to their primary script files so we know what file to query callers for:

```javascript
const LAYER_SCRIPT_MAP = {
  f_to_t: 'bin/formal-test-sync.cjs',
  c_to_f: 'bin/nf-solve.cjs',           // inline handler, no separate script
  t_to_c: 'bin/nf-solve.cjs',           // inline handler
  f_to_c: 'bin/nf-solve.cjs',           // inline handler
  d_to_c: 'bin/nf-solve.cjs',           // inline handler
  git_heatmap: 'bin/git-heatmap.cjs',
  c_to_r: 'bin/nf-solve.cjs',           // inline handler
  t_to_r: 'bin/nf-solve.cjs',           // inline handler
  d_to_r: 'bin/nf-solve.cjs',           // inline handler
  hazard_model: 'bin/hazard-model.cjs',
  l1_to_l3: 'bin/nf-solve.cjs',         // inline handler
  l3_to_tc: 'bin/generate-traceability-matrix.cjs',
  per_model_gates: 'bin/compute-per-model-gates.cjs',
  r_to_f: 'bin/nf-solve.cjs',           // inline handler
  r_to_d: 'bin/nf-solve.cjs',           // inline handler
  p_to_f: 'bin/nf-solve.cjs',           // inline handler
  h_to_m: 'bin/nf-solve.cjs',           // inline handler
  b_to_f: 'bin/nf-solve.cjs',           // inline handler
};
```

Note: Many layers are inline handlers within nf-solve.cjs itself. For those, the caller query on 'bin/nf-solve.cjs' will find cross-file callers. Layers with dedicated scripts (formal-test-sync, git-heatmap, hazard-model, traceability-matrix, compute-per-model-gates) have distinct files.

**B. Define queryEdgesSync function** (just before the coderlm integration block, around line 5800):

```javascript
function queryEdgesSync(adapter, activeLayerKeys) {
  const edges = [];
  // Build reverse map: script file -> [layer keys that use it]
  const scriptToLayers = {};
  for (const key of activeLayerKeys) {
    const script = LAYER_SCRIPT_MAP[key];
    if (!script) continue;
    if (!scriptToLayers[script]) scriptToLayers[script] = [];
    scriptToLayers[script].push(key);
  }
  
  // For each unique script file among active layers, query callers
  const queriedScripts = new Set();
  for (const key of activeLayerKeys) {
    const script = LAYER_SCRIPT_MAP[key];
    if (!script || queriedScripts.has(script)) continue;
    queriedScripts.add(script);
    
    // Query coderlm for callers of this script's main export
    const basename = path.basename(script, '.cjs');
    const result = adapter.getCallersSync(basename, script);
    if (result.error || !result.callers) continue;
    
    // Map caller file paths back to layer keys
    const targetLayers = scriptToLayers[script] || [];
    for (const callerFile of result.callers) {
      // Find which active layer this caller belongs to
      for (const otherKey of activeLayerKeys) {
        const otherScript = LAYER_SCRIPT_MAP[otherKey];
        if (otherScript && callerFile.includes(path.basename(otherScript))) {
          // otherKey's script calls into this script -> edge from otherKey to each target layer
          for (const target of targetLayers) {
            if (target !== otherKey) {
              edges.push({ from: otherKey, to: target });
            }
          }
        }
      }
    }
  }
  
  return edges;
}
```

**C. Replace the placeholder edge array** in the coderlm integration block (lines 5819-5824). Change:

```javascript
const graph = {
  nodes: activeLayerKeys,
  edges: []  // Placeholder: would be populated by adapter queries
};
```

To:

```javascript
// Query coderlm for inter-layer dependency edges
const discoveredEdges = queryEdgesSync(adapter, activeLayerKeys);
process.stderr.write(TAG + ' coderlm discovered ' + discoveredEdges.length + ' inter-layer edge(s)\n');

const graph = {
  nodes: activeLayerKeys,
  edges: discoveredEdges
};
```

**IMPORTANT constraints:**
- All code must be synchronous (uses spawnSync via getCallersSync, not async)
- Fail-open: if queryEdgesSync returns empty edges, computeWavesFromGraph still works (produces single wave with all nodes — same as current behavior)
- Do NOT modify the fallback path (lines 5845-5856) — heuristic wave computation must remain intact
- Do NOT modify computeWavesFromGraph itself
- Preserve the EventualConvergence invariant: the wave ordering change does not affect convergence because autoClose still processes all active layers regardless of wave order
  </action>
  <verify>
1. `grep 'queryEdgesSync' bin/nf-solve.cjs` — returns function definition and call site
2. `grep 'LAYER_SCRIPT_MAP' bin/nf-solve.cjs` — returns the map definition
3. `grep 'discoveredEdges' bin/nf-solve.cjs` — returns the variable usage
4. `grep 'edges: \[\]' bin/nf-solve.cjs` — should return NO matches (placeholder removed)
5. `npm run test:ci` — all tests pass (fail-open means no test breakage when coderlm is not running)
  </verify>
  <done>
The empty placeholder `edges: []` is replaced with edges discovered via coderlm adapter queries. When NF_CODERLM_ENABLED=true and coderlm is healthy, queryEdgesSync queries the /callers endpoint for each active layer's script file and builds inter-layer edges. When coderlm is unavailable or returns no callers, the edges array is empty and behavior is identical to the previous placeholder (fail-open preserved). The heuristic fallback path is unchanged.
  </done>
</task>

</tasks>

<verification>
1. With NF_CODERLM_ENABLED unset or 'false': nf-solve behaves exactly as before (coderlm block is skipped entirely)
2. With NF_CODERLM_ENABLED='true' but no coderlm server running: healthSync returns unhealthy, falls through to heuristic waves (fail-open)
3. With NF_CODERLM_ENABLED='true' and coderlm server running: queryEdgesSync queries /callers for active layer scripts, builds edges, passes to computeWavesFromGraph for graph-driven wave ordering
4. EventualConvergence invariant preserved: wave ordering affects dispatch order, not convergence (all layers are still processed)
</verification>

<success_criteria>
- `grep 'edges: \[\]' bin/nf-solve.cjs` returns no matches (placeholder removed)
- `grep 'getCallersSync' bin/coderlm-adapter.cjs` returns the sync method
- `grep 'queryEdgesSync' bin/nf-solve.cjs` returns definition + call
- `npm run test:ci` passes (no regressions)
- coderlm integration block logs discovered edge count to stderr
</success_criteria>

<output>
After completion, create `.planning/quick/381-wire-coderlm-adapter-queries-into-nf-sol/381-SUMMARY.md`
</output>

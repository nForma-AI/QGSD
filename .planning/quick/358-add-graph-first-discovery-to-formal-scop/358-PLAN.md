---
phase: quick-358
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/formal-graph-search.cjs
  - bin/formal-graph-search.test.cjs
  - bin/formal-scope-scan.cjs
  - bin/candidate-discovery.cjs
  - test/formal-scope-scan-semantic.test.cjs
autonomous: true
requirements: [INTENT-01]
formal_artifacts: none

must_haves:
  truths:
    - "formal-scope-scan.cjs Layer 1-2 discovers modules via graph walk from description tokens to formal_module nodes, not just from --files code_file nodes"
    - "Both formal-scope-scan.cjs and candidate-discovery.cjs import shared graph search functions from bin/formal-graph-search.cjs instead of duplicating BFS/proximity logic"
    - "Existing formal-scope-scan.cjs Layer 1-4 pipeline behavior is preserved — same results for same inputs, graph discovery adds to results"
    - "Existing candidate-discovery.cjs behavior is preserved — ensemble, filters, orphan detection unchanged"
  artifacts:
    - path: "bin/formal-graph-search.cjs"
      provides: "Unified graph search module with BFS reach, proximity scoring, keyword overlap"
      exports: ["reachFiltered", "proximityScore", "keywordOverlap", "graphDiscoverModules"]
      min_lines: 80
    - path: "bin/formal-graph-search.test.cjs"
      provides: "Tests for the extracted graph search module"
      min_lines: 60
  key_links:
    - from: "bin/formal-scope-scan.cjs"
      to: "bin/formal-graph-search.cjs"
      via: "require('./formal-graph-search.cjs')"
      pattern: "require.*formal-graph-search"
    - from: "bin/candidate-discovery.cjs"
      to: "bin/formal-graph-search.cjs"
      via: "require('./formal-graph-search.cjs')"
      pattern: "require.*formal-graph-search"
    - from: "bin/formal-scope-scan.cjs"
      to: "bin/formal-graph-search.cjs"
      via: "graphDiscoverModules() call in enrichWithProximityIndex"
      pattern: "graphDiscoverModules"
---

<objective>
Extract shared graph search logic from formal-scope-scan.cjs and candidate-discovery.cjs into a unified module (bin/formal-graph-search.cjs), then add graph-first module discovery to formal-scope-scan.cjs's Layer 1-2 pipeline so it can find relevant formal modules via proximity graph walks from description-derived concept/requirement nodes, not just from --files code_file nodes.

Purpose: Eliminate duplicated BFS/proximity code between the two scripts and improve formal-scope-scan.cjs recall by using graph walks from description tokens (concept nodes, requirement nodes) in addition to source file nodes.

Output: New shared module, updated consumers, tests proving both backward compatibility and new graph-first discovery.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@bin/formal-scope-scan.cjs
@bin/candidate-discovery.cjs
@bin/formal-proximity.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extract unified graph search module (bin/formal-graph-search.cjs)</name>
  <files>
    bin/formal-graph-search.cjs
    bin/formal-graph-search.test.cjs
  </files>
  <action>
Create `bin/formal-graph-search.cjs` as a CommonJS module with `'use strict'`. Extract and unify these functions:

1. **`reachFiltered(index, startKey, maxDepth, typeFilter)`** — Currently lives in formal-scope-scan.cjs (lines 168-195). BFS from a start node, returns nodes matching typeFilter within maxDepth hops. Copy as-is, it is well-factored.

2. **`proximityScore(index, fromKey, toKey)`** — Currently lives in formal-scope-scan.cjs (lines 201-243). BFS with weighted edge propagation and decay. Copy as-is. This is the scope-scan variant (simpler than formal-proximity.cjs's `proximity()` function which has method configs/tfidf/embedding blending). Keep both — the scope-scan variant is lightweight and purpose-built for enrichment scoring, while `proximity()` in formal-proximity.cjs is the full ensemble scorer. Do NOT replace `proximity()` — it serves a different use case.

3. **`keywordOverlap(modelPath, reqText)`** — Currently lives in candidate-discovery.cjs (lines 25-61). Keyword pre-screen for filtering false positives. Move here so formal-scope-scan.cjs can also use it for graph-discovered modules.

4. **`graphDiscoverModules(index, tokens, description)`** — NEW function. This is the graph-first discovery logic to be used by formal-scope-scan.cjs Layer 2. Algorithm:
   - For each token in `tokens`, check if `concept::{token}` exists in the index. If yes, BFS from it (maxDepth=2, typeFilter=['formal_module']) to find related modules.
   - For each token, also check partial matches against concept node IDs (e.g., token "breaker" matches concept "circuit-breaker"). Use `Object.keys(index.nodes).filter(k => k.startsWith('concept::') && k.toLowerCase().includes(token))`.
   - Collect all discovered module names with their discovery path (which concept led to them).
   - Deduplicate by module name, keeping the shortest path.
   - Return `Array<{ module: string, discoveredVia: string, depth: number }>`.
   - This is fail-open: if index is null/missing/malformed, return [].

Export: `{ reachFiltered, proximityScore, keywordOverlap, graphDiscoverModules }`.

Create `bin/formal-graph-search.test.cjs` with tests:
- `reachFiltered`: Build a small 4-node graph, verify BFS finds correct nodes within depth, respects typeFilter.
- `proximityScore`: Build a 3-node linear graph (A->B->C), verify score from A to C is > 0, score to nonexistent node is 0.
- `keywordOverlap`: Mock fs.readFileSync to return known content, verify overlap detection and zero-overlap rejection. Test empty/missing file returns true (fail-open).
- `graphDiscoverModules`: Build a graph with concept::breaker -> formal_module::breaker-mod, verify discovery. Test partial match (token "break" finds concept "circuit-breaker"). Test empty index returns [].
  </action>
  <verify>
    Run: `node -e "const m = require('./bin/formal-graph-search.cjs'); console.log(Object.keys(m))"` — should print reachFiltered, proximityScore, keywordOverlap, graphDiscoverModules.
    Run: `npx jest bin/formal-graph-search.test.cjs --no-cache` — all tests pass.
  </verify>
  <done>
    bin/formal-graph-search.cjs exports 4 functions. All tests in bin/formal-graph-search.test.cjs pass. No other files modified yet.
  </done>
</task>

<task type="auto">
  <name>Task 2: Wire shared module into formal-scope-scan.cjs and candidate-discovery.cjs</name>
  <files>
    bin/formal-scope-scan.cjs
    bin/candidate-discovery.cjs
    test/formal-scope-scan-semantic.test.cjs
  </files>
  <action>
**In formal-scope-scan.cjs:**

1. Add `const { reachFiltered, proximityScore, graphDiscoverModules } = require('./formal-graph-search.cjs');` near the top imports.

2. Remove the local `reachFiltered()` function (lines 168-195) and the local `proximityScore()` function (lines 201-243). These are now imported.

3. In `enrichWithProximityIndex()`, ADD graph-first discovery from description tokens BEFORE the existing --files walk. Insert this block at the start of the function (after loading the index and creating matchedModules set):

```javascript
// Graph-first discovery: walk from description-derived concept nodes to formal_module nodes
if (tokens.length > 0) {
  const discovered = graphDiscoverModules(index, tokens, '');
  for (const d of discovered) {
    if (!matchedModules.has(d.module)) {
      matchedModules.add(d.module);
      const invariantsPath = '.planning/formal/spec/' + d.module + '/invariants.md';
      matches.push({
        module: d.module,
        path: invariantsPath,
        matched_by: 'graph_discovery',
        discovered_via: d.discoveredVia
      });
    }
  }
}
```

4. Update the sort weights in `enrichWithProximityIndex()` to include graph_discovery between proximity_graph and module_name:
```javascript
const weights = { source_file: 4, concept: 3, module_name: 2, graph_discovery: 1, proximity_graph: 0 };
```

5. Verify the existing `enrichWithProximityIndex` function still passes its `--files` walk logic unchanged. The graph-first block is ADDITIVE — it discovers modules the token matching in Layer 1 might have missed.

**In candidate-discovery.cjs:**

1. Add `const { keywordOverlap } = require('./formal-graph-search.cjs');` near the top imports.

2. Remove the local `keywordOverlap()` function (lines 25-61). The imported version is identical.

3. Verify that `discoverCandidates()` still references `keywordOverlap` in the pre-filter (it should work transparently since the function signature is identical).

**In test/formal-scope-scan-semantic.test.cjs:**

1. Check if any tests mock or reference the now-removed `reachFiltered` or `proximityScore` from formal-scope-scan.cjs exports. If so, update them to import from `formal-graph-search.cjs` instead.

2. Add a test for graph_discovery matched_by: create a proximity index with concept::breaker -> formal_module::breaker, call enrichWithProximityIndex with tokens=['breaker'] and empty files, verify a match with matched_by='graph_discovery' is returned.

**Guard against re-inlining:** After all edits, verify that formal-scope-scan.cjs does NOT contain its own `function reachFiltered` or `function proximityScore` definitions, and candidate-discovery.cjs does NOT contain its own `function keywordOverlap` definition.
  </action>
  <verify>
    Run: `grep -c 'function reachFiltered' bin/formal-scope-scan.cjs` — should print 0.
    Run: `grep -c 'function proximityScore' bin/formal-scope-scan.cjs` — should print 0.
    Run: `grep -c 'function keywordOverlap' bin/candidate-discovery.cjs` — should print 0.
    Run: `grep 'require.*formal-graph-search' bin/formal-scope-scan.cjs bin/candidate-discovery.cjs` — should show both files importing from it.
    Run: `npx jest test/formal-scope-scan-semantic.test.cjs --no-cache` — all tests pass.
    Run: `npx jest bin/candidate-discovery.test.cjs --no-cache` — all tests pass (backward compat).
    Run: `npx jest bin/formal-graph-search.test.cjs --no-cache` — all tests still pass.
    Run: `node bin/formal-scope-scan.cjs --description "circuit breaker timeout" --format json` — returns results (should include graph_discovery matches if breaker concept exists in proximity index).
    Run: `node bin/candidate-discovery.cjs --json --top 5 2>/dev/null | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log('candidates:', d.candidates?.length ?? d.metadata?.candidates_found)"` — produces output without errors.
  </verify>
  <done>
    formal-scope-scan.cjs imports reachFiltered, proximityScore, graphDiscoverModules from formal-graph-search.cjs and no longer defines them locally. candidate-discovery.cjs imports keywordOverlap from formal-graph-search.cjs and no longer defines it locally. Graph-first discovery adds matched_by="graph_discovery" results to Layer 2. All existing tests pass. CLI invocations produce valid output.
  </done>
</task>

</tasks>

<verification>
1. No duplicated graph search functions: `grep -c 'function reachFiltered\|function proximityScore' bin/formal-scope-scan.cjs` returns 0.
2. No duplicated keyword overlap: `grep -c 'function keywordOverlap' bin/candidate-discovery.cjs` returns 0.
3. Shared module wired: `grep -l 'formal-graph-search' bin/formal-scope-scan.cjs bin/candidate-discovery.cjs` returns both files.
4. All test suites pass: `npx jest bin/formal-graph-search.test.cjs bin/candidate-discovery.test.cjs test/formal-scope-scan-semantic.test.cjs --no-cache`
5. CLI smoke tests: both `node bin/formal-scope-scan.cjs --description "test" --format json` and `node bin/candidate-discovery.cjs --json --top 3` produce valid JSON output.
</verification>

<success_criteria>
- bin/formal-graph-search.cjs exists with 4 exported functions (reachFiltered, proximityScore, keywordOverlap, graphDiscoverModules)
- formal-scope-scan.cjs uses graph-first discovery in Layer 2 via graphDiscoverModules, producing matched_by="graph_discovery" results
- No duplicated BFS/proximity/keyword code between the three files
- All tests pass (new + existing)
- Both CLI tools produce correct output
</success_criteria>

<output>
After completion, create `.planning/quick/358-add-graph-first-discovery-to-formal-scop/358-SUMMARY.md`
</output>

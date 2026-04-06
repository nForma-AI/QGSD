---
phase: quick-380
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/coderlm-adapter.cjs
  - bin/coderlm-adapter.test.cjs
  - bin/solve-wave-dag.cjs
  - bin/solve-wave-dag.test.cjs
  - bin/nf-solve.cjs
  - docs/coderlm-integration.md
autonomous: true
requirements: [INTENT-01]
formal_artifacts: none

must_haves:
  truths:
    - "coderlm adapter health-checks a configurable host and returns healthy/unhealthy status"
    - "coderlm adapter wraps getCallers, getImplementation, findTests, peek endpoints with timeout and error handling"
    - "computeWaves produces correct wave order from an arbitrary dependency graph with SCC collapsing"
    - "computeWaves existing behavior is identical when no dependency graph is provided (regression parity)"
    - "nf-solve uses coderlm adapter when NF_CODERLM_ENABLED=true and host is reachable, falls back to heuristics otherwise"
  artifacts:
    - path: "bin/coderlm-adapter.cjs"
      provides: "coderlm HTTP adapter with health check and symbol query wrappers"
      exports: ["createAdapter", "healthCheck"]
    - path: "bin/coderlm-adapter.test.cjs"
      provides: "Unit tests for adapter: success, timeout, 4xx/5xx responses"
      min_lines: 80
    - path: "bin/solve-wave-dag.cjs"
      provides: "Extended computeWaves with graph-driven variant (SCC + topo sort)"
      exports: ["computeWaves", "computeWavesFromGraph", "getLayerDeps", "LAYER_DEPS", "MAX_PER_WAVE"]
    - path: "bin/solve-wave-dag.test.cjs"
      provides: "Tests for graph-driven scheduler: SCC, topo ordering, MAX_PER_WAVE, priority weights, regression parity"
      min_lines: 150
    - path: "docs/coderlm-integration.md"
      provides: "Developer docs for coderlm env vars and test instructions"
  key_links:
    - from: "bin/nf-solve.cjs"
      to: "bin/coderlm-adapter.cjs"
      via: "require and conditional use in diagnostic phase"
      pattern: "coderlm-adapter"
    - from: "bin/nf-solve.cjs"
      to: "bin/solve-wave-dag.cjs"
      via: "computeWavesFromGraph call when dependency graph available"
      pattern: "computeWavesFromGraph"
    - from: "bin/coderlm-adapter.cjs"
      to: "NF_CODERLM_HOST env var"
      via: "process.env.NF_CODERLM_HOST"
      pattern: "NF_CODERLM_HOST"
  consumers:
    - artifact: "bin/coderlm-adapter.cjs"
      consumed_by: "bin/nf-solve.cjs"
      integration: "require() call in diagnostic phase with fallback"
      verify_pattern: "coderlm-adapter"
---

<objective>
Integrate a coderlm adapter and graph-driven computeWaves variant into nf:solve.

Purpose: Enable nf:solve to optionally consume an indexed symbol/call graph (coderlm) for more precise dependency edges and schedule remediation waves using SCC-collapsed topological ordering, while preserving full backward compatibility when coderlm is unavailable.

Output: coderlm adapter module, extended solve-wave-dag with graph-driven scheduling, nf-solve integration with fallback, comprehensive unit tests, developer documentation.
</objective>

<execution_context>
@./.claude/nf/workflows/execute-plan.md
@./.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@bin/solve-wave-dag.cjs
@bin/solve-wave-dag.test.cjs
@bin/nf-solve.cjs (lines 50-60 for requires, lines 5790-5815 for computeWaves integration point)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create coderlm adapter module with health check and symbol query wrappers</name>
  <files>bin/coderlm-adapter.cjs, bin/coderlm-adapter.test.cjs</files>
  <action>
Create `bin/coderlm-adapter.cjs` — a CommonJS module (`'use strict'`) that provides an HTTP adapter for a coderlm server.

**Configuration:**
- `NF_CODERLM_HOST` env var (default: `http://localhost:8787`)
- `NF_CODERLM_ENABLED` env var (default: `false`; must be `'true'` to activate)
- All HTTP calls use Node.js built-in `http`/`https` modules (no external dependencies)
- Default timeout: 5000ms for queries, 2000ms for health checks

**Exports:**
- `createAdapter(opts?)` — factory returning an adapter object with methods below. `opts` can override `host`, `timeout`, `enabled`.
- `healthCheck(host?, timeout?)` — standalone health check, returns `{ healthy: boolean, latencyMs: number, error?: string }`

**Adapter methods (returned by createAdapter):**
- `health()` — calls `GET /health`, returns `{ healthy, latencyMs, error? }`
- `getCallers(symbol, file)` — calls `GET /callers?symbol=...&file=...`, returns `{ callers: string[] }`
- `getImplementation(symbol)` — calls `GET /implementation?symbol=...`, returns `{ file: string, line: number }`
- `findTests(file)` — calls `GET /tests?file=...`, returns `{ tests: string[] }`
- `peek(file, startLine, endLine)` — calls `GET /peek?file=...&start=...&end=...`, returns `{ lines: string[] }`

**Error handling:**
- All methods return a result object with an `error` property on failure (never throw)
- Timeout produces `{ error: 'timeout' }` for queries, `{ healthy: false, error: 'timeout' }` for health
- HTTP 4xx/5xx produces `{ error: 'HTTP {statusCode}' }` (or `{ healthy: false, error: 'HTTP {statusCode}' }`)
- Connection refused produces `{ error: 'ECONNREFUSED' }` (or `{ healthy: false, ... }`)

**Create `bin/coderlm-adapter.test.cjs`** using `node:test` and `node:assert/strict` (matching existing test patterns in solve-wave-dag.test.cjs):
- Test `createAdapter` returns object with all expected methods
- Test `healthCheck` success (mock HTTP server returning 200)
- Test `healthCheck` timeout (mock server that never responds, verify `healthy: false, error: 'timeout'`)
- Test 4xx/5xx responses return error objects (not throws)
- Test `getCallers` success path with mock JSON response
- Test `NF_CODERLM_ENABLED=false` causes adapter methods to return `{ error: 'disabled' }`
- Use `node:http.createServer` for mock HTTP server (no external test dependencies)

Follow fail-open pattern per security rules. Use CommonJS per coding-style rules.
  </action>
  <verify>
Run: `node --test bin/coderlm-adapter.test.cjs`
All tests pass. No external dependencies added.
Verify exports: `node -p "const m = require('./bin/coderlm-adapter.cjs'); [typeof m.createAdapter, typeof m.healthCheck]"` outputs `[ 'function', 'function' ]`
  </verify>
  <done>
coderlm adapter module exists with health check + 4 query methods, all returning result objects (never throwing). Test file covers success, timeout, 4xx/5xx, disabled states. All tests pass.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add graph-driven computeWavesFromGraph to solve-wave-dag with SCC collapsing and topological sorting</name>
  <files>bin/solve-wave-dag.cjs, bin/solve-wave-dag.test.cjs</files>
  <action>
Extend `bin/solve-wave-dag.cjs` with a new exported function `computeWavesFromGraph`. The existing `computeWaves` function MUST NOT be modified (regression parity).

**New function: `computeWavesFromGraph(graph, priorityWeights = {})`**

Parameters:
- `graph` — object `{ nodes: string[], edges: Array<{from: string, to: string}> }` where `from` depends on `to` (i.e., `from` must run after `to`)
- `priorityWeights` — optional `{ [node]: number }` for intra-wave ordering (same semantics as existing computeWaves)

Algorithm:
1. **Build adjacency list** from edges (forward deps: node -> [nodes it depends on])
2. **SCC detection via Tarjan's algorithm** — collapse strongly connected components into single composite nodes. Composite node name: sorted member names joined by `+` (e.g., `"a+b+c"`)
3. **Build condensation DAG** — edges between SCCs (no self-loops)
4. **Topological sort** of condensation DAG using longest-path wave assignment (same approach as existing computeWaves)
5. **Group by wave number**, sort within wave by priority weight descending then alphabetical
6. **Split by MAX_PER_WAVE** (reuse existing constant = 3)
7. **Sequential chain compaction** (same logic as existing computeWaves — merge consecutive single-node waves)
8. Return `Array<{wave: number, layers: string[], sequential?: boolean}>` — same shape as computeWaves output. For SCC nodes, the `layers` array contains the composite `+`-joined name.

Add to `module.exports`: `computeWavesFromGraph`.

**Extend `bin/solve-wave-dag.test.cjs`** with new describe blocks:

```
describe('computeWavesFromGraph — graph-driven scheduling')
```

Test cases:
- Empty graph returns `[]`
- Linear chain `A -> B -> C` produces 3 waves (or sequential compaction)
- Diamond `A -> B, A -> C, B -> D, C -> D` produces correct topological waves
- **SCC/cycle detection**: graph with cycle `A -> B -> C -> A` plus independent `D` — SCC `A+B+C` in one wave, `D` in same or different wave
- **MAX_PER_WAVE enforcement**: graph with 5 independent nodes produces 2 waves (3+2)
- **Priority weight influence**: among 3 independent nodes, weighted node appears first in wave
- **Regression parity**: existing computeWaves tests still pass unchanged
  </action>
  <verify>
Run: `node --test bin/solve-wave-dag.test.cjs`
All tests pass (both existing and new).
Verify export: `node -p "typeof require('./bin/solve-wave-dag.cjs').computeWavesFromGraph"` outputs `function`
Verify existing export unchanged: `node -p "typeof require('./bin/solve-wave-dag.cjs').computeWaves"` outputs `function`
  </verify>
  <done>
`computeWavesFromGraph` implements Tarjan SCC collapsing + topological wave assignment + MAX_PER_WAVE splitting + sequential compaction. All new tests pass. All existing computeWaves tests pass unchanged (regression parity confirmed).
  </done>
</task>

<task type="auto">
  <name>Task 3: Integrate coderlm adapter into nf-solve diagnostics with fallback, add developer docs</name>
  <files>bin/nf-solve.cjs, docs/coderlm-integration.md</files>
  <action>
**Integration in `bin/nf-solve.cjs`:**

1. Add require at top (near line 58): `const { createAdapter } = require('./coderlm-adapter.cjs');`

2. Add `computeWavesFromGraph` to the existing require on line 58:
   `const { computeWaves, computeWavesFromGraph } = require('./solve-wave-dag.cjs');`

3. In the wave computation block (around line 5796-5811), add coderlm graph-driven path BEFORE the existing hypothesis-driven path. The logic:

```javascript
// coderlm graph-driven wave computation (optional, fail-open)
let waveOrder = null;
if (process.env.NF_CODERLM_ENABLED === 'true') {
  try {
    const adapter = createAdapter();
    const healthResult = adapter.healthSync(); // synchronous wrapper
    if (healthResult.healthy) {
      // Build dependency graph from coderlm queries for active layers
      // Query adapter for inter-layer edges based on active residual layers
      // const graph = { nodes: [...activeLayerKeys], edges: [...discoveredEdges] };
      // waveOrder = computeWavesFromGraph(graph, priorityWeights);
      process.stderr.write(TAG + ' coderlm graph-driven wave ordering active\n');
    } else {
      process.stderr.write(TAG + ' coderlm unhealthy, falling back to heuristic waves\n');
    }
  } catch (e) {
    process.stderr.write(TAG + ' WARNING: coderlm integration failed: ' + e.message + ', falling back\n');
  }
}
```

IMPORTANT: Since nf-solve.cjs uses synchronous patterns throughout (spawnSync, no async/await), add a `healthSync()` method to the adapter that performs the HTTP call synchronously. Implement this using `spawnSync('node', ['-e', script])` where the inner script does the async HTTP call and writes JSON to stdout. This is the established pattern for sync HTTP in this codebase. Alternatively, add a `healthCheckSync` export to coderlm-adapter.cjs that wraps the async call.

If the coderlm path does not produce a waveOrder (unhealthy, error, or disabled), fall through to the existing hypothesis-driven `computeWaves` path (lines 5798-5811). This preserves full backward compatibility — the existing code remains as the else/fallback branch.

**Documentation — `docs/coderlm-integration.md`:**

Create developer documentation covering:
- Overview: what coderlm is and why nf:solve uses it (indexed symbol/call graph for precise dependency edges)
- Environment variables: `NF_CODERLM_HOST` (default localhost:8787), `NF_CODERLM_ENABLED` (default false)
- How to run a local coderlm server (point to coderlm repo, note it is a Rust binary)
- Fallback behavior: when coderlm is unavailable, nf:solve uses existing LAYER_DEPS heuristics unchanged
- Testing: how to run adapter tests (`node --test bin/coderlm-adapter.test.cjs`), how to run scheduler tests (`node --test bin/solve-wave-dag.test.cjs`)
- Architecture diagram (text-based): coderlm server <- adapter <- nf-solve -> solve-wave-dag

Do NOT add coderlm as a package.json dependency. This is a pure HTTP integration with no npm packages.
  </action>
  <verify>
Run: `node --test bin/coderlm-adapter.test.cjs && node --test bin/solve-wave-dag.test.cjs`
All tests pass.
Verify require wiring: `node -e "const m = require('./bin/nf-solve.cjs')" 2>&1 | head -5` does not show module-not-found errors.
Verify fallback: with NF_CODERLM_ENABLED unset, nf-solve uses existing computeWaves path (check stderr output).
Verify docs exist: `test -f docs/coderlm-integration.md && echo OK`
Run full test suite: `npm run test:ci` — no regressions.
  </verify>
  <done>
nf-solve.cjs conditionally uses coderlm adapter when NF_CODERLM_ENABLED=true, falls back to existing heuristic waves otherwise. Developer docs describe env vars, setup, and testing. Full test suite passes with no regressions.
  </done>
</task>

</tasks>

<verification>
1. `node --test bin/coderlm-adapter.test.cjs` — adapter tests pass (success, timeout, 4xx/5xx, disabled)
2. `node --test bin/solve-wave-dag.test.cjs` — all existing + new graph-driven tests pass
3. `npm run test:ci` — full suite passes, no regressions
4. With `NF_CODERLM_ENABLED` unset: nf-solve produces identical wave ordering to before (regression parity)
5. `grep 'coderlm-adapter' bin/nf-solve.cjs` — adapter is wired into nf-solve
6. `grep 'computeWavesFromGraph' bin/solve-wave-dag.cjs` — graph-driven function exported
</verification>

<success_criteria>
- coderlm adapter module provides health check + 4 query endpoints with fail-open error handling
- computeWavesFromGraph correctly collapses SCCs, produces topological wave assignments, respects MAX_PER_WAVE
- Existing computeWaves behavior is byte-for-byte identical (no modifications to existing function)
- nf-solve uses coderlm when available, falls back cleanly when not
- All tests pass including full CI suite
- Developer docs explain env vars and testing
</success_criteria>

<output>
After completion, create `.planning/quick/380-integrate-coderlm-adapter-and-graph-driv/380-SUMMARY.md`
</output>

---
phase: quick-187
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/nf-solve.cjs
  - bin/nf-solve.test.cjs
autonomous: true
requirements: [QUICK-187]
formal_artifacts: none

must_haves:
  truths:
    - "sweepTtoC collects V8 line-level coverage when runner is node-test"
    - "crossReferenceFormalCoverage returns per-property coverage ratios against recipe source_files"
    - "Properties with passing tests but 0% source_file coverage are flagged as false greens"
    - "T->C residual detail includes formal_coverage sub-object when coverage data is available"
    - "Coverage collection failure does not break existing T->C pass/fail counting (fail-open)"
    - "formatReport and formatJSON include F->T->C coverage summary when present"
  artifacts:
    - path: "bin/nf-solve.cjs"
      provides: "V8 coverage collection in sweepTtoC, crossReferenceFormalCoverage function, updated formatReport/formatJSON"
      contains: "NODE_V8_COVERAGE"
    - path: "bin/nf-solve.test.cjs"
      provides: "Tests for crossReferenceFormalCoverage and V8 coverage integration"
      contains: "crossReferenceFormalCoverage"
  key_links:
    - from: "bin/nf-solve.cjs sweepTtoC()"
      to: "NODE_V8_COVERAGE temp dir"
      via: "env var set before spawnSync, read after"
      pattern: "NODE_V8_COVERAGE"
    - from: "bin/nf-solve.cjs crossReferenceFormalCoverage()"
      to: "loadFormalTestSync() recipes"
      via: "reads recipe.source_files_absolute"
      pattern: "source_files_absolute"
    - from: "bin/nf-solve.cjs crossReferenceFormalCoverage()"
      to: "V8 coverage JSON files"
      via: "reads url field from coverage result entries"
      pattern: "coverage.*result.*url"
---

<objective>
Add V8 line-level coverage collection to the T->C sweep and build a crossReferenceFormalCoverage() function that detects "false green" properties -- formal properties that have passing tests but whose tests never exercise the actual source_files listed in the formal-test-sync recipe.

Purpose: Close the full Formal->Test->Code traceability chain. Currently T->C only checks pass/fail; a test can pass while covering zero lines of the implementing code, creating a blind spot in the consistency solver.

Output: Updated bin/nf-solve.cjs with coverage collection, cross-referencing logic, and display integration. Tests in bin/nf-solve.test.cjs.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@bin/nf-solve.cjs
@bin/nf-solve.test.cjs
@bin/formal-test-sync.cjs (recipe structure: source_files, source_files_absolute)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add V8 coverage collection to sweepTtoC and build crossReferenceFormalCoverage</name>
  <files>bin/nf-solve.cjs</files>
  <action>
  Three changes to bin/nf-solve.cjs:

  **1. V8 coverage collection in sweepTtoC() (lines ~750-753, the node-test spawnSync call):**

  Before the `spawnSync(process.execPath, ['--test'], spawnOpts)` call for node-test runner:
  - Create a temp directory via `fs.mkdtempSync(path.join(os.tmpdir(), 'nf-solve-cov-'))`
  - Add `NODE_V8_COVERAGE: covDir` to the spawn environment (merge with `process.env`)
  - After spawnSync completes and TAP parsing is done, read all `.json` files from covDir
  - Parse each JSON file and collect into a `coverageData` array
  - Clean up covDir with `fs.rmSync(covDir, { recursive: true, force: true })`
  - Wrap ALL coverage logic in try/catch — if anything fails, set `coverageData = null` and continue (fail-open)
  - Add `require('os')` at the top of the file (near existing requires)
  - Attach `coverageData` to the return object's detail: `detail.v8_coverage = coverageData` (or null if failed/unavailable)

  **2. New function crossReferenceFormalCoverage(v8CoverageData):**

  Place after sweepTtoC, before sweepFtoC (~line 823).

  Logic:
  - If `v8CoverageData` is null/undefined, return `{ available: false }`
  - Call `loadFormalTestSync()` to get the sync data
  - Extract recipes: `syncData.recipes || []`
  - Build a Set of covered absolute file paths from V8 data: iterate `v8CoverageData`, for each entry iterate `result` array, extract `url` (strip `file://` prefix), normalize with `path.resolve()`. A file is "covered" if ANY function range has `count > 0` (not just present in the coverage output)
  - For each recipe that has `source_files_absolute` and a test file:
    - Count how many of `source_files_absolute` appear in the covered files set
    - Compute ratio: coveredCount / source_files_absolute.length
    - If ratio === 0 and the recipe has a test → mark as "false_green"
  - Return:
    ```
    {
      available: true,
      total_properties: N,
      properties_with_tests: N,
      false_greens: [{ property: string, test_file: string, source_files: string[], covered: 0 }],
      coverage_ratios: [{ property: string, ratio: number }],
      summary: { fully_covered: N, partially_covered: N, uncovered: N }
    }
    ```

  **3. Integrate into computeResidual and display:**

  In `computeResidual()` (~line 1833): after the `sweepTtoC()` call, if `t_to_c.detail.v8_coverage` exists, call `crossReferenceFormalCoverage(t_to_c.detail.v8_coverage)` and attach result as `t_to_c.detail.formal_coverage`.

  In `formatReport()` (~line 2033, after the T->C row): if `finalResidual.t_to_c.detail.formal_coverage` exists and `available === true`, add a sub-line:
  `  F->T->C coverage: {fully_covered}/{total_properties} properties fully traced ({false_greens.length} false greens)`

  In `formatJSON()`: the formal_coverage object is already in t_to_c.detail, so it flows through automatically.

  Add `crossReferenceFormalCoverage` to module.exports.

  **Important constraints:**
  - Only collect coverage for `node-test` runner (not jest, not `runner: none`)
  - The coverage collection must NOT increase the spawn timeout (keep existing 120s)
  - The temp dir cleanup must happen in a finally block to prevent leaks
  - Do NOT modify the residual number for T->C — false greens are informational, not residual-increasing
  </action>
  <verify>
  Run `node -e "const s = require('./bin/nf-solve.cjs'); console.log(typeof s.crossReferenceFormalCoverage)"` — should print "function".

  Run `grep -c NODE_V8_COVERAGE bin/nf-solve.cjs` — should be >= 1.

  Run `grep -c crossReferenceFormalCoverage bin/nf-solve.cjs` — should be >= 3 (definition + computeResidual call + exports).
  </verify>
  <done>
  sweepTtoC sets NODE_V8_COVERAGE env var for node-test runner, collects coverage JSON, and attaches to detail.
  crossReferenceFormalCoverage reads recipes from loadFormalTestSync, cross-references source_files_absolute against V8 coverage URLs, identifies false greens.
  computeResidual wires coverage into t_to_c.detail.formal_coverage.
  formatReport shows F->T->C coverage summary line.
  All coverage logic is fail-open (try/catch, null fallback).
  </done>
</task>

<task type="auto">
  <name>Task 2: Add tests for crossReferenceFormalCoverage and V8 coverage integration</name>
  <files>bin/nf-solve.test.cjs</files>
  <action>
  Add new test category `TC-COV` to bin/nf-solve.test.cjs.

  Import `crossReferenceFormalCoverage` from `./nf-solve.cjs` (add to existing destructured import).

  **Tests to add:**

  1. `TC-COV-1: crossReferenceFormalCoverage returns unavailable when null input` — call with null, assert `{ available: false }`.

  2. `TC-COV-2: crossReferenceFormalCoverage returns unavailable when undefined input` — call with undefined, assert `{ available: false }`.

  3. `TC-COV-3: crossReferenceFormalCoverage returns available with empty coverage array` — call with `[]`, assert `available === true` and check that `false_greens` is an array (may be empty if no recipes found, which is fine for unit test).

  4. `TC-COV-4: crossReferenceFormalCoverage identifies false green when source file not in coverage` — This is the key test. Mock approach: since `crossReferenceFormalCoverage` calls `loadFormalTestSync()` internally which spawns a process, and we cannot easily mock that, test the function's behavior with actual V8 coverage data format:
     - Create a minimal V8 coverage array: `[{ result: [{ url: 'file:///some/other/file.js', functions: [{ ranges: [{ startOffset: 0, endOffset: 100, count: 1 }] }] }] }]`
     - Call `crossReferenceFormalCoverage(coverageArray)`
     - Assert `available === true`
     - Assert return has `summary` object with numeric fields

  5. `TC-COV-5: sweepTtoC detail contains v8_coverage field` — Run actual `sweepTtoC()` (already done in existing tests), check that `detail` has a `v8_coverage` key (value may be null if coverage collection fails in test environment, which is acceptable — just check the key exists).

  Keep tests lightweight. The cross-reference function depends on loadFormalTestSync which may return null in test context — the function should handle that gracefully (return available: false or empty results).
  </action>
  <verify>
  Run `node --test bin/nf-solve.test.cjs 2>&1 | tail -20` — all tests pass including new TC-COV tests.
  </verify>
  <done>
  5 new tests in TC-COV category covering: null/undefined input, empty coverage array, V8 format parsing, and sweepTtoC integration.
  All existing tests continue to pass (no regressions).
  </done>
</task>

</tasks>

<verification>
1. `node --test bin/nf-solve.test.cjs` — all tests pass (0 failures)
2. `node bin/nf-solve.cjs --report-only 2>&1 | grep -i "coverage\|false.green\|F->T->C"` — shows coverage line if formal-test-sync data available
3. `node -e "const s = require('./bin/nf-solve.cjs'); const r = s.crossReferenceFormalCoverage(null); console.log(JSON.stringify(r))"` — returns `{"available":false}` (fail-open)
4. `node -e "const s = require('./bin/nf-solve.cjs'); const r = s.crossReferenceFormalCoverage([]); console.log(r.available)"` — returns `true`
</verification>

<success_criteria>
- V8 coverage is collected via NODE_V8_COVERAGE env var during node-test execution in sweepTtoC
- crossReferenceFormalCoverage cross-references coverage data against formal-test-sync recipe source_files
- False green properties (test passes, 0% source coverage) are identified and listed
- Coverage failure does not break existing T->C sweep (fail-open behavior verified)
- formatReport includes F->T->C coverage summary when data is available
- All tests pass including 5 new TC-COV tests
</success_criteria>

<output>
After completion, create `.planning/quick/187-add-v8-line-level-coverage-to-t-c-sweep-/187-SUMMARY.md`
</output>

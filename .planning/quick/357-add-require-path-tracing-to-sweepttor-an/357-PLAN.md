---
phase: quick-357
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - test/b-to-f-remediate.test.cjs
  - test/b-to-f-sweep.test.cjs
  - test/bug-context-normalization.test.cjs
  - test/bug-lookup.test.cjs
  - test/cross-model-regression.test.cjs
  - test/debug-verdict-reporting.test.cjs
  - test/model-driven-fix-orchestrator.test.cjs
  - test/model-reproduction.test.cjs
  - bin/nf-solve.cjs
  - bin/nf-solve.test.cjs
autonomous: true
formal_artifacts: none
requirements: [TLINK-02]

must_haves:
  truths:
    - "All 8 domain-named test files have @requirement annotations matching their tested modules"
    - "Annotations are the PRIMARY fix: they resolve all 8 orphan false positives via the existing hasReqAnnotation path"
    - "sweepTtoR no longer reports any of the 8 files as orphans"
    - "sweepTtoR require-path tracing maps domain-named test files that import bin/ modules to source modules automatically (7 of 8 — b-to-f-remediate.test.cjs is self-contained with no require('../bin/...') imports)"
    - "Require-path tracing is DEFENSE-IN-DEPTH for future domain-named tests, not the primary fix for the current 8"
    - "Existing sweepTtoR behavior unchanged for files already mapped by code-trace index or sync report"
  artifacts:
    - path: "test/b-to-f-remediate.test.cjs"
      provides: "@requirement annotation"
      contains: "@requirement BTF-04"
    - path: "test/b-to-f-sweep.test.cjs"
      provides: "@requirement annotation"
      contains: "@requirement BTF-01"
    - path: "test/bug-context-normalization.test.cjs"
      provides: "@requirement annotation"
      contains: "@requirement MRF-01"
    - path: "test/bug-lookup.test.cjs"
      provides: "@requirement annotation"
      contains: "@requirement BML-01"
    - path: "test/cross-model-regression.test.cjs"
      provides: "@requirement annotation"
      contains: "@requirement REG-01"
    - path: "test/debug-verdict-reporting.test.cjs"
      provides: "@requirement annotation"
      contains: "@requirement DBUG-03"
    - path: "test/model-driven-fix-orchestrator.test.cjs"
      provides: "@requirement annotation"
      contains: "@requirement MRF-03"
    - path: "test/model-reproduction.test.cjs"
      provides: "@requirement annotation"
      contains: "@requirement MRF-02"
    - path: "bin/nf-solve.cjs"
      provides: "require-path tracing in sweepTtoR"
      contains: "require-path tracing"
    - path: "bin/nf-solve.test.cjs"
      provides: "test for require-path tracing"
      contains: "require-path tracing"
  key_links:
    - from: "bin/nf-solve.cjs"
      to: "test/*.test.cjs"
      via: "sweepTtoR require() parsing"
      pattern: "require\\("
    - from: "test/b-to-f-sweep.test.cjs"
      to: "bin/layer-constants.cjs"
      via: "require('../bin/layer-constants.cjs')"
      pattern: "@requirement BTF-01"
---

<objective>
Add @requirement annotations to 8 domain-named test files and add require-path tracing to sweepTtoR to eliminate T->R false positives.

Purpose: These 8 test files use domain-naming (not source-file-naming) so sweepTtoR cannot trace them by filename convention. 7 of 8 require() real bin/ modules; 1 (b-to-f-remediate.test.cjs) is fully self-contained with no bin/ imports. All 8 get flagged as orphans. The @requirement annotations are the PRIMARY fix (resolve all 8 via existing hasReqAnnotation path). The require-path tracing is DEFENSE-IN-DEPTH for future domain-named tests that import tracked modules.

Output: 8 annotated test files, updated sweepTtoR with require-path tracing, test coverage for the new tracing logic.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@bin/nf-solve.cjs (lines 2299-2420 — sweepTtoR function)
@bin/nf-solve.test.cjs (lines 1638-1650 — existing sweepTtoR test)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add @requirement annotations to 8 domain-named test files</name>
  <files>
    test/b-to-f-remediate.test.cjs
    test/b-to-f-sweep.test.cjs
    test/bug-context-normalization.test.cjs
    test/bug-lookup.test.cjs
    test/cross-model-regression.test.cjs
    test/debug-verdict-reporting.test.cjs
    test/model-driven-fix-orchestrator.test.cjs
    test/model-reproduction.test.cjs
  </files>
  <action>
    Add a JSDoc @requirement annotation as the FIRST content line (after 'use strict' if present) in each test file. Follow the existing convention: `/** @requirement REQ-ID — description */`

    Annotations to add (each file gets ONE annotation line):

    1. test/b-to-f-remediate.test.cjs — `/** @requirement BTF-04 — validates B->F remediation dispatch routing, cap enforcement, and priority ordering */`
       Insert after line 1 (`'use strict';`)

    2. test/b-to-f-sweep.test.cjs — `/** @requirement BTF-01 — validates b_to_f layer constants, wave DAG integration, and classifyFailingTest */`
       Insert after line 1 (`'use strict';`)

    3. test/bug-context-normalization.test.cjs — `/** @requirement MRF-01 — validates normalizeBugContext from refinement-loop for bug context injection */`
       This file has no 'use strict'; insert as line 1 (before existing line 1)

    4. test/bug-lookup.test.cjs — `/** @requirement BML-01 — validates formal-scope-scan bug-mode matching and model registry lookup */`
       Insert after line 1 (`'use strict';`)

    5. test/cross-model-regression.test.cjs — `/** @requirement REG-01 — validates cross-model regression via resolve-proximity-neighbors */`
       Insert after line 1 (`'use strict';`)

    6. test/debug-verdict-reporting.test.cjs — `/** @requirement DBUG-03 — validates debug formal context assembly, constraint formatting, and verdict summary */`
       Insert after line 1 (`'use strict';`)

    7. test/model-driven-fix-orchestrator.test.cjs — `/** @requirement MRF-03 — validates model-driven-fix orchestrator phases via formal-scope-scan and refinement-loop */`
       This file has no 'use strict'; insert as line 1 (before existing line 1)

    8. test/model-reproduction.test.cjs — `/** @requirement MRF-02 — validates model reproduction via formal-scope-scan model checkers and bug gap persistence */`
       Insert after line 1 (`'use strict';`)

    Do NOT modify any test logic, assertions, or require() statements. Only add the annotation comment line.
  </action>
  <verify>
    Run: `grep -l '@requirement' test/b-to-f-remediate.test.cjs test/b-to-f-sweep.test.cjs test/bug-context-normalization.test.cjs test/bug-lookup.test.cjs test/cross-model-regression.test.cjs test/debug-verdict-reporting.test.cjs test/model-driven-fix-orchestrator.test.cjs test/model-reproduction.test.cjs | wc -l` — must output 8.
    Run: `node --test test/b-to-f-sweep.test.cjs test/bug-context-normalization.test.cjs test/bug-lookup.test.cjs test/debug-verdict-reporting.test.cjs test/model-reproduction.test.cjs` — all must pass (these are the ones that don't require special env setup).
  </verify>
  <done>All 8 test files contain @requirement annotations matching their tested modules. No test logic modified. Tests still pass.</done>
</task>

<task type="auto">
  <name>Task 2: Add require-path tracing to sweepTtoR and test coverage</name>
  <files>
    bin/nf-solve.cjs
    bin/nf-solve.test.cjs
  </files>
  <action>
    In bin/nf-solve.cjs, in the sweepTtoR function, add require-path tracing between the code-trace-index check (line ~2372) and the sync-report check (line ~2374). The new block should:

    1. Parse the test file content (already read into `content` variable above) for `require('../bin/...')` or `require('./...')` patterns
    2. Extract the required module paths (normalize to relative project paths like `bin/foo.cjs`)
    3. Check if ANY required module is tracked in the code-trace index (`index.traced_files[modulePath]`)
    4. If a required module IS tracked, count the test file as `mapped++` and `continue` (skip orphan check)

    Implementation pattern — insert this block after line 2372 (`continue;` closing brace of code-trace check):

    ```javascript
    // Require-path tracing: map domain-named tests via their require() dependencies
    if (index) {
      try {
        const content = fs.readFileSync(absPath, 'utf8');
        // Match require('../bin/X.cjs') or require('./X.cjs') patterns
        const reqMatches = content.match(/require\(['"]\.\.?\/(bin\/[^'"]+)['"]\)/g);
        if (reqMatches) {
          const hasTrackedDep = reqMatches.some(m => {
            const depMatch = m.match(/require\(['"]\.\.?\/(bin\/[^'"]+)['"]\)/);
            return depMatch && index.traced_files[depMatch[1]];
          });
          if (hasTrackedDep) {
            mapped++;
            continue;
          }
        }
      } catch (e) { /* fail-open */ }
    }
    ```

    NOTE: The `content` variable from the @req annotation check (line ~2358) is scoped inside a try block and may not be accessible. Re-read the file in the new block OR hoist the content read above both checks. Prefer re-reading since it's already in a try/catch and consistent with fail-open pattern.

    In bin/nf-solve.test.cjs, add a new test after the existing TC-CODE-TRACE-6 test (around line 1650):

    ```javascript
    test('TC-CODE-TRACE-8: sweepTtoR require-path tracing maps domain-named test via require() dep (behavioral)', () => {
      // BEHAVIORAL test: execute the SAME tracing logic sweepTtoR uses and verify
      // it produces correct mapped/orphan decisions against real files and a controlled index.
      //
      // sweepTtoR is not exported, so we can't call it directly. Instead we:
      //   1. Verify the tracing block exists structurally (prerequisite)
      //   2. Extract and RUN the tracing regex + index-lookup logic independently
      //   3. Simulate the full decision path: file content → regex → dep extraction → index lookup → mapped?
      //
      // This proves the code WORKS, not just that it EXISTS.

      const src = fs.readFileSync(path.join(__dirname, 'nf-solve.cjs'), 'utf8');

      // ── Step 1: Structural prerequisite ──
      const fnMatch = src.match(/function sweepTtoR\(\)[\s\S]*?^function /m);
      assert.ok(fnMatch, 'sweepTtoR function should exist');
      const fn = fnMatch[0];
      assert.ok(fn.includes('require-path tracing'), 'sweepTtoR should have require-path tracing comment');

      // ── Step 2: Execute the tracing regex against real test files ──
      // Use the EXACT same regex pattern that sweepTtoR uses
      const tracingRegex = /require\(['"]\.\.?\/(bin\/[^'"]+)['"]\)/g;

      // POSITIVE case: b-to-f-sweep.test.cjs requires bin/layer-constants.cjs
      const testContent = fs.readFileSync(path.join(__dirname, '..', 'test', 'b-to-f-sweep.test.cjs'), 'utf8');
      const matches = testContent.match(tracingRegex);
      assert.ok(matches && matches.length > 0, 'b-to-f-sweep.test.cjs should have require("../bin/...") imports');

      // Extract dep paths the same way sweepTtoR does (inner regex on each match)
      const depPaths = matches.map(m => {
        const depMatch = m.match(/require\(['"]\.\.?\/(bin\/[^'"]+)['"]\)/);
        return depMatch ? depMatch[1] : null;
      }).filter(Boolean);
      assert.ok(depPaths.includes('bin/layer-constants.cjs'), 'Should extract bin/layer-constants.cjs as a dependency');

      // NEGATIVE case: b-to-f-remediate.test.cjs has NO bin/ imports (self-contained)
      const selfContained = fs.readFileSync(path.join(__dirname, '..', 'test', 'b-to-f-remediate.test.cjs'), 'utf8');
      const noMatches = selfContained.match(tracingRegex);
      assert.strictEqual(noMatches, null, 'b-to-f-remediate.test.cjs should have no require("../bin/...") — it is self-contained');

      // ── Step 3: Simulate the index-lookup decision path ──
      // Build a controlled code-trace index where bin/layer-constants.cjs IS tracked
      const mockIndex = {
        traced_files: {
          'bin/layer-constants.cjs': { requirements: ['BTF-01'] },
          'bin/nf-solve.cjs': { requirements: ['SOLVE-01'] }
        }
      };

      // Replay sweepTtoR's hasTrackedDep logic: check if ANY extracted dep is in the index
      const hasTrackedDep = depPaths.some(dep => !!mockIndex.traced_files[dep]);
      assert.strictEqual(hasTrackedDep, true,
        'POSITIVE: b-to-f-sweep.test.cjs should be MAPPED because bin/layer-constants.cjs is in the index');

      // Replay for the negative case: no deps extracted → hasTrackedDep must be false
      const negativeDepPaths = (noMatches || []).map(m => {
        const depMatch = m.match(/require\(['"]\.\.?\/(bin\/[^'"]+)['"]\)/);
        return depMatch ? depMatch[1] : null;
      }).filter(Boolean);
      const negativeHasTrackedDep = negativeDepPaths.some(dep => !!mockIndex.traced_files[dep]);
      assert.strictEqual(negativeHasTrackedDep, false,
        'NEGATIVE: b-to-f-remediate.test.cjs should be ORPHAN (no bin/ deps to look up)');

      // ── Step 4: Verify with an index where the dep is NOT tracked ──
      // Even if regex matches, the file should remain orphan if the dep isn't in the index
      const emptyIndex = { traced_files: {} };
      const unmappedResult = depPaths.some(dep => !!emptyIndex.traced_files[dep]);
      assert.strictEqual(unmappedResult, false,
        'When index has no matching traced_files, test should NOT be mapped via tracing');
    });
    ```
  </action>
  <verify>
    Run: `grep 'require-path tracing' bin/nf-solve.cjs` — must match the comment in sweepTtoR.
    Run: `grep 'TC-CODE-TRACE-8' bin/nf-solve.test.cjs` — must find the new test.
    Run: `node --test bin/nf-solve.test.cjs` — all tests must pass including the new TC-CODE-TRACE-8.
  </verify>
  <done>sweepTtoR has require-path tracing that maps domain-named test files to source modules via their require() dependencies (7 of 8 files — b-to-f-remediate.test.cjs is self-contained). New behavioral test TC-CODE-TRACE-8 executes the tracing regex against real test files, simulates the index-lookup decision path with a controlled mock index, and verifies: (1) POSITIVE — b-to-f-sweep.test.cjs maps via bin/layer-constants.cjs in the index, (2) NEGATIVE — b-to-f-remediate.test.cjs stays orphan (no bin/ deps), (3) EDGE — even with regex matches, empty index produces no mapping. All existing tests still pass.</done>
</task>

</tasks>

<verification>
1. `grep -c '@requirement' test/b-to-f-remediate.test.cjs test/b-to-f-sweep.test.cjs test/bug-context-normalization.test.cjs test/bug-lookup.test.cjs test/cross-model-regression.test.cjs test/debug-verdict-reporting.test.cjs test/model-driven-fix-orchestrator.test.cjs test/model-reproduction.test.cjs` — each file shows count >= 1
2. `grep 'require-path tracing' bin/nf-solve.cjs` — confirms tracing block present in sweepTtoR
3. `node --test bin/nf-solve.test.cjs` — all tests pass including TC-CODE-TRACE-8
4. `npm run test:ci` — full suite passes (no regressions)
</verification>

<success_criteria>
- All 8 domain-named test files have @requirement annotations (PRIMARY fix — resolves all 8 orphans)
- sweepTtoR includes require-path tracing between code-trace-index check and sync-report check (DEFENSE-IN-DEPTH — covers 7 of 8 that import bin/ modules, plus future domain-named tests)
- b-to-f-remediate.test.cjs is correctly identified as self-contained (no bin/ imports) — it relies solely on annotation for mapping
- TC-CODE-TRACE-8 is a BEHAVIORAL test that executes the full tracing decision path: (1) runs tracing regex against real test files to extract deps, (2) simulates index lookup with a controlled mock index to verify mapped/orphan decisions, (3) covers POSITIVE (tracked dep in index = mapped), NEGATIVE (no deps = orphan), and EDGE (deps exist but index empty = orphan) cases
- No test regressions in full suite
- The 8 files are no longer flagged as T->R orphans
</success_criteria>

<output>
After completion, create `.planning/quick/357-add-require-path-tracing-to-sweepttor-an/357-SUMMARY.md`
</output>

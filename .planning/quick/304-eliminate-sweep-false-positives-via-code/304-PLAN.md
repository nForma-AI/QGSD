---
phase: quick-304
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/build-code-trace.cjs
  - bin/nf-solve.cjs
  - bin/nf-solve.test.cjs
  - .gitignore
autonomous: true
formal_artifacts: none
requirements: []

must_haves:
  truths:
    - "sweepCtoR reports only genuinely untraced source files (not files already mapped via recipes/scopes)"
    - "sweepTtoR reports only genuinely orphaned test files (not tests whose source modules have recipe mappings)"
    - "code-trace-index.json is rebuilt automatically before reverse sweeps in computeResidual"
    - "If code-trace-index.json is missing or corrupt, sweeps fall back to current text-matching behavior"
  artifacts:
    - path: "bin/build-code-trace.cjs"
      provides: "Code trace index builder aggregating recipe and scope data"
      exports: ["buildIndex"]
    - path: ".planning/formal/code-trace-index.json"
      provides: "Aggregated trace index (generated artifact, gitignored)"
      contains: "traced_files"
  key_links:
    - from: "bin/build-code-trace.cjs"
      to: ".planning/formal/generated-stubs/*.recipe.json"
      via: "fs.readdirSync + JSON.parse of source_files[]"
      pattern: "recipe\\.json"
    - from: "bin/build-code-trace.cjs"
      to: ".planning/formal/spec/*/scope.json"
      via: "fs.readdirSync + JSON.parse of source_files[]"
      pattern: "scope\\.json"
    - from: "bin/nf-solve.cjs"
      to: "bin/build-code-trace.cjs"
      via: "require() for buildIndex()"
      pattern: "require.*build-code-trace"
    - from: "bin/nf-solve.cjs sweepCtoR"
      to: "code-trace-index.json traced_files"
      via: "loadCodeTraceIndex() lookup before text-matching"
      pattern: "index\\.traced_files"
---

<objective>
Eliminate false positives in sweepCtoR (96% FP rate) and sweepTtoR (90% FP rate) by building a code-trace index from existing recipe and scope infrastructure, and consulting it before falling back to naive text-matching.

Purpose: Reverse-discovery sweep residuals are meaningless at current FP rates. Recipes already trace 212/225 source files and 184/184 test files. This task harvests that data into a fast-lookup index.
Output: bin/build-code-trace.cjs, modified sweepCtoR/sweepTtoR in nf-solve.cjs, code-trace-index.json (gitignored)
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@bin/nf-solve.cjs (lines 695-722 for loadFormalTestSync pattern, 1793-1912 for sweepCtoR, 1919-2001 for sweepTtoR, 2734-2757 for computeResidual)
@.planning/formal/generated-stubs/ACT-01.stub.recipe.json (recipe schema example: source_files[] array with relative paths)
@.planning/formal/spec/quorum/scope.json (scope schema example: source_files[] array)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create bin/build-code-trace.cjs and wire into nf-solve.cjs</name>
  <files>bin/build-code-trace.cjs</files>
  <files>bin/nf-solve.cjs</files>
  <files>.gitignore</files>
  <action>
**bin/build-code-trace.cjs (~100 lines):**

1. Read all `.recipe.json` files from `.planning/formal/generated-stubs/` directory
2. For each recipe, extract `source_files[]` array (relative paths like `bin/requirement-map.cjs`) and the `requirement_id` field
3. Build a `traced_files` map: `{ "bin/requirement-map.cjs": ["ACT-01", "REQ-02"], ... }` — each source file maps to an array of requirement IDs that trace to it
4. Read all `scope.json` files from `.planning/formal/spec/*/` subdirectories
5. For each scope file, extract `source_files[]` and add those paths to a `scope_only` array (deduplicated)
6. Source-module inheritance: for every test file in traced_files (matching `*.test.cjs` or `*.test.js`), if its source module (strip `.test`) is also in traced_files, inherit the source module's requirement IDs
7. Also: for every source file in traced_files, check if a corresponding test file exists and add it to traced_files with the same req IDs (covers `bin/foo.cjs` → `bin/foo.test.cjs` inheritance)
8. Write output to `.planning/formal/code-trace-index.json`:
   ```json
   {
     "version": 1,
     "generated_at": "2026-03-16T...",
     "sources": { "recipes": 424, "scopes": 19 },
     "traced_files": { "bin/install.js": ["INST-01"], ... },
     "scope_only": ["bin/run-quorum.cjs", ...]
   }
   ```
9. Export `module.exports = { buildIndex }` where `buildIndex(rootDir)` does the above and returns the index object (also writes to disk)

Use `path.relative(rootDir, absolutePath)` to normalize all paths. Handle missing directories gracefully (return empty index, don't throw).

**bin/nf-solve.cjs modifications:**

1. Add `loadCodeTraceIndex()` near line 722 (after loadFormalTestSync), following same lazy-cache pattern:
   - Cache variable `let codeTraceIndexCache = null;`
   - Function reads `.planning/formal/code-trace-index.json`, parses JSON, caches and returns
   - On any error (missing file, parse error), returns null (graceful degradation)

2. Add `rebuildCodeTraceIndex()` near loadCodeTraceIndex:
   - `const { buildIndex } = require('./build-code-trace.cjs');`
   - Call `buildIndex(ROOT)`, cache the result, return it
   - Wrap in try/catch, return null on failure

3. In `computeResidual()` (line 2734), BEFORE the `c_to_r = sweepCtoR()` call (line 2755):
   - Add `rebuildCodeTraceIndex();` to rebuild the index fresh each solve run
   - This ensures the index reflects current recipe/scope state

4. Modify `sweepCtoR()` — insert a new check block AFTER `reqIdSet` is built (line 1828) and BEFORE the source file scan loop (line 1834):
   - Load index via `loadCodeTraceIndex()`
   - If index is non-null, for each source file in the scan loop, check `index.traced_files[file]` or `index.scope_only.includes(file)` FIRST
   - If found in either, count as `traced++` and `continue` (skip text-matching and header-comment fallbacks)
   - If index is null, fall through to existing text-matching logic unchanged

5. Modify `sweepTtoR()` — insert a new check block AFTER `syncMappedFiles` set is built (line 1963) and BEFORE the per-file loop (line 1968):
   - Load index via `loadCodeTraceIndex()`
   - In the per-file loop, BEFORE checking `@req` annotations (line 1972), check `index.traced_files[testFile]`
   - If found, count as `mapped++` and `continue`
   - If index is null, fall through to existing @req + formal-test-sync logic unchanged

**.gitignore:**
Add `.planning/formal/code-trace-index.json` after the existing `.planning/formal/state-space-report.json` line (around line 93)
  </action>
  <verify>
Run: `node bin/build-code-trace.cjs` (should create the index file without errors)
Run: `node -e "const idx = require('./.planning/formal/code-trace-index.json'); console.log('files:', Object.keys(idx.traced_files).length, 'scope:', idx.scope_only.length, 'v:', idx.version)"` — should show file count > 200
Run: `grep 'code-trace-index' .gitignore` — should match
Run: `grep 'loadCodeTraceIndex' bin/nf-solve.cjs` — should match
Run: `grep 'rebuildCodeTraceIndex' bin/nf-solve.cjs` — should match
  </verify>
  <done>
bin/build-code-trace.cjs creates a valid code-trace-index.json with 200+ traced files from recipes and 10+ scope-only files. nf-solve.cjs loads the index in sweepCtoR and sweepTtoR before falling back to text-matching. Index is gitignored.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add tests for code-trace-index integration</name>
  <files>bin/nf-solve.test.cjs</files>
  <action>
Add a new test section in bin/nf-solve.test.cjs for code-trace-index integration. Place after existing sweep tests.

**Tests to add:**

1. **build-code-trace.cjs generates valid index:**
   - `const { buildIndex } = require('./build-code-trace.cjs');`
   - Call `buildIndex(ROOT)` where ROOT is the project root
   - Assert returned object has `version === 1`, `generated_at` is a string, `traced_files` is an object with > 0 keys, `scope_only` is an array, `sources.recipes` > 0
   - Assert the file `.planning/formal/code-trace-index.json` exists on disk and parses to same structure

2. **loadCodeTraceIndex returns null when file missing:**
   - Temporarily rename the index file (if exists), call the function (may need to clear cache first by setting codeTraceIndexCache to null — access via modifying the module or testing the file-read path)
   - Simpler approach: test that when the file path doesn't exist, the function returns null gracefully. Since it's a lazy cache, test by verifying the JSON file can be loaded and parsed, and that invalid JSON returns null.

3. **Source-module inheritance test:**
   - Call `buildIndex(ROOT)` and check that for a known test file like `bin/nf-solve.test.cjs`, if `bin/nf-solve.cjs` is in traced_files, then the test file also appears in traced_files with the same or inherited req IDs

4. **Integration smoke test — sweepCtoR residual decreased:**
   - Run `node bin/build-code-trace.cjs` first to ensure index exists
   - Count traced_files entries
   - This validates that the index covers files that would otherwise be false positives

Use the existing test patterns in nf-solve.test.cjs (node:test `describe`/`it` blocks, `assert`).
  </action>
  <verify>
Run: `node --test bin/nf-solve.test.cjs 2>&1 | tail -30` — all tests pass including new code-trace tests
Run: `node --test bin/build-code-trace.cjs 2>&1` — if self-tests exist, they pass (optional)
  </verify>
  <done>
Tests confirm: buildIndex() produces valid JSON with expected schema, loadCodeTraceIndex gracefully handles missing files, source-module inheritance works for test files, and the index traces more files than the naive text-matching approach.
  </done>
</task>

</tasks>

<verification>
1. Run `node bin/build-code-trace.cjs` — produces `.planning/formal/code-trace-index.json` with version 1
2. Run `node --test bin/nf-solve.test.cjs` — all tests pass (existing + new)
3. Run `node bin/nf-solve.cjs --json 2>/dev/null | node -e "process.stdin.on('data',d=>{const o=JSON.parse(d);const c=o.c_to_r;const t=o.t_to_r;console.log('C->R residual:',c.residual,'T->R residual:',t.residual)})"` — residuals should be significantly lower than before (C->R was ~96% FP, expect dramatic drop)
4. `grep 'code-trace-index' .gitignore` — present
5. `grep 'rebuildCodeTraceIndex' bin/nf-solve.cjs` — wired into computeResidual
</verification>

<success_criteria>
- sweepCtoR false positive rate drops from 96% to near 0% (only ~13 genuinely untraced source files remain)
- sweepTtoR false positive rate drops from 90% to near 0% (only ~10 genuinely unmapped test files remain)
- Graceful degradation: if index file is deleted, sweeps fall back to existing behavior without errors
- No changes to sweep return shapes (residual/detail structure unchanged)
</success_criteria>

<output>
After completion, create `.planning/quick/304-eliminate-sweep-false-positives-via-code/304-SUMMARY.md`
</output>

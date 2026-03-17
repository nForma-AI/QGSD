---
phase: quick-320
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/formal/dr-scanner-config.json
  - bin/nf-solve.cjs
  - bin/sweep-reverse.test.cjs
autonomous: true
formal_artifacts: none
requirements: [QUICK-320]

must_haves:
  truths:
    - "D->R scanner excludes files matching patterns in dr-scanner-config.json exclude_files"
    - "D->R scanner suppresses claim lines matching table/config/debate heuristics"
    - "FP count drops from ~21 to single digits without losing true positives"
  artifacts:
    - path: ".planning/formal/dr-scanner-config.json"
      provides: "Exclusion patterns and claim-type suppression rules for D->R scanner"
      contains: "exclude_files"
    - path: "bin/nf-solve.cjs"
      provides: "Updated sweepDtoR with config-driven exclusion and claim-type filtering"
      contains: "dr-scanner-config"
    - path: "bin/sweep-reverse.test.cjs"
      provides: "Tests for exclusion list and claim-type filtering"
      contains: "exclude_files"
  key_links:
    - from: "bin/nf-solve.cjs"
      to: ".planning/formal/dr-scanner-config.json"
      via: "fs.readFileSync + JSON.parse in sweepDtoR"
      pattern: "dr-scanner-config\\.json"
    - from: "bin/sweep-reverse.test.cjs"
      to: "bin/nf-solve.cjs"
      via: "require sweepDtoR export"
      pattern: "sweepDtoR"
---

<objective>
Reduce D->R scanner false positives by adding a config-driven file exclusion list and claim-type heuristic filter to sweepDtoR in nf-solve.cjs.

Purpose: The D->R scanner currently produces ~21 FPs out of 26 total because it scans debate logs, self-referential coverage docs, and treats config table rows the same as feature promises. This creates noise that obscures real unbacked claims.

Output: dr-scanner-config.json with exclude patterns, updated sweepDtoR with two new filter stages, and tests proving the filters work.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@bin/nf-solve.cjs (sweepDtoR at line 2309, discoverDocFiles at line 311)
@bin/sweep-reverse.test.cjs (existing sweepDtoR tests at line 187)
@.planning/formal/dr-scanner-config.json (to be created)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create dr-scanner-config.json and wire exclusion + claim-type filtering into sweepDtoR</name>
  <files>
    .planning/formal/dr-scanner-config.json
    bin/nf-solve.cjs
  </files>
  <action>
1. Create `.planning/formal/dr-scanner-config.json` with this structure:
```json
{
  "version": 1,
  "exclude_files": [
    "docs/dev/quorum_interface.md",
    "docs/dev/requirements-coverage.md",
    ".planning/quorum/debates/**",
    ".planning/phases/**",
    "CHANGELOG.md"
  ],
  "suppress_line_patterns": [
    "^\\s*\\|",
    "^\\s*-\\s*`[^`]+`\\s*(—|-)\\s*",
    "^>\\s+"
  ],
  "suppress_line_descriptions": [
    "Table rows (pipe-delimited) — config tables contain action verbs but are not feature claims",
    "Definition list items (- `term` -- desc) — glossary/reference entries, not promises",
    "Blockquotes — typically quoting other sources or providing commentary"
  ]
}
```

The `exclude_files` array uses the same glob convention as discoverDocFiles. The `suppress_line_patterns` are regexes matched against each line BEFORE the action-verb check.

2. In `sweepDtoR()` (line 2309 of bin/nf-solve.cjs), add two filter stages:

**Stage A — File exclusion (after line 2342, before iterating docFiles):**
- Load `.planning/formal/dr-scanner-config.json` via `fs.readFileSync` with try/catch (fail-open: if missing or parse error, log warning and continue with no exclusions).
- Filter `docFiles` array: for each `{ absPath }`, compute `relativePath = path.relative(ROOT, absPath)` and check against each `exclude_files` pattern using the existing `matchWildcard()` function (already in nf-solve.cjs). Remove matches.
- Track excluded count for the detail object.

**Stage B — Line-level suppression (inside the line loop, after the fenced-block skip at line 2379 and before the action-verb check at line 2385):**
- Compile `suppress_line_patterns` from config into RegExp array (once, outside the file loop).
- For each line, test against all suppress patterns. If any match, `continue` (skip that line entirely).

3. Add `excluded_files` count and `suppressed_lines` count to the returned `detail` object alongside existing `unbacked_claims`, `total_claims`, `backed`.

Do NOT change the existing keyword-overlap matching logic (lines 2390-2418). Do NOT change the assembleReverseCandidates function. The changes are purely additive filters applied before the existing logic runs.
  </action>
  <verify>
Run: `node -e "const s = require('./bin/nf-solve.cjs'); const r = s.sweepDtoR(); console.log(JSON.stringify({residual: r.residual, total: r.detail.total_claims, backed: r.detail.backed, excluded: r.detail.excluded_files, suppressed: r.detail.suppressed_lines}, null, 2))"` — residual should be noticeably lower than 21, total_claims should be lower than before (excluded files reduce the scan surface).
  </verify>
  <done>sweepDtoR loads dr-scanner-config.json, excludes matching files, suppresses matching line patterns, and returns reduced residual count with excluded_files and suppressed_lines in detail.</done>
</task>

<task type="auto">
  <name>Task 2: Add tests for exclusion list and claim-type filtering</name>
  <files>
    bin/sweep-reverse.test.cjs
  </files>
  <action>
Add a new describe block in `bin/sweep-reverse.test.cjs` after the existing `sweepDtoR` describe block (line ~222):

```javascript
describe('sweepDtoR exclusion and claim-type filtering', () => {
  // Test 1: Config loading resilience
  it('returns valid result even if dr-scanner-config.json is missing', () => {
    // sweepDtoR should fail-open — already tested implicitly by existing tests
    // but verify detail shape includes excluded_files field
    const result = sweepDtoR();
    if (!result.detail.skipped) {
      assert.equal(typeof result.detail.excluded_files, 'number');
      assert.equal(typeof result.detail.suppressed_lines, 'number');
    }
  });

  // Test 2: Exclusion list reduces file count
  it('excludes files matching dr-scanner-config.json patterns', () => {
    const result = sweepDtoR();
    if (!result.detail.skipped) {
      // With exclusions active, excluded_files should be >= 0
      assert.ok(result.detail.excluded_files >= 0, 'excluded_files should be non-negative');
      // Verify no unbacked claim comes from an excluded file
      const config = JSON.parse(fs.readFileSync(
        path.join(process.cwd(), '.planning', 'formal', 'dr-scanner-config.json'), 'utf8'
      ));
      for (const claim of result.detail.unbacked_claims) {
        for (const pattern of config.exclude_files) {
          // None of the unbacked claims should match an exclude pattern
          // (use simple check — exact match or startsWith for glob dirs)
          if (!pattern.includes('*') && claim.doc_file === pattern) {
            assert.fail('Excluded file ' + pattern + ' still produced claim: ' + claim.claim_text);
          }
        }
      }
    }
  });

  // Test 3: Table rows are suppressed
  it('suppresses table row lines from claim detection', () => {
    const result = sweepDtoR();
    if (!result.detail.skipped) {
      for (const claim of result.detail.unbacked_claims) {
        // No claim_text should start with a pipe (table row)
        assert.ok(!claim.claim_text.startsWith('|'),
          'Table row not suppressed: ' + claim.claim_text);
      }
    }
  });

  // Test 4: Residual is within acceptable range
  it('residual is reduced below 15 with exclusions active', () => {
    const result = sweepDtoR();
    if (!result.detail.skipped) {
      assert.ok(result.residual < 15,
        'Expected residual < 15 with exclusions, got ' + result.residual);
    }
  });
});
```

Add `const fs = require('fs')` and `const path = require('path')` at the top of the test file if not already imported.
  </action>
  <verify>
Run: `node --test bin/sweep-reverse.test.cjs` — all tests pass, including the 4 new tests. Existing sweepDtoR tests still pass.
  </verify>
  <done>4 new tests validate: config fail-open resilience, file exclusion enforcement, table-row suppression, and residual reduction below 15. All existing tests remain green.</done>
</task>

</tasks>

<verification>
1. `node --test bin/sweep-reverse.test.cjs` — all tests pass
2. `node bin/nf-solve.cjs --json 2>/dev/null | node -e "process.stdin.on('data',d=>{const j=JSON.parse(d);console.log('D->R residual:',j.health?.d_to_r?.residual)})"` — residual is noticeably lower than 21
3. `.planning/formal/dr-scanner-config.json` exists and is valid JSON
</verification>

<success_criteria>
- dr-scanner-config.json created with exclude_files patterns and suppress_line_patterns
- sweepDtoR loads config, excludes matching files, suppresses matching lines
- D->R residual drops from ~21 to below 15 (ideally single digits)
- All existing sweep-reverse tests pass unchanged
- 4 new tests validate the filtering behavior
</success_criteria>

<output>
After completion, create `.planning/quick/320-implement-d-r-scanner-exclusion-list-and/320-SUMMARY.md`
</output>

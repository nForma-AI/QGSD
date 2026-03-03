---
phase: quick-139
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .formal/constants-mapping.json
  - bin/extract-annotations.cjs
  - bin/formal-test-sync.cjs
  - bin/formal-test-sync.test.cjs
  - bin/generate-traceability-matrix.cjs
  - commands/qgsd/formal-test-sync.md
  - hooks/qgsd-circuit-breaker.test.js
  - hooks/config-loader.test.js
  - bin/run-oscillation-tlc.test.cjs
autonomous: true
formal_artifacts: none
requirements: [QUICK-139]

must_haves:
  truths:
    - "Running `node bin/extract-annotations.cjs --include-tests --pretty` includes test file entries with `test:` key prefixes alongside existing formal model entries"
    - "Running `node bin/extract-annotations.cjs` (without --include-tests) produces identical output to before this change"
    - "Running `node bin/formal-test-sync.cjs --json --report-only` outputs a JSON report with coverage_gaps and constants_validation sections"
    - "Running `node bin/formal-test-sync.cjs` generates test stubs in hooks/generated-stubs/ for uncovered invariants"
    - "Running `node bin/formal-test-sync.cjs` writes .formal/unit-test-coverage.json sidecar consumed by traceability matrix"
    - "Running `node bin/formal-test-sync.cjs` validates formal model constants against config-loader.js DEFAULT_CONFIG and reports mismatches"
    - "Running `node bin/generate-traceability-matrix.cjs` includes a unit_test_coverage field in each requirement entry when .formal/unit-test-coverage.json exists"
    - "Running `node --test bin/formal-test-sync.test.cjs` passes all tests"
    - "Invoking `/qgsd:formal-test-sync` as a skill command works and displays results"
    - "At least 2 existing test files contain `// @requirement REQ-ID` annotations as proof-of-concept"
  artifacts:
    - path: ".formal/constants-mapping.json"
      provides: "Manual mapping of formal constants to config paths"
      contains: "circuit_breaker.oscillation_depth"
    - path: "bin/extract-annotations.cjs"
      provides: "Extended annotation parser with --include-tests flag and parseTestFile()"
      contains: "parseTestFile"
    - path: "bin/formal-test-sync.cjs"
      provides: "Main orchestration script for formal-test sync"
      exports: ["buildCoverageReport", "validateConstants", "generateStubs"]
    - path: "bin/formal-test-sync.test.cjs"
      provides: "Test suite for formal-test-sync.cjs"
      contains: "TC-PARSE"
    - path: "bin/generate-traceability-matrix.cjs"
      provides: "Updated matrix generator with unit-test-coverage sidecar loading"
      contains: "loadUnitTestCoverage"
    - path: "commands/qgsd/formal-test-sync.md"
      provides: "Skill definition for /qgsd:formal-test-sync command"
      contains: "formal-test-sync.cjs"
    - path: ".formal/unit-test-coverage.json"
      provides: "Sidecar file consumed by traceability matrix generator"
      contains: "covered"
    - path: ".formal/formal-test-sync-report.json"
      provides: "Machine-readable coverage gap and constants validation report"
      contains: "coverage_gaps"
  key_links:
    - from: "bin/formal-test-sync.cjs"
      to: "bin/extract-annotations.cjs"
      via: "Spawns extract-annotations.cjs with and without --include-tests"
      pattern: "extract-annotations\\.cjs.*--include-tests"
    - from: "bin/formal-test-sync.cjs"
      to: ".formal/constants-mapping.json"
      via: "Reads constant mappings to compare formal values vs runtime defaults"
      pattern: "constants-mapping\\.json"
    - from: "bin/formal-test-sync.cjs"
      to: "hooks/config-loader.js"
      via: "Imports DEFAULT_CONFIG for constants validation"
      pattern: "require.*config-loader"
    - from: "bin/formal-test-sync.cjs"
      to: ".formal/unit-test-coverage.json"
      via: "Writes sidecar consumed by traceability matrix"
      pattern: "unit-test-coverage\\.json"
    - from: "bin/generate-traceability-matrix.cjs"
      to: ".formal/unit-test-coverage.json"
      via: "loadUnitTestCoverage() reads sidecar and merges into matrix"
      pattern: "unit-test-coverage\\.json"
    - from: "commands/qgsd/formal-test-sync.md"
      to: "bin/formal-test-sync.cjs"
      via: "Skill definition runs the script"
      pattern: "formal-test-sync\\.cjs"
---

<objective>
Implement the `/qgsd:formal-test-sync` command that cross-references formal model invariants with unit test coverage, validates formal constants against runtime config defaults, reports gaps, generates test stubs, and feeds a unit-test-coverage sidecar into the traceability matrix.

Purpose: Close the disconnect between QGSD's 30+ formal models (250+ invariants) and 80+ unit test files (150+ tests). Make consistency checking between these two verification layers a permanent, repeatable capability.
Output: constants-mapping.json, extended extract-annotations.cjs, formal-test-sync.cjs + tests, updated generate-traceability-matrix.cjs, skill definition, and proof-of-concept @requirement annotations on 2-3 existing test files.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@/Users/jonathanborduas/.claude/plans/curious-strolling-thimble.md
@bin/extract-annotations.cjs
@bin/generate-traceability-matrix.cjs
@hooks/config-loader.js
@.formal/tla/MCoscillation.cfg
@.formal/tla/MCsafety.cfg
@.formal/alloy/config-two-layer.als
@commands/qgsd/health.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create constants-mapping.json, extend extract-annotations.cjs with test parsing, and add proof-of-concept @requirement annotations</name>
  <files>
    .formal/constants-mapping.json
    bin/extract-annotations.cjs
    hooks/qgsd-circuit-breaker.test.js
    hooks/config-loader.test.js
    bin/run-oscillation-tlc.test.cjs
  </files>
  <action>
**Step 1 — Create `.formal/constants-mapping.json`:**

Create the mapping file with these entries (derived from MCoscillation.cfg, MCsafety.cfg, and config-two-layer.als):

```json
{
  "version": 1,
  "description": "Maps formal model constants to runtime config paths in hooks/config-loader.js DEFAULT_CONFIG",
  "mappings": [
    {
      "constant": "Depth",
      "source": ".formal/tla/MCoscillation.cfg",
      "config_path": "circuit_breaker.oscillation_depth",
      "formal_value": 3,
      "notes": "Must match"
    },
    {
      "constant": "CommitWindow",
      "source": ".formal/tla/MCoscillation.cfg",
      "config_path": "circuit_breaker.commit_window",
      "formal_value": 5,
      "intentional_divergence": true,
      "notes": "Formal model uses 5 for state-space reduction; runtime default is 6"
    },
    {
      "constant": "MaxDeliberation",
      "source": ".formal/tla/MCsafety.cfg",
      "config_path": null,
      "formal_value": 9,
      "notes": "Model-only constant, no runtime config equivalent"
    },
    {
      "constant": "MaxSize",
      "source": ".formal/tla/MCsafety.cfg",
      "config_path": "quorum.minSize",
      "formal_value": 3,
      "notes": "Maps to quorum.minSize — MCsafety uses MaxSize=3 while default minSize=4",
      "intentional_divergence": true
    },
    {
      "constant": "defaultOscDepth",
      "source": ".formal/alloy/config-two-layer.als",
      "config_path": "circuit_breaker.oscillation_depth",
      "formal_value": 3,
      "notes": "Alloy Defaults sig"
    },
    {
      "constant": "defaultCommitWindow",
      "source": ".formal/alloy/config-two-layer.als",
      "config_path": "circuit_breaker.commit_window",
      "formal_value": 6,
      "notes": "Alloy Defaults sig"
    },
    {
      "constant": "defaultFailMode",
      "source": ".formal/alloy/config-two-layer.als",
      "config_path": "fail_mode",
      "formal_value": "FailOpen",
      "transform": "FailOpen -> \"open\"",
      "notes": "Alloy uses sig name; config uses string"
    }
  ]
}
```

**Step 2 — Extend `bin/extract-annotations.cjs` with `--include-tests`:**

Add to the existing file (backward-compatible — without `--include-tests`, output is identical):

1. Add `parseTestFile(content)` function: Matches `// @requirement REQ-ID` annotations placed above `test('name', ...)` or `describe('name', ...)` blocks in JS test files. Returns `[{ test_name, requirement_ids }]`. Same pending-annotation pattern as the existing TLA+/Alloy/PRISM parsers.

2. Add `getTestFiles()` function: Scans `hooks/*.test.js` and `bin/*.test.cjs` using `fs.readdirSync` + filter (same pattern as `getModelFiles()`). Returns array of relative paths from project root.

3. Add `extractTestAnnotations()` function: Iterates test files, calls `parseTestFile()`, returns `{ "test:hooks/config-loader.test.js": [{ test_name, requirement_ids }], ... }` — note the `test:` key prefix to distinguish from formal model entries.

4. In the CLI section, detect `--include-tests` flag. When present, merge `extractTestAnnotations()` output into the main `extractAnnotations()` result before JSON serialization. When absent, behavior is unchanged.

5. Export `parseTestFile` via `module.exports` so formal-test-sync.cjs can import it directly if needed (add `if (typeof module !== 'undefined') module.exports = { parseTLA, parseAlloy, parsePRISM, parseTestFile, extractAnnotations };` at the bottom — but only if not already exporting. The current file has no exports; add them conditionally after CLI execution with `if (require.main !== module)` guard).

Actually, simpler approach: wrap the CLI execution in `if (require.main === module)` and always export the parse functions. This way the file works both as CLI and as a library.

**Step 3 — Annotate 2-3 existing test files as proof-of-concept:**

Add `// @requirement` annotations to a few tests:

- `hooks/qgsd-circuit-breaker.test.js`: Add `// @requirement DETECT-05` above the oscillation detection test(s) (the test names should reference circuit breaker / oscillation behavior).
- `hooks/config-loader.test.js`: Add `// @requirement CONF-01` or `// @requirement CONF-02` above tests that exercise config loading behavior.
- `bin/run-oscillation-tlc.test.cjs`: Add `// @requirement DETECT-05` above relevant tests (if the file tests oscillation TLC runner behavior).

Read each file first, find the appropriate `test(` calls, and place the annotation on the line immediately preceding the test declaration. Do not modify any test logic — only add comment annotations. Place annotations before the `test('...'` line (not inside the test body).
  </action>
  <verify>
    1. `node bin/extract-annotations.cjs --pretty` — output is identical to before (no test entries).
    2. `node bin/extract-annotations.cjs --include-tests --pretty` — output includes `test:` prefixed keys with annotated test files.
    3. `cat .formal/constants-mapping.json | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(d.mappings.length + ' mappings')"` — prints `7 mappings`.
    4. `grep -c '@requirement' hooks/qgsd-circuit-breaker.test.js hooks/config-loader.test.js` — at least 1 annotation per file.
  </verify>
  <done>
    constants-mapping.json has 7 entries covering MCoscillation.cfg, MCsafety.cfg, and config-two-layer.als constants. extract-annotations.cjs supports --include-tests flag that adds test: prefixed entries. At least 2 existing test files have @requirement annotations. Backward compatibility preserved.
  </done>
</task>

<task type="auto">
  <name>Task 2: Build formal-test-sync.cjs orchestrator with test suite, update traceability matrix, and create skill definition</name>
  <files>
    bin/formal-test-sync.cjs
    bin/formal-test-sync.test.cjs
    bin/generate-traceability-matrix.cjs
    commands/qgsd/formal-test-sync.md
  </files>
  <action>
**Step 1 — Create `bin/formal-test-sync.cjs`:**

Shebang: `#!/usr/bin/env node`, `'use strict'`. Follow the same file structure pattern as `bin/generate-traceability-matrix.cjs` (constants, data loading, processing, CLI).

CLI flags: `--report-only` (no stub generation, no sidecar write), `--dry-run` (show what stubs would be generated but do not write), `--json` (JSON output to stdout instead of human-readable), `--stubs-dir=<path>` (override default `hooks/generated-stubs/`).

Core functions:

1. `loadFormalAnnotations()` — spawns `node bin/extract-annotations.cjs` (no --include-tests), parses JSON stdout. Returns `{ model_file: [{ property, requirement_ids }] }`.

2. `loadTestAnnotations()` — spawns `node bin/extract-annotations.cjs --include-tests`, parses JSON stdout, filters to only `test:` prefixed keys (strips prefix from keys in returned object). Returns `{ "hooks/config-loader.test.js": [{ test_name, requirement_ids }] }`.

3. `loadRequirements()` — reads `.formal/requirements.json`, returns `data.requirements` array. Fail-open: returns [] if missing.

4. `loadConstantsMapping()` — reads `.formal/constants-mapping.json`, returns mappings array. Fail-open: returns [] if missing.

5. `parseTLACfgConstants(content)` — parses TLA+ `.cfg` files. Extracts key=value pairs from CONSTANTS blocks. Pattern: after line matching `/^CONSTANTS$/`, read lines matching `/^\s+(\w+)\s*=\s*(.+)$/` until next section keyword (SPECIFICATION, INVARIANT, PROPERTY, SYMMETRY, CHECK_DEADLOCK). Returns `{ Key: value }` map. Handle set values like `{A, B, C}` as strings. Parse integer values as numbers.

6. `parseAlloyDefaults(content)` — parses Alloy files for `one sig Defaults { ... } { ... }` blocks. Extract field values from the body block (second `{ }` after the sig). Pattern: find `one sig Defaults`, then find the constraint block `{ defaultX = value }` lines. Returns `{ fieldName: value }` map.

7. `resolveConfigPath(dotPath, config)` — resolves dot-notation path like `"circuit_breaker.oscillation_depth"` against an object. Returns the value or undefined. Simple split('.') + reduce.

8. `validateConstants(mappings)` — for each mapping in constants-mapping.json:
   - Read the source file, parse constants using `parseTLACfgConstants()` or `parseAlloyDefaults()` based on file extension (.cfg vs .als).
   - Look up the constant name in parsed result to get the formal value.
   - If `config_path` is null, skip (model-only).
   - If `config_path` is set, resolve against DEFAULT_CONFIG (imported from `../../hooks/config-loader.js`).
   - If `transform` field exists, apply the transform before comparison (e.g., `FailOpen -> "open"` means if formal value is "FailOpen", compare against "open").
   - If `intentional_divergence: true`, report as INFO not WARNING.
   - Return array of `{ constant, source, formal_value, config_value, config_path, match: boolean, intentional_divergence: boolean }`.

9. `buildCoverageReport(formalAnnotations, testAnnotations, requirements)` — for each requirement:
   - `has_formal`: does any formal model annotation reference this requirement ID?
   - `has_test`: does any test annotation reference this requirement ID?
   - `formal_properties`: list of `{ model_file, property }` covering it.
   - `test_cases`: list of `{ test_file, test_name }` covering it.
   - `gap`: true if has_formal but NOT has_test (invariant without test backing).
   - Return `{ covered: [...], uncovered: [...], gaps: [...], stats: { total, formal_covered, test_covered, both_covered, gap_count } }`.

10. `generateStubs(gaps, formalAnnotations, stubsDir)` — for each gap (requirement with formal coverage but no test):
    - Create a stub file at `<stubsDir>/<REQ-ID>.stub.test.js`.
    - Content: `// @requirement <REQ-ID>`, a `test()` block with `assert.fail('TODO: implement test for <REQ-ID> — <property> in <model_file>')`.
    - Skip if `--dry-run`.
    - Create stubsDir if it does not exist (`fs.mkdirSync(..., { recursive: true })`).
    - Return list of created stubs.

11. `writeReport(coverageReport, constantsValidation)` — writes `.formal/formal-test-sync-report.json` with `{ generated_at, coverage_gaps: coverageReport, constants_validation: constantsValidation }`.

12. `writeSidecar(coverageReport)` — writes `.formal/unit-test-coverage.json` with per-requirement test coverage: `{ generated_at, requirements: { [reqId]: { covered: boolean, test_cases: [...] } } }`.

13. `printSummary(coverageReport, constantsValidation, stubs)` — human-readable stdout table summarizing gaps, constants mismatches, stubs generated. Use simple aligned text (no chalk/color dependencies).

Main flow:
```
const formal = loadFormalAnnotations();
const tests = loadTestAnnotations();
const reqs = loadRequirements();
const mappings = loadConstantsMapping();
const coverageReport = buildCoverageReport(formal, tests, reqs);
const constantsValidation = validateConstants(mappings);
if (!reportOnly) {
  const stubs = dryRun ? [] : generateStubs(coverageReport.gaps, formal, stubsDir);
  writeSidecar(coverageReport);
  writeReport(coverageReport, constantsValidation);
}
if (jsonMode) { stdout JSON } else { printSummary() }
```

Import DEFAULT_CONFIG via: `const { DEFAULT_CONFIG } = require('../hooks/config-loader');`

**Step 2 — Create `bin/formal-test-sync.test.cjs`:**

Use `node:test` + `node:assert/strict` (same pattern as all other test files in the project).

Test categories per the design plan:

**Parser tests (TC-PARSE-1..6):**
- TC-PARSE-1: `parseTestFile()` with single `// @requirement` above `test()` — returns correct test_name and requirement_ids.
- TC-PARSE-2: `parseTestFile()` with multiple `// @requirement` above one `test()` — collects all.
- TC-PARSE-3: `parseTestFile()` with `// @requirement` above `describe()` — returns describe name.
- TC-PARSE-4: `parseTestFile()` with no annotations — returns empty array.
- TC-PARSE-5: `parseTestFile()` with annotation not immediately above test (blank line gap followed by non-test code) — does NOT associate.
- TC-PARSE-6: `parseTestFile()` with annotation above nested test inside describe — associates correctly.

Import `parseTestFile` from `../bin/extract-annotations.cjs` (which now exports it).

**Constants tests (TC-CONST-1..6):**
- TC-CONST-1: `parseTLACfgConstants()` on MCoscillation.cfg content — extracts Depth=3, CommitWindow=5.
- TC-CONST-2: `parseTLACfgConstants()` on MCsafety.cfg content — extracts MaxDeliberation=9, MaxSize=3 (ignores agent assignments).
- TC-CONST-3: `parseAlloyDefaults()` on config-two-layer.als content — extracts defaultOscDepth=3, defaultCommitWindow=6, defaultFailMode=FailOpen.
- TC-CONST-4: `resolveConfigPath('circuit_breaker.oscillation_depth', DEFAULT_CONFIG)` returns 3.
- TC-CONST-5: `resolveConfigPath('nonexistent.path', DEFAULT_CONFIG)` returns undefined.
- TC-CONST-6: `validateConstants()` with an `intentional_divergence: true` entry — reports match=false but flags as intentional.

Import parse/resolve functions from `../bin/formal-test-sync.cjs` (export them from the main script using `if (require.main !== module)` guard or always via module.exports).

**Coverage tests (TC-GAP-1..4):**
- TC-GAP-1: Requirement with both formal and test coverage — appears in `covered`, not in `gaps`.
- TC-GAP-2: Requirement with formal coverage but no test — appears in `gaps`.
- TC-GAP-3: Requirement excluded from formal models — not in gaps (only formal-covered reqs generate gaps).
- TC-GAP-4: Requirement covered by multiple tests — test_cases array has correct length.

**Stub tests (TC-STUB-1..4):**
- TC-STUB-1: Generated stub contains `// @requirement REQ-ID` annotation.
- TC-STUB-2: Generated stub contains `assert.fail('TODO:...')`.
- TC-STUB-3: Stub filename matches `<REQ-ID>.stub.test.js` convention.
- TC-STUB-4: `--dry-run` mode does not create files (test by passing dryRun=true to generateStubs and verifying no files written).

Use a temp directory (`os.tmpdir()`) for stub generation tests. Clean up in `t.after()` or try/finally.

**Integration tests (TC-INT-1..2):**
- TC-INT-1: `node bin/formal-test-sync.cjs --json --report-only` exits 0 and stdout is valid JSON with `coverage_gaps` and `constants_validation` keys.
- TC-INT-2: `node bin/formal-test-sync.cjs --report-only` exits 0 and stdout contains human-readable summary text.

Use `spawnSync` for integration tests (same pattern as circuit-breaker tests).

**Step 3 — Update `bin/generate-traceability-matrix.cjs`:**

Add `loadUnitTestCoverage()` function (~15 lines) after the existing `loadRequirements()` function:

```javascript
const UNIT_TEST_COVERAGE_PATH = path.join(ROOT, '.formal', 'unit-test-coverage.json');

function loadUnitTestCoverage() {
  if (!fs.existsSync(UNIT_TEST_COVERAGE_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(UNIT_TEST_COVERAGE_PATH, 'utf8'));
  } catch (err) {
    process.stderr.write(TAG + ' warn: unit-test-coverage.json parse error: ' + err.message + '\n');
    return null;
  }
}
```

In `buildMatrix()`, after the existing processing:
1. Call `const unitTestCoverage = loadUnitTestCoverage();`
2. If unitTestCoverage is not null, iterate `matrix.requirements` and for each reqId that exists in `unitTestCoverage.requirements`, add `unit_test_coverage: { covered: boolean, test_cases: [...] }` to the requirement entry.
3. Add `unit_test_coverage: { available: boolean, requirements_matched: number }` to `matrix.metadata.data_sources`.

In the summary output (the `!quietMode` block), add a line for unit test coverage:
```
process.stdout.write(TAG + '   Unit test coverage: ' + (utcMatched) + ' requirements matched\n');
```

**Step 4 — Create `commands/qgsd/formal-test-sync.md` skill definition:**

Follow the exact pattern from `commands/qgsd/health.md`:

```markdown
---
name: qgsd:formal-test-sync
description: Cross-reference formal model invariants with unit test coverage, validate constants, and generate test stubs
argument-hint: [--report-only] [--dry-run] [--json] [--stubs-dir=<path>]
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
---
<objective>
Cross-reference formal model invariants with unit test coverage. Reports gaps where invariants lack test backing, validates formal model constants against runtime config defaults, generates test stubs for uncovered requirements, and updates the traceability matrix with unit test coverage data.
</objective>

<execution_context>
None required — self-contained script.
</execution_context>

<process>
Run `node bin/formal-test-sync.cjs $ARGUMENTS` and display results.
If no flags are passed, the full sync runs (coverage report + constants validation + stub generation + sidecar update).
Use `--report-only` for read-only analysis without generating stubs or updating sidecar files.
Use `--json` for machine-readable output.
</process>
```
  </action>
  <verify>
    1. `node --test bin/formal-test-sync.test.cjs` — all tests pass (TC-PARSE, TC-CONST, TC-GAP, TC-STUB, TC-INT categories).
    2. `node bin/formal-test-sync.cjs --json --report-only` — exits 0, output is valid JSON with coverage_gaps and constants_validation keys.
    3. `node bin/formal-test-sync.cjs --report-only` — exits 0, prints human-readable summary.
    4. `node bin/formal-test-sync.cjs` — generates stubs in hooks/generated-stubs/, writes .formal/unit-test-coverage.json, writes .formal/formal-test-sync-report.json.
    5. `node bin/generate-traceability-matrix.cjs --json | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log('utc:', d.metadata.data_sources.unit_test_coverage ? 'present' : 'missing')"` — prints "utc: present".
    6. `cat commands/qgsd/formal-test-sync.md` — skill file exists with correct frontmatter.
  </verify>
  <done>
    formal-test-sync.cjs is a working CLI that produces coverage gap reports, constants validation, test stubs, and a unit-test-coverage sidecar. All test categories pass. generate-traceability-matrix.cjs merges unit test coverage into the matrix. The /qgsd:formal-test-sync skill definition is registered.
  </done>
</task>

</tasks>

<verification>
1. Backward compatibility: `node bin/extract-annotations.cjs --pretty` output unchanged from before.
2. Full pipeline: `node bin/formal-test-sync.cjs --json` produces valid JSON with all sections.
3. Constants validation: Report correctly identifies matching constants (Depth=3 vs oscillation_depth=3) and intentional divergences (CommitWindow=5 vs commit_window=6).
4. Test suite: `node --test bin/formal-test-sync.test.cjs` passes all categories.
5. Traceability integration: `node bin/generate-traceability-matrix.cjs` includes unit_test_coverage in output.
6. Proof-of-concept annotations: `grep -r '@requirement' hooks/qgsd-circuit-breaker.test.js hooks/config-loader.test.js` shows annotations.
</verification>

<success_criteria>
- `node bin/formal-test-sync.cjs --json --report-only` exits 0 with valid JSON
- `node --test bin/formal-test-sync.test.cjs` exits 0 (all tests pass)
- `node bin/extract-annotations.cjs --include-tests --pretty` shows test entries
- `node bin/extract-annotations.cjs --pretty` output is backward-compatible
- `.formal/constants-mapping.json` exists with 7 mappings
- `commands/qgsd/formal-test-sync.md` exists with correct frontmatter
- At least 2 existing test files have `// @requirement` annotations
</success_criteria>

<output>
After completion, create `.planning/quick/139-implement-qgsd-formal-test-sync-command-/139-SUMMARY.md`
</output>

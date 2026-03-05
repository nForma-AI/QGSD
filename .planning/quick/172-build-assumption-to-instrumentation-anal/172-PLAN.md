---
phase: quick-172
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/analyze-assumptions.cjs
  - bin/analyze-assumptions.test.cjs
  - test/fixtures/sample.tla
  - test/fixtures/sample.cfg
  - test/fixtures/sample.als
  - test/fixtures/sample.pm
  - test/fixtures/sample.props
autonomous: true
formal_artifacts: none
requirements: [QUICK-172]

must_haves:
  truths:
    - "Script parses all 3 formal model types (TLA+, Alloy, PRISM) and extracts assumptions and thresholds"
    - "Script cross-references extracted assumptions against observe source handlers and debt ledger entries"
    - "Script outputs a gap report listing uncovered assumptions with proposed metrics and instrumentation snippets"
    - "Script handles missing .formal/ directory and empty files gracefully with stderr warnings"
    - "Debt ledger cross-reference works even when formal_ref is null via fuzzy name matching"
  artifacts:
    - path: "bin/analyze-assumptions.cjs"
      provides: "Assumption-to-instrumentation analysis CLI"
      min_lines: 200
    - path: "bin/analyze-assumptions.test.cjs"
      provides: "Unit tests for all extraction and gap analysis functions"
      min_lines: 100
    - path: "test/fixtures/sample.tla"
      provides: "Synthetic TLA+ fixture for hermetic tests"
    - path: "test/fixtures/sample.als"
      provides: "Synthetic Alloy fixture for hermetic tests"
    - path: "test/fixtures/sample.pm"
      provides: "Synthetic PRISM fixture for hermetic tests"
  key_links:
    - from: "bin/analyze-assumptions.cjs"
      to: ".formal/tla/*.tla"
      via: "fs.readFileSync + regex extraction of ASSUME, CONSTANT, INVARIANT"
      pattern: "readFileSync.*\\.tla"
    - from: "bin/analyze-assumptions.cjs"
      to: ".formal/alloy/*.als"
      via: "fs.readFileSync + regex extraction of fact, assert, sig constraints"
      pattern: "readFileSync.*\\.als"
    - from: "bin/analyze-assumptions.cjs"
      to: ".formal/prism/*.pm"
      via: "fs.readFileSync + regex extraction of const, module bounds, reward thresholds"
      pattern: "readFileSync.*\\.pm"
    - from: "bin/analyze-assumptions.cjs"
      to: "bin/debt-ledger.cjs"
      via: "require for readDebtLedger with explicit path argument"
      pattern: "readDebtLedger.*debt\\.json"
    - from: "bin/analyze-assumptions.cjs"
      to: "bin/observe-handlers.cjs"
      via: "require to populate registry before calling listHandlers"
      pattern: "require.*observe-handlers"
    - from: "bin/analyze-assumptions.cjs"
      to: "bin/observe-registry.cjs"
      via: "require for listHandlers (after handlers are registered)"
      pattern: "require.*observe-registry"
---

<objective>
Build a CLI script that parses formal models (TLA+, Alloy, PRISM) to extract key assumptions and thresholds, cross-references them against observe source handlers and the debt ledger, outputs a gap report identifying uncovered assumptions, proposes metrics for each gap, and generates instrumentation code snippets for uncovered assumptions.

Purpose: Close the observability loop by identifying which formal model assumptions lack production monitoring, ensuring every critical threshold/invariant has a corresponding observe source or debt entry tracking it.

Output: `bin/analyze-assumptions.cjs` CLI tool + tests + synthetic fixtures
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@bin/extractFormalExpected.cjs
@bin/compareDrift.cjs
@bin/sweepPtoF.cjs
@bin/debt-ledger.cjs
@bin/observe-handlers.cjs
@bin/observe-registry.cjs
@bin/detect-coverage-gaps.cjs
@.formal/tla/MCsafety.cfg
@.formal/tla/MCdispatch.cfg
@.formal/tla/QGSDQuorum.tla
@.formal/alloy/quorum-votes.als
@.formal/prism/quorum.pm
@.formal/prism/quorum.props
@.formal/debt.schema.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Build assumption extraction engine and gap analysis core</name>
  <files>bin/analyze-assumptions.cjs</files>
  <action>
Create `bin/analyze-assumptions.cjs` as a CommonJS module with CLI entrypoint. Structure:

**1. TLA+ Parser (`extractTlaAssumptions(filePath)`):**
- Read `.tla` files, extract:
  - `ASSUME` statements (e.g., `ASSUME MaxDeliberation \in Nat /\ MaxDeliberation > 0`) -> assumption with name derived from the variable, threshold from the constraint
  - `CONSTANTS` declarations (e.g., `MaxDeliberation, MaxSize`) -> parameters that represent tunable thresholds
  - `INVARIANT` names from `---- MODULE` blocks and cfg files -> safety properties that must hold
- Also parse paired `.cfg` files from `.formal/tla/MC*.cfg` to extract concrete constant values (e.g., `MaxDeliberation = 9`, `MaxSlots = 4`)
- Return array of `{ source: 'tla', file, name, type: 'assume'|'constant'|'invariant', value, rawText }`
- **Edge case (opencode-1):** If file is empty (0 bytes), log `[warn] Skipping empty TLA+ file: ${filePath}` to stderr and return `[]`. If file read throws (permission, encoding), log warning to stderr and return `[]` (fail-open).

**2. Alloy Parser (`extractAlloyAssumptions(filePath)`):**
- Read `.als` files, extract:
  - `fact` blocks with name (e.g., `fact AgentCount { #Agent = 5 }`) -> structural assumptions
  - `assert` blocks (e.g., `assert ThresholdPasses`) -> safety assertions
  - Numeric constraints in facts/predicates (e.g., `r.polled >= 1`, `#Agent = 5`) -> thresholds
- Return array of `{ source: 'alloy', file, name, type: 'fact'|'assert'|'constraint', value, rawText }`
- **Edge case (opencode-1):** Same empty-file and read-error handling as TLA+ parser — warn to stderr, return `[]`.

**3. PRISM Parser (`extractPrismAssumptions(filePath)`):**
- Read `.pm` files, extract:
  - `const` declarations (e.g., `const double tp_rate;`) -> parameters needing empirical values
  - Module variable bounds (e.g., `s : [0..2]`) -> state space assumptions
  - Transition rate expressions (e.g., `tp_rate * (1 - unavail)`) -> composed thresholds
- Also parse paired `.props` files for property thresholds (e.g., `F<=9`, `F<=10`)
- Return array of `{ source: 'prism', file, name, type: 'const'|'bound'|'property', value, rawText }`
- **Edge case (opencode-1):** Same empty-file and read-error handling. Also handle missing `.props` gracefully (warn to stderr, skip props extraction).

**4. Scanner (`scanAllFormalModels(root)`):**
- **CRITICAL (opencode-1):** Before globbing, check if the `.formal/` directory exists. If it does not exist, log `[warn] .formal/ directory not found at ${root} — returning empty results` to stderr and return `[]`. Do NOT throw.
- Glob `.formal/tla/*.tla` (excluding `*_TTrace_*.tla` trace files), `.formal/alloy/*.als`, `.formal/prism/*.pm`
- Run appropriate parser on each file
- Return flat array of all extracted assumptions

**5. Cross-reference (`crossReference(assumptions, options)`):**
- **CRITICAL (claude-3 #1):** `readDebtLedger` requires a path argument. Resolve the debt ledger path as: `path.join(options.root || process.cwd(), '.formal', 'debt.json')`. Pass this resolved path to `readDebtLedger(ledgerPath)`. If the file does not exist, treat as empty ledger (no crash).
- **CRITICAL (claude-3 #3):** Before calling `listHandlers()`, require `observe-handlers.cjs` to ensure handlers are registered in the in-memory Map: `require('./observe-handlers.cjs');` then `const { listHandlers } = require('./observe-registry.cjs');`. Without this require, `listHandlers()` returns empty and all assumptions appear uncovered.
- For each assumption, check debt ledger coverage using a **two-tier matching strategy (claude-3 #2)**:
  1. **Primary match:** Does a debt entry have `formal_ref` matching format `spec:{file}:{name}`? (e.g., `spec:.formal/tla/QGSDQuorum.tla:MaxDeliberation`)
  2. **Fallback fuzzy match:** If `formal_ref` is null/missing, check if `debt_entry.id` or `debt_entry.description` contains the assumption `name` (case-insensitive substring match). This handles the common case where debt entries exist but were never linked via `formal_ref`.
  - Document the matching heuristic in a code comment at the top of the function.
- For observe handler matching:
  - Numeric thresholds (constants, bounds, property thresholds) -> look for `bash` or `internal` handler types that could emit gauge/counter metrics
  - State invariants (INVARIANT, assert) -> look for `internal` or `bash` handler types
  - If handler type exists in registered handlers but no specific config targets this assumption -> classify as `partial`
- Classify each assumption as: `covered` (debt entry or handler exists), `partial` (handler type exists but no specific config), `uncovered` (nothing monitors this)

**6. Gap Report (`generateGapReport(crossRefResults)`):**
- For each uncovered/partial assumption, generate:
  - `metric_name`: **MUST use canonical `qgsd_` prefix (copilot-1 #1)**. Generate via: lowercase assumption name, replace non-alphanumeric with `_`, prefix with `qgsd_`. Examples: `qgsd_max_deliberation_rounds`, `qgsd_agent_count`, `qgsd_tp_rate`. If collision detected (two assumptions produce same metric_name), append `__{source}` suffix (e.g., `qgsd_max_size__tla` vs `qgsd_max_size__alloy`).
  - `metric_type`: counter|gauge|histogram (gauge for thresholds/bounds, counter for events, histogram for latency/rate distributions)
  - `instrumentation_snippet`: a code snippet showing how to add an observe bash source or internal handler that would monitor this assumption. Use the observe handler pattern from `bin/observe-handlers.cjs` (return `{ source_label, source_type, status, issues }` schema).
- Return structured JSON: `{ total_assumptions, covered, partial, uncovered, gaps: [...] }`

**7. CLI entrypoint:**
- `node bin/analyze-assumptions.cjs` — scan, cross-reference, output JSON report to stdout
- `--output=path` — also write markdown gap report to file (default: `.formal/assumption-gaps.md`)
- `--json` — JSON only output (no markdown)
- `--verbose` — include covered assumptions in output too
- Exit code: 0 if no uncovered, 1 if uncovered gaps exist

Follow project patterns:
- `'use strict';` at top
- Fail-open on parse errors (skip unparseable files, log to stderr)
- Use `require('node:fs')` and `require('node:path')` (node: prefix)
- Export all functions for testing: `module.exports = { extractTlaAssumptions, extractAlloyAssumptions, extractPrismAssumptions, scanAllFormalModels, crossReference, generateGapReport }`
- Follow the same code style as `bin/detect-coverage-gaps.cjs` and `bin/extractFormalExpected.cjs`
  </action>
  <verify>
Run: `node -e "const m = require('./bin/analyze-assumptions.cjs'); console.log(Object.keys(m))"` — should list all 6 exported functions.
Run: `node bin/analyze-assumptions.cjs --json 2>/dev/null | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); const j=JSON.parse(d); console.log('total:', j.total_assumptions, 'gaps:', j.gaps?.length)"` — should show non-zero total_assumptions.
  </verify>
  <done>
Script parses all TLA+/Alloy/PRISM files under `.formal/`, extracts assumptions/thresholds/invariants, cross-references against debt ledger and observe handlers, and outputs a structured gap report with proposed metrics and instrumentation snippets for every uncovered assumption. Missing `.formal/` dir, empty files, and null `formal_ref` entries are all handled gracefully.
  </done>
</task>

<task type="auto">
  <name>Task 2: Create test fixtures and comprehensive unit tests</name>
  <files>
test/fixtures/sample.tla
test/fixtures/sample.cfg
test/fixtures/sample.als
test/fixtures/sample.pm
test/fixtures/sample.props
bin/analyze-assumptions.test.cjs
  </files>
  <action>
**Step 1: Create synthetic fixture files (copilot-1 #2) under `test/fixtures/`:**

Create `test/fixtures/sample.tla`:
```
---- MODULE sample ----
CONSTANTS MaxRetries, Timeout
ASSUME MaxRetries \in Nat /\ MaxRetries > 0
ASSUME Timeout \in Nat /\ Timeout >= 100
SampleInvariant == TRUE
====
```

Create `test/fixtures/sample.cfg`:
```
CONSTANTS
MaxRetries = 3
Timeout = 500
INVARIANT SampleInvariant
```

Create `test/fixtures/sample.als`:
```
module sample
sig Agent {}
fact AgentCount { #Agent = 5 }
assert ThresholdPasses { all a: Agent | a.score >= 1 }
pred ValidState { #Agent > 0 }
```

Create `test/fixtures/sample.pm`:
```
dtmc
const double tp_rate;
const int max_rounds = 9;
module Main
  s : [0..2] init 0;
  [step] s=0 -> tp_rate : (s'=1) + (1-tp_rate) : (s'=2);
endmodule
```

Create `test/fixtures/sample.props`:
```
P>=0.95 [ F<=9 "success" ]
P<=0.01 [ F<=10 "failure" ]
```

These fixtures make tests hermetic — no dependency on the actual `.formal/` directory contents for unit tests.

**Step 2: Create `bin/analyze-assumptions.test.cjs`** using Node's built-in `node:test` and `node:assert` (project standard — see existing test files like `bin/detect-coverage-gaps.test.cjs`).

Test groups:

**TLA+ extraction tests (use `test/fixtures/sample.tla` + `sample.cfg`):**
- Parse `test/fixtures/sample.tla` -> verify MaxRetries and Timeout ASSUME extracted, CONSTANTS extracted
- Parse `test/fixtures/sample.cfg` -> verify concrete values (MaxRetries=3, Timeout=500), INVARIANT SampleInvariant extracted
- Handle empty file gracefully (create temp empty .tla, fail-open, return empty array)
- Handle non-existent file gracefully (return empty array, no throw)

**Alloy extraction tests (use `test/fixtures/sample.als`):**
- Parse `test/fixtures/sample.als` -> extract fact AgentCount with value=5
- Extract assert ThresholdPasses with type=assert
- Handle file with no extractable assumptions -> return empty array

**PRISM extraction tests (use `test/fixtures/sample.pm` + `sample.props`):**
- Parse `test/fixtures/sample.pm` -> extract const tp_rate, const max_rounds=9
- Extract bound `s : [0..2]`
- Parse `test/fixtures/sample.props` -> extract property thresholds F<=9, F<=10
- Handle missing .props file gracefully (no throw)

**Scanner edge case tests (opencode-1):**
- Call `scanAllFormalModels('/nonexistent/path')` -> returns `[]` with stderr warning, no throw
- Call scanner on directory with no `.formal/` subdir -> returns `[]`

**Cross-reference tests:**
- Mock debt ledger with entry having `formal_ref: 'spec:sample.tla:MaxRetries'` -> assumption marked as covered
- Mock debt ledger with entry having `formal_ref: null` but `id: 'debt-maxretries'` containing "MaxRetries" in description -> assumption marked as covered via fuzzy match (claude-3 #2)
- Empty debt ledger + no matching handler -> assumption marked as uncovered
- Partial match (handler type 'bash' registered, no specific config for this assumption) -> marked partial

**Gap report tests:**
- Uncovered assumption generates metric_name with `qgsd_` prefix (copilot-1 #1), metric_type, and instrumentation_snippet
- Two assumptions with same base name from different sources get collision-suffixed metric names (e.g., `qgsd_max_size__tla`, `qgsd_max_size__alloy`)
- Covered assumptions excluded from gaps array (unless --verbose)
- Report JSON has correct total_assumptions, covered, partial, uncovered counts

**Integration test:**
- Run scanAllFormalModels against real `.formal/` directory
- Verify total_assumptions > 0
- Verify no crash on full scan

Use `describe`/`it` via `node:test`. Follow exact pattern from `bin/detect-coverage-gaps.test.cjs`.
  </action>
  <verify>
Run: `node --test bin/analyze-assumptions.test.cjs` — all tests pass.
  </verify>
  <done>
All unit tests pass covering TLA+/Alloy/PRISM extraction, cross-referencing logic (including fuzzy matching fallback), scanner edge cases (missing dirs, empty files), metric naming with qgsd_ prefix and collision handling, and gap report generation. Fixtures are hermetic. Integration test confirms real formal models parse without errors.
  </done>
</task>

</tasks>

<verification>
1. `node bin/analyze-assumptions.cjs --json` produces valid JSON with `total_assumptions > 0`
2. `node bin/analyze-assumptions.cjs` produces markdown gap report at `.formal/assumption-gaps.md`
3. `node --test bin/analyze-assumptions.test.cjs` — all tests pass
4. Script handles all 32 TLA+ cfg files, 40+ Alloy models, and 5 PRISM models without errors
5. Script gracefully handles missing `.formal/` directory (returns empty results, no crash)
6. Debt ledger cross-reference works with both `formal_ref` matches and fuzzy name matches
</verification>

<success_criteria>
- Script extracts assumptions from all 3 formal model types (TLA+, Alloy, PRISM)
- Cross-reference correctly identifies covered vs uncovered assumptions using debt ledger (with formal_ref primary + fuzzy fallback matching) and observe handlers (with observe-handlers.cjs pre-loaded)
- Gap report includes proposed metric names (qgsd_ prefixed, collision-safe), types, and instrumentation code snippets for each uncovered assumption
- All tests pass using hermetic fixtures, fail-open behavior confirmed on malformed inputs, missing dirs, and empty files
- CLI exits 0 when fully covered, 1 when gaps exist
</success_criteria>

<output>
After completion, create `.planning/quick/172-build-assumption-to-instrumentation-anal/172-SUMMARY.md`
</output>

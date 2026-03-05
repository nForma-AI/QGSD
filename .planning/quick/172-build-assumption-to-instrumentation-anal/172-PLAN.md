---
phase: quick-172
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/analyze-assumptions.cjs
  - bin/analyze-assumptions.test.cjs
autonomous: true
formal_artifacts: none
requirements: [QUICK-172]

must_haves:
  truths:
    - "Script parses all 3 formal model types (TLA+, Alloy, PRISM) and extracts assumptions and thresholds"
    - "Script cross-references extracted assumptions against observe source handlers and debt ledger entries"
    - "Script outputs a gap report listing uncovered assumptions with proposed metrics and instrumentation snippets"
  artifacts:
    - path: "bin/analyze-assumptions.cjs"
      provides: "Assumption-to-instrumentation analysis CLI"
      min_lines: 200
    - path: "bin/analyze-assumptions.test.cjs"
      provides: "Unit tests for all extraction and gap analysis functions"
      min_lines: 100
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
      via: "require for readDebtLedger"
      pattern: "require.*debt-ledger"
    - from: "bin/analyze-assumptions.cjs"
      to: "bin/observe-registry.cjs"
      via: "require for listHandlers"
      pattern: "require.*observe-registry"
---

<objective>
Build a CLI script that parses formal models (TLA+, Alloy, PRISM) to extract key assumptions and thresholds, cross-references them against observe source handlers and the debt ledger, outputs a gap report identifying uncovered assumptions, proposes metrics for each gap, and generates instrumentation code snippets for uncovered assumptions.

Purpose: Close the observability loop by identifying which formal model assumptions lack production monitoring, ensuring every critical threshold/invariant has a corresponding observe source or debt entry tracking it.

Output: `bin/analyze-assumptions.cjs` CLI tool + tests
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

**2. Alloy Parser (`extractAlloyAssumptions(filePath)`):**
- Read `.als` files, extract:
  - `fact` blocks with name (e.g., `fact AgentCount { #Agent = 5 }`) -> structural assumptions
  - `assert` blocks (e.g., `assert ThresholdPasses`) -> safety assertions
  - Numeric constraints in facts/predicates (e.g., `r.polled >= 1`, `#Agent = 5`) -> thresholds
- Return array of `{ source: 'alloy', file, name, type: 'fact'|'assert'|'constraint', value, rawText }`

**3. PRISM Parser (`extractPrismAssumptions(filePath)`):**
- Read `.pm` files, extract:
  - `const` declarations (e.g., `const double tp_rate;`) -> parameters needing empirical values
  - Module variable bounds (e.g., `s : [0..2]`) -> state space assumptions
  - Transition rate expressions (e.g., `tp_rate * (1 - unavail)`) -> composed thresholds
- Also parse paired `.props` files for property thresholds (e.g., `F<=9`, `F<=10`)
- Return array of `{ source: 'prism', file, name, type: 'const'|'bound'|'property', value, rawText }`

**4. Scanner (`scanAllFormalModels(root)`):**
- Glob `.formal/tla/*.tla` (excluding `*_TTrace_*.tla` trace files), `.formal/alloy/*.als`, `.formal/prism/*.pm`
- Run appropriate parser on each file
- Return flat array of all extracted assumptions

**5. Cross-reference (`crossReference(assumptions, options)`):**
- Load debt ledger via `require('./debt-ledger.cjs').readDebtLedger()`
- Load observe handler list via `require('./observe-registry.cjs').listHandlers()`
- For each assumption, check:
  - Does a debt entry with matching `formal_ref` exist? (format: `spec:{path}:{param}`)
  - Does an observe handler type exist that could monitor this? (heuristic: numeric thresholds -> prometheus/grafana, state invariants -> internal/bash)
- Classify each assumption as: `covered` (debt entry or handler exists), `partial` (handler type exists but no specific config), `uncovered` (nothing monitors this)

**6. Gap Report (`generateGapReport(crossRefResults)`):**
- For each uncovered/partial assumption, generate:
  - `metric_name`: suggested metric (e.g., `qgsd_max_deliberation_rounds`, `qgsd_agent_count`)
  - `metric_type`: counter|gauge|histogram
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
Script parses all TLA+/Alloy/PRISM files under `.formal/`, extracts assumptions/thresholds/invariants, cross-references against debt ledger and observe handlers, and outputs a structured gap report with proposed metrics and instrumentation snippets for every uncovered assumption.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add comprehensive unit tests</name>
  <files>bin/analyze-assumptions.test.cjs</files>
  <action>
Create `bin/analyze-assumptions.test.cjs` using Node's built-in `node:test` and `node:assert` (project standard — see existing test files like `bin/detect-coverage-gaps.test.cjs`).

Test groups:

**TLA+ extraction tests:**
- Parse a synthetic TLA+ string with ASSUME, CONSTANTS, INVARIANT -> verify correct extraction
- Parse real `QGSDQuorum.tla` header (first 30 lines) -> verify MaxDeliberation, MaxSize, Agents extracted
- Parse MCsafety.cfg -> verify concrete values (MaxDeliberation=9, MaxSize=3) extracted
- Handle malformed/empty TLA+ gracefully (fail-open, return empty array)

**Alloy extraction tests:**
- Parse synthetic Alloy with fact, assert blocks -> verify extraction
- Parse `fact AgentCount { #Agent = 5 }` -> extract name=AgentCount, value=5
- Parse `assert ThresholdPasses` -> extract name=ThresholdPasses, type=assert
- Handle files with no extractable assumptions -> return empty array

**PRISM extraction tests:**
- Parse synthetic PRISM with const declarations -> verify extraction
- Parse `const double tp_rate;` -> extract name=tp_rate, type=const
- Parse `s : [0..2]` -> extract bound with range
- Parse `.props` file `F<=9` -> extract property threshold
- Handle missing .props file gracefully

**Cross-reference tests:**
- Mock debt ledger with matching formal_ref -> assumption marked as covered
- Empty debt ledger + no matching handler -> assumption marked as uncovered
- Partial match (handler type exists, no specific config) -> marked partial

**Gap report tests:**
- Uncovered assumption generates metric_name, metric_type, and instrumentation_snippet
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
All unit tests pass covering TLA+/Alloy/PRISM extraction, cross-referencing logic, and gap report generation. Integration test confirms real formal models parse without errors.
  </done>
</task>

</tasks>

<verification>
1. `node bin/analyze-assumptions.cjs --json` produces valid JSON with `total_assumptions > 0`
2. `node bin/analyze-assumptions.cjs` produces markdown gap report at `.formal/assumption-gaps.md`
3. `node --test bin/analyze-assumptions.test.cjs` — all tests pass
4. Script handles all 32 TLA+ cfg files, 40+ Alloy models, and 5 PRISM models without errors
</verification>

<success_criteria>
- Script extracts assumptions from all 3 formal model types (TLA+, Alloy, PRISM)
- Cross-reference correctly identifies covered vs uncovered assumptions using debt ledger and observe handlers
- Gap report includes proposed metric names, types, and instrumentation code snippets for each uncovered assumption
- All tests pass, fail-open behavior confirmed on malformed inputs
- CLI exits 0 when fully covered, 1 when gaps exist
</success_criteria>

<output>
After completion, create `.planning/quick/172-build-assumption-to-instrumentation-anal/172-SUMMARY.md`
</output>

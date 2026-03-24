---
phase: quick-347
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/formal-coverage-intersect.cjs
  - bin/formal-coverage-intersect.test.cjs
  - core/workflows/model-driven-fix.md
  - core/workflows/quick.md
  - core/workflows/execute-phase.md
autonomous: true
formal_artifacts: none
must_haves:
  truths:
    - "Executor auto-detects when code changes intersect formal model coverage at commit time"
    - "model-driven-fix --sync skips diagnosis phases and runs only affected checker verification"
    - "Formal model updates are included in the same atomic commit as code changes"
  artifacts:
    - path: "bin/formal-coverage-intersect.cjs"
      provides: "Maps changed files to affected formal models via scope.json source_files"
      exports: ["main CLI with --files flag, JSON output"]
    - path: "bin/formal-coverage-intersect.test.cjs"
      provides: "Unit tests for coverage intersection logic"
  key_links:
    - from: "bin/formal-coverage-intersect.cjs"
      to: ".planning/formal/spec/*/scope.json"
      via: "reads source_files arrays from each scope.json"
      pattern: "scope\\.json"
    - from: "bin/formal-coverage-intersect.cjs"
      to: ".planning/formal/model-registry.json"
      via: "maps matched modules to model file paths"
      pattern: "model-registry"
    - from: "core/workflows/quick.md"
      to: "bin/formal-coverage-intersect.cjs"
      via: "executor calls before atomic commit"
      pattern: "formal-coverage-intersect"
    - from: "core/workflows/execute-phase.md"
      to: "bin/formal-coverage-intersect.cjs"
      via: "executor calls before atomic commit"
      pattern: "formal-coverage-intersect"
  consumers:
    - artifact: "bin/formal-coverage-intersect.cjs"
      consumed_by: "core/workflows/quick.md executor step + core/workflows/execute-phase.md"
      integration: "Called before atomic commit to detect coverage intersection"
      verify_pattern: "formal-coverage-intersect"
---

<objective>
Implement hybrid A+B formal model sync: a coverage intersection detector that maps changed files to formal models, a --sync mode for model-driven-fix that runs only verification (no diagnosis), and executor-side auto-detection wiring in quick.md and execute-phase.md so formal model updates happen atomically with code changes.

Purpose: Close the gap where code changes silently drift from formal model coverage. Currently formal checks only run post-execution in --full mode. This makes model sync automatic and atomic at commit time.
Output: bin/formal-coverage-intersect.cjs + tests, updated model-driven-fix.md with --sync, updated executor workflows with auto-detection logic.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@core/workflows/model-driven-fix.md
@core/workflows/quick.md
@core/workflows/execute-phase.md
@.planning/formal/model-registry.json
@.planning/formal/spec/quorum/scope.json (example scope.json structure)
@bin/formal-scope-scan.cjs (reference for scope.json reading patterns)
@bin/run-formal-verify.cjs (reference for --scope flag and model runner)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create formal-coverage-intersect.cjs with tests</name>
  <files>
    bin/formal-coverage-intersect.cjs
    bin/formal-coverage-intersect.test.cjs
  </files>
  <action>
Create bin/formal-coverage-intersect.cjs — a CLI tool that takes a list of changed files and returns which formal models have coverage intersection.

**Algorithm:**
1. Accept `--files file1,file2,...` (comma-separated changed file paths, relative to project root)
2. Accept `--format json|csv` (default: json)
3. Scan all `.planning/formal/spec/*/scope.json` files
4. For each scope.json, check if any entry in `source_files` array matches any of the input `--files` (use glob matching via minimatch or simple path.basename prefix matching — follow the pattern in formal-scope-scan.cjs which already does source file overlap in Layer 1)
5. For matched modules, look up corresponding model files in `.planning/formal/model-registry.json` by matching the module name (spec directory name) against model file path segments
6. Return JSON array of `{ module, model_path, formalism, requirements }` for each matched model

**JSON output format:**
```json
{
  "intersections": [
    {
      "module": "quorum",
      "scope_path": ".planning/formal/spec/quorum/scope.json",
      "model_paths": [".planning/formal/alloy/quorum-votes.als", ".planning/formal/prism/quorum.pm"],
      "formalism": ["alloy", "prism"],
      "matched_files": ["bin/run-quorum.cjs"]
    }
  ],
  "total_models_affected": 2
}
```

**CSV output:** one line per model path (for piping to run-formal-verify.cjs --scope).

**Edge cases:**
- No scope.json files exist: return empty intersections, exit 0
- model-registry.json missing: still return module matches from scope.json but without model_paths, exit 0
- No --files provided: error with usage message, exit 1
- No intersections found: return empty array, exit 0

Follow existing patterns from formal-scope-scan.cjs for file reading, error handling (fail-open), and output formatting. Use `require('path')` and `require('fs')` only — no external dependencies.

**Tests (bin/formal-coverage-intersect.test.cjs):**
Use the project's existing test pattern (check other .test.cjs files in bin/). Write tests for:
- Empty files list returns error
- Known file (e.g., "bin/run-quorum.cjs") returns quorum module intersection
- Unknown file returns empty intersections
- CSV format outputs one line per model
- Missing scope.json directory returns empty (fail-open)
- Module with no model-registry entry still returns module info without model_paths
  </action>
  <verify>
    node bin/formal-coverage-intersect.cjs --files "bin/run-quorum.cjs" --format json 2>&1 | grep -q '"module"'
    node bin/formal-coverage-intersect.cjs --files "bin/run-quorum.cjs" --format csv 2>&1 | grep -q 'quorum'
    node bin/formal-coverage-intersect.test.cjs
  </verify>
  <done>
    formal-coverage-intersect.cjs returns correct model intersections for known source files, returns empty for unknown files, and all tests pass.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add --sync mode to model-driven-fix and wire executor auto-detection</name>
  <files>
    core/workflows/model-driven-fix.md
    core/workflows/quick.md
    core/workflows/execute-phase.md
  </files>
  <action>
**Part A: Add --sync mode to model-driven-fix.md**

In the Phase 0 (parse_arguments) step of model-driven-fix.md, add a new flag:
- `--sync`: Sync mode — skips phases 1-3 (discovery/reproduction/refinement), requires `--models` to specify which model files to verify
- `--models`: Comma-separated model file paths (required when --sync is used)

Add a new step after Phase 0, before Phase 1:

```
## Sync Mode Fast Path (--sync)

If `$SYNC_MODE` is true:
  - Validate --models is provided (error if empty)
  - Parse $MODELS into array of model file paths
  - For each model in $MODELS:
    - Determine formalism from file extension (.tla -> tla, .als -> alloy, .pm -> prism)
    - Run the appropriate checker:
      - TLA+: node bin/run-tlc.cjs "$MODEL_PATH"
      - Alloy: node bin/run-alloy.cjs "$MODEL_PATH"
      - PRISM: node bin/run-prism-verify.cjs "$MODEL_PATH" (if exists)
    - If checker PASSES: Display "Sync: {model} OK"
    - If checker FAILS: Display "Sync: {model} VIOLATION — model needs update"
      - Set $SYNC_NEEDS_UPDATE = true
      - Add model path to $MODELS_NEEDING_UPDATE array
  - If $SYNC_NEEDS_UPDATE:
    Display: "Formal models need update. Run /nf:model-driven-fix (full mode) to fix: {model list}"
    Exit with code 1
  - If all pass:
    Display: "Sync: All {N} model(s) verified. No updates needed."
    Exit with code 0
  - Exit workflow (do not continue to Phase 1)
```

Add `--sync` and `--models` to the constraints section and success_criteria.

**Part B: Wire auto-detection into quick.md executor**

In quick.md, find the executor constraint block (around line 556-561 where `formal_artifacts` commits are described). BEFORE the atomic commit instruction, add:

```
- Before each atomic commit, run formal coverage intersection detection:
  1. Compute changed files for this task: `git diff --name-only HEAD` (staged + unstaged changes)
  2. Run: `node bin/formal-coverage-intersect.cjs --files "$(git diff --name-only HEAD | tr '\n' ',')" --format json 2>/dev/null`
  3. If the result has `total_models_affected > 0` OR the plan declares `formal_artifacts: update`:
     - Run: `node bin/formal-coverage-intersect.cjs --files "$(git diff --name-only HEAD | tr '\n' ',')" --format csv 2>/dev/null` to get model list
     - Run scoped verification: `node bin/run-formal-verify.cjs --scope="$MODEL_CSV" 2>&1`
     - If any model checker fails: log warning "Formal model drift detected in: {models}" but do NOT block the commit (fail-open, consistent with existing formal check behavior)
     - If all pass: log "Formal coverage verified: {N} model(s) OK"
  4. Fail-open: If formal-coverage-intersect.cjs errors or is not found, skip silently and proceed with commit
```

Place this AFTER the existing `formal_artifacts` instruction (line 560-561) but BEFORE the commit command. This is additive — it does NOT replace the existing formal_artifacts handling.

**Part C: Wire same auto-detection into execute-phase.md**

In execute-phase.md, find the equivalent atomic commit section (around line 427-444 where formal checks happen). Add the same coverage intersection detection logic as Part B, using the same pattern. Place it alongside the existing `run-formal-check.cjs` invocation — it augments the existing check, does not replace it.

**Important:** Both workflow edits MUST preserve all existing content. These are additive insertions only. Do NOT remove or modify existing formal_artifacts handling, formal check steps, or constraint text.
  </action>
  <verify>
    grep -q '\-\-sync' core/workflows/model-driven-fix.md
    grep -q '\-\-models' core/workflows/model-driven-fix.md
    grep -q 'formal-coverage-intersect' core/workflows/quick.md
    grep -q 'formal-coverage-intersect' core/workflows/execute-phase.md
  </verify>
  <done>
    model-driven-fix.md has --sync mode that skips phases 1-3 and runs only checker verification. quick.md and execute-phase.md both have pre-commit auto-detection that calls formal-coverage-intersect.cjs before atomic commits to detect coverage drift. All changes are additive — existing behavior preserved.
  </done>
</task>

</tasks>

<verification>
- bin/formal-coverage-intersect.cjs exists and returns correct JSON for known source files
- bin/formal-coverage-intersect.test.cjs passes all tests
- model-driven-fix.md parses --sync and --models flags, has sync fast-path step
- quick.md executor constraints include pre-commit coverage intersection detection
- execute-phase.md includes same pre-commit coverage intersection detection
- All three workflows preserve existing behavior (additive changes only)
- Existing `npm run test:ci` still passes (no regressions)
</verification>

<success_criteria>
- formal-coverage-intersect.cjs correctly maps changed files to formal models via scope.json source_files
- --sync mode in model-driven-fix runs checker-only verification without diagnosis phases
- Executors auto-detect coverage intersection before atomic commits in both quick and phase workflows
- All detection is fail-open (errors never block commits)
- Tests pass for the new script
</success_criteria>

<output>
After completion, create `.planning/quick/347-implement-hybrid-a-b-formal-model-sync/347-SUMMARY.md`
</output>

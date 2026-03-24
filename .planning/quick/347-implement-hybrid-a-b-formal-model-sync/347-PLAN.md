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
    - "model-driven-fix --sync runs full formal verification (no scoping complexity)"
    - "Formal coverage detection is fail-open — errors never block commits"
  artifacts:
    - path: "bin/formal-coverage-intersect.cjs"
      provides: "Detects whether changed files overlap with any scope.json source_files"
      exports: ["CLI with --files flag, JSON output with affected modules, exit code 0=intersections or 2=none"]
    - path: "bin/formal-coverage-intersect.test.cjs"
      provides: "Unit tests for coverage intersection logic"
  key_links:
    - from: "bin/formal-coverage-intersect.cjs"
      to: ".planning/formal/spec/*/scope.json"
      via: "reads source_files arrays from each scope.json"
      pattern: "scope\\.json"
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
Implement hybrid A+B formal model sync: a coverage intersection detector that checks if changed files overlap with formally-specified code, a --sync mode for model-driven-fix that runs full formal verification, and executor-side auto-detection wiring in quick.md and execute-phase.md.

Key simplification: the detector does NOT try to derive logical scope IDs (cfg names, runner mappings, etc.). It only answers "did code changes touch formally-covered files?" (yes/no). When yes, it runs full `run-formal-verify.cjs` without scoping — this is fast enough (<10s) and avoids the fragile cfg-to-scope-ID mapping.
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
@.planning/formal/spec/quorum/scope.json (example scope.json structure)
@bin/formal-scope-scan.cjs (reference for scope.json reading patterns)
@bin/run-formal-verify.cjs (reference for the checker runner)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create formal-coverage-intersect.cjs with tests</name>
  <files>
    bin/formal-coverage-intersect.cjs
    bin/formal-coverage-intersect.test.cjs
  </files>
  <action>
Create bin/formal-coverage-intersect.cjs — a CLI tool that takes changed file paths and returns which spec modules have coverage overlap.

**Algorithm (simplified — no scope ID derivation):**
1. Accept `--files file1,file2,...` (comma-separated changed file paths, relative to project root)
2. Scan all `.planning/formal/spec/*/scope.json` files
3. For each scope.json, read its `source_files` array (glob patterns like `bin/*.cjs`, `hooks/*.js`)
4. Check if any input file matches any source_files glob (use minimatch or simple prefix matching — follow the pattern in formal-scope-scan.cjs Layer 1)
5. Return JSON with matched modules:

```json
{
  "intersections_found": true,
  "modules": [
    {
      "name": "quorum",
      "scope_path": ".planning/formal/spec/quorum/scope.json",
      "matched_files": ["bin/run-quorum.cjs"]
    }
  ],
  "total_modules_affected": 1
}
```

**Exit codes:**
- 0: Intersections found (formally-covered code was touched)
- 2: No intersections found (safe — no formal models affected)
- 1: Error (bad arguments, etc.)

**Edge cases (all fail-open):**
- No scope.json files exist: exit 2 (no intersections)
- No --files provided: exit 1 with usage message
- scope.json parse error: skip that module, continue
- No intersections found: exit 2

Use `require('path')`, `require('fs')`, `require('child_process')` only — no external deps. Follow patterns from formal-scope-scan.cjs.

**Tests (bin/formal-coverage-intersect.test.cjs):**
Use existing test patterns from bin/*.test.cjs. Test:
- Empty files list returns error (exit 1)
- Known file matching a scope.json source_files glob returns intersection (exit 0)
- Unknown file returns no intersections (exit 2)
- Missing spec directory returns no intersections (exit 2)
- Multiple modules can match the same file
  </action>
  <verify>
    node bin/formal-coverage-intersect.cjs --files "hooks/nf-scope-guard.js" 2>&1 | grep -q '"intersections_found"'
    node bin/formal-coverage-intersect.test.cjs
  </verify>
  <done>
    formal-coverage-intersect.cjs detects when changed files overlap with scope.json source_files. Tests pass.
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
**Part A: Add --sync flag to model-driven-fix.md**

In Phase 0 (parse_arguments), add:
- `--sync`: Sync mode — skips phases 1-3, runs full formal verification only

Add a new step after Phase 0, before Phase 1:

```markdown
## Sync Mode Fast Path (--sync)

If `$SYNC_MODE` is true:
  1. Display: "Sync mode: running full formal verification..."
  2. Run: `node bin/run-formal-verify.cjs 2>&1`
     (No --scope flag — run ALL models. This is fast enough and avoids fragile scope ID mapping.)
  3. If exit 0: Display "Sync: All formal models verified. No drift detected."
  4. If exit 1: Display "Sync: Formal verification found issues — models may need update."
     Display: "Run /nf:model-driven-fix (full mode) to diagnose and fix."
     Exit with code 1
  5. Exit workflow (do not continue to Phase 1)
```

**Part B: Wire auto-detection into quick.md executor constraints**

In quick.md, find the executor constraint block (around lines 556-561). BEFORE the atomic commit instruction, add this new constraint:

```markdown
- **Formal coverage auto-detection (hybrid A+B):** Before each atomic commit:
  1. Get changed files: CHANGED=$(git diff --name-only HEAD 2>/dev/null | tr '\n' ',')
  2. If CHANGED is non-empty, run: node bin/formal-coverage-intersect.cjs --files "$CHANGED" 2>/dev/null
  3. If exit code is 0 (intersections found) OR the plan declares `formal_artifacts: update`:
     - Run: node bin/run-formal-verify.cjs 2>&1
     - If exit 0: log "Formal coverage verified: models OK"
     - If exit 1: log "WARNING: Formal model drift detected" (do NOT block commit — fail-open)
  4. If formal-coverage-intersect.cjs is not found or errors: skip silently (fail-open)
```

This is ADDITIVE — do not remove existing formal_artifacts handling.

**Part C: Wire same auto-detection into execute-phase.md**

In execute-phase.md, find the executor constraints section. Add the identical formal coverage auto-detection logic from Part B. Place it alongside existing formal check references. ADDITIVE only.

**Important:** Both workflow edits MUST preserve all existing content. These are insertions, not replacements.
  </action>
  <verify>
    grep -q '\-\-sync' core/workflows/model-driven-fix.md
    grep -q 'formal-coverage-intersect' core/workflows/quick.md
    grep -q 'formal-coverage-intersect' core/workflows/execute-phase.md
  </verify>
  <done>
    model-driven-fix.md has --sync fast path. quick.md and execute-phase.md both have pre-commit auto-detection. All changes additive.
  </done>
</task>

</tasks>

<verification>
- bin/formal-coverage-intersect.cjs exists and detects coverage overlap
- bin/formal-coverage-intersect.test.cjs passes
- model-driven-fix.md has --sync flag and fast path
- quick.md has pre-commit coverage auto-detection
- execute-phase.md has pre-commit coverage auto-detection
- All workflows preserve existing behavior (additive only)
</verification>

<success_criteria>
- formal-coverage-intersect.cjs maps changed files to affected spec modules via scope.json source_files
- --sync mode in model-driven-fix runs full formal verification without diagnosis phases
- Executors auto-detect coverage intersection before atomic commits
- All detection is fail-open (errors never block commits)
- Tests pass
</success_criteria>

<output>
After completion, create `.planning/quick/347-implement-hybrid-a-b-formal-model-sync/347-SUMMARY.md`
</output>

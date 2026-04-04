---
phase: quick-373
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/nf-solve.cjs
  - bin/nf-solve-baseline-check.test.cjs
  - commands/nf/solve.md
  - core/workflows/progress.md
autonomous: true
formal_artifacts: none
requirements: [INTENT-01]

must_haves:
  truths:
    - "nf-solve.cjs emits a stderr advisory when requirements.json has zero baseline-sourced requirements"
    - "nf-solve.cjs adds a baseline_advisory field to JSON output when baselines are missing"
    - "nf-solve.cjs exits non-zero when --require-baselines flag is set and no baselines exist"
    - "solve.md documents the --require-baselines flag in its argument-hint and flag extraction section"
    - "progress.md nudges the user to run sync-baseline-requirements when baselines are absent"
    - "Layers that return residual=-1 due to missing requirements.json include baseline_missing hint in detail"
  artifacts:
    - path: "bin/nf-solve.cjs"
      provides: "Baseline advisory check in computeResidual + --require-baselines CLI flag"
      contains: "baseline_advisory"
    - path: "bin/nf-solve-baseline-check.test.cjs"
      provides: "Tests for baseline detection logic"
      min_lines: 40
    - path: "commands/nf/solve.md"
      provides: "--require-baselines flag documentation and parsing"
      contains: "require-baselines"
    - path: "core/workflows/progress.md"
      provides: "Baseline nudge in progress report"
      contains: "baseline"
  key_links:
    - from: "bin/nf-solve.cjs"
      to: ".planning/formal/requirements.json"
      via: "provenance.source_file === 'nf-baseline' check"
      pattern: "nf-baseline"
    - from: "commands/nf/solve.md"
      to: "bin/nf-solve.cjs"
      via: "--require-baselines flag forwarded to bin script"
      pattern: "require-baselines"
---

<objective>
Add advisory baseline presence check to the nf:solve pipeline so users are warned when requirements.json contains zero baseline-sourced requirements (provenance.source_file === 'nf-baseline'). Add optional --require-baselines flag for CI hard-fail, inject nudge into nf:progress, and improve DIAG-02 detail for layers that skip due to missing baselines.

Purpose: Silent degradation when baselines are missing causes nf:solve to produce incomplete residual vectors (many layers return -1). Users have no signal that running sync-baseline-requirements would improve coverage.
Output: Advisory warnings, --require-baselines flag, progress nudge, improved DIAG-02 detail, test suite.
</objective>

<execution_context>
@./.claude/nf/workflows/execute-plan.md
@./.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@bin/nf-solve.cjs
@commands/nf/solve.md
@core/workflows/progress.md
@bin/sync-baseline-requirements.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add baseline advisory check and --require-baselines flag to nf-solve.cjs</name>
  <files>bin/nf-solve.cjs, bin/nf-solve-baseline-check.test.cjs</files>
  <action>
  **1a. Add --require-baselines CLI flag parsing** (near line 133, with other flag declarations):
  ```
  const requireBaselines = args.includes('--require-baselines');
  ```

  **1b. Create a `checkBaselinePresence()` helper function** (before `computeResidual()`):
  - Read requirements.json from `path.join(ROOT, '.planning', 'formal', 'requirements.json')`
  - Parse the `requirements` array from the envelope
  - Count how many have `provenance.source_file === 'nf-baseline'` (this is the marker sync-baseline-requirements.cjs sets)
  - Return `{ has_baselines: boolean, baseline_count: number, total_count: number }`
  - Wrap in try/catch, fail-open returning `{ has_baselines: false, baseline_count: 0, total_count: 0, error: msg }`

  **1c. Call `checkBaselinePresence()` at the top of `main()`** (after preflight, before the convergence loop):
  - Call `const baselineCheck = checkBaselinePresence();`
  - If `!baselineCheck.has_baselines`:
    - Write advisory to stderr: `[nf-solve] ADVISORY: requirements.json contains 0 baseline-sourced requirements. Run 'node bin/sync-baseline-requirements.cjs' to populate baselines and improve coverage.`
    - If `requireBaselines` is true: write `[nf-solve] ERROR: --require-baselines set but no baselines found. Aborting.` to stderr and `process.exit(1)`
  - Store `baselineCheck` for inclusion in output

  **1d. Add `baseline_advisory` field to the JSON output** in the final output block (where `solveState` is built, around line 5720):
  - Add to solveState: `baseline_advisory: baselineCheck.has_baselines ? null : { warning: 'no baseline-sourced requirements', suggestion: 'run sync-baseline-requirements.cjs', baseline_count: 0, total_count: baselineCheck.total_count }`

  **1e. Improve detail for layers returning residual=-1 due to missing requirements.json** — in sweepRtoD (line 1669), sweepCtoR (line 2184), and sweepDtoR (line 2603) where they return `residual: -1` with reason 'missing: requirements.json':
  - Add `baseline_hint: 'run sync-baseline-requirements.cjs to populate'` to the detail object alongside the existing `skipped: true, reason: ...` fields. Do NOT change the residual value or the skipped/reason fields — just augment the detail.

  **1f. Create test file `bin/nf-solve-baseline-check.test.cjs`:**
  - Extract `checkBaselinePresence` as a testable function (exported via module.exports when not running as main, or test the function directly via a require guard pattern)
  - Alternative approach if extracting is too invasive: create a standalone test that sets up temp directories with mock requirements.json files and invokes the check logic
  - Test cases:
    - Empty requirements array -> has_baselines: false
    - All requirements have provenance.source_file === 'nf-baseline' -> has_baselines: true
    - Mix of baseline and milestone requirements -> has_baselines: true (count correct)
    - Missing requirements.json file -> has_baselines: false, error field set
    - requirements.json with no provenance field on reqs -> has_baselines: false
  - Use `node:test` runner (describe/it pattern matching existing test files)
  </action>
  <verify>
  ```bash
  node --test bin/nf-solve-baseline-check.test.cjs
  ```
  All tests pass.
  
  ```bash
  node bin/nf-solve.cjs --json --report-only --no-timeout 2>&1 | grep -i "baseline"
  ```
  Shows the advisory on stderr and baseline_advisory field in JSON output.
  </verify>
  <done>
  - checkBaselinePresence() function works and is tested (5+ test cases)
  - --require-baselines flag parsed and causes exit(1) when baselines missing
  - Advisory emitted to stderr when baselines absent
  - baseline_advisory field present in JSON output
  - DIAG-02 layers include baseline_hint in their -1 detail objects
  </done>
</task>

<task type="auto">
  <name>Task 2: Update solve.md flag docs and progress.md baseline nudge</name>
  <files>commands/nf/solve.md, core/workflows/progress.md</files>
  <action>
  **2a. Update `commands/nf/solve.md`:**
  - Add `--require-baselines` to the `argument-hint` line in YAML frontmatter (after existing flags)
  - In the "Flag Extraction" section (around line 42-56), add parsing for the new flag:
    ```
    - If args contain `--require-baselines`, set `requireBaselines = true`. Otherwise, set `requireBaselines = false`.
    ```
  - Forward the flag to bin/nf-solve.cjs in Step 1b bash command (line ~94): append `${requireBaselines ? ' --require-baselines' : ''}` to the BASELINE_RAW command
  - No changes needed to the convergence loop or other phases — the bin script handles the hard-fail itself

  **2b. Update `core/workflows/progress.md`:**
  - In the `<step name="report">` section (around line 86-138), after the `FORMAL=$(...)` command, add a baseline presence check:
    ```bash
    # Check baseline requirement presence
    BASELINE_CHECK=$(node << 'NF_EVAL'
    try {
      const d = JSON.parse(require('fs').readFileSync('.planning/formal/requirements.json', 'utf8'));
      const reqs = d.requirements || [];
      const baselined = reqs.filter(r => r.provenance && r.provenance.source_file === 'nf-baseline').length;
      console.log(JSON.stringify({ has_baselines: baselined > 0, count: baselined, total: reqs.length }));
    } catch (e) { console.log(JSON.stringify({ has_baselines: false, count: 0, total: 0 })); }
    NF_EVAL
    )
    ```
  - In the "Present:" template block, after the "Formal Coverage" section and before "What's Next", add a conditional section:
    ```
    ## Baseline Coverage
    (Only show this section if BASELINE_CHECK.has_baselines is false AND FORMAL.available is true)
    No baseline requirements found. Run `node bin/sync-baseline-requirements.cjs` to populate baselines — this improves /nf:solve coverage across R->D, C->R, and D->R layers.
    ```

  **Important:** Also sync the progress.md change. Since `commands/nf/progress.md` just references `@~/.claude/nf/workflows/progress.md`, the real content is in `core/workflows/progress.md`. The installer copies from `core/workflows/` to `~/.claude/nf/workflows/`, so editing `core/workflows/progress.md` is correct. After editing, copy to installed location:
  ```bash
  cp core/workflows/progress.md ~/.claude/nf/workflows/progress.md
  ```
  </action>
  <verify>
  ```bash
  grep "require-baselines" commands/nf/solve.md
  ```
  Shows the flag in argument-hint and flag extraction.
  
  ```bash
  grep -i "baseline" core/workflows/progress.md
  ```
  Shows the baseline check and nudge section.
  
  ```bash
  diff core/workflows/progress.md ~/.claude/nf/workflows/progress.md
  ```
  No diff (files are synced).
  </verify>
  <done>
  - solve.md documents --require-baselines flag and forwards it to bin/nf-solve.cjs
  - progress.md includes baseline nudge section when baselines are absent
  - Installed workflow copy is synced with repo source
  </done>
</task>

</tasks>

<verification>
1. `node --test bin/nf-solve-baseline-check.test.cjs` — all tests pass
2. `node bin/nf-solve.cjs --json --report-only --no-timeout 2>/dev/null | node -p "JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).baseline_advisory"` — shows advisory object (or use heredoc equivalent)
3. `grep "require-baselines" commands/nf/solve.md` — flag documented
4. `grep "baseline" core/workflows/progress.md` — nudge present
5. `diff core/workflows/progress.md ~/.claude/nf/workflows/progress.md` — synced
</verification>

<success_criteria>
- Advisory stderr message printed when nf-solve detects no baseline requirements
- JSON output includes baseline_advisory field
- --require-baselines flag causes hard exit(1) when baselines missing
- nf:progress shows nudge when baselines absent
- All new tests pass
- No existing tests broken
</success_criteria>

<output>
After completion, create `.planning/quick/373-add-advisory-baseline-check-to-nf-solve-/373-SUMMARY.md`
</output>

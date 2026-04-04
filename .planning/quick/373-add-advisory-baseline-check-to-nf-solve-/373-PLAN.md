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
requirements: [DIAG-02]

must_haves:
  truths:
    - "nf-solve.cjs emits a stderr advisory when requirements.json has zero baseline-sourced requirements"
    - "nf-solve.cjs emits a different stderr advisory when requirements.json is missing entirely"
    - "nf-solve.cjs adds a baseline_advisory field to the jsonObj returned by formatJSON (the --json output), NOT to solveState"
    - "nf-solve.cjs exits non-zero when --require-baselines flag is set and no baselines exist"
    - "--require-baselines is also checked in the Phase 0.5 --execute/--resume path, not only in the Phase 1 fast-path"
    - "solve.md documents the --require-baselines flag in its argument-hint and flag extraction section"
    - "progress.md nudges the user to run sync-baseline-requirements when baselines are absent"
    - "Layers that return residual=-1 due to missing requirements.json include baseline_hint in detail"
    - "checkBaselinePresence() handles JSON.parse failures gracefully (fail-open)"
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
    - from: "bin/nf-solve.cjs jsonObj"
      to: "formatJSON return + post-hoc assignment"
      via: "jsonObj.baseline_advisory = ... after line 5921"
      pattern: "jsonObj\\.baseline_advisory"
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
  - Return `{ has_baselines: boolean, baseline_count: number, total_count: number, file_missing: boolean }`
  - The `file_missing` field distinguishes "file does not exist" from "file exists but has zero baseline entries"
  - Wrap the ENTIRE function body in try/catch. Inside the try:
    - First check `fs.existsSync(reqPath)` — if false, return `{ has_baselines: false, baseline_count: 0, total_count: 0, file_missing: true }`
    - Then `JSON.parse(fs.readFileSync(...))` — if parse fails, the catch handles it
  - Catch block returns `{ has_baselines: false, baseline_count: 0, total_count: 0, file_missing: false, error: e.message }` (fail-open)

  **1c. Call `checkBaselinePresence()` at the top of `main()`** (after preflight, before the convergence loop):
  - Call `const baselineCheck = checkBaselinePresence();`
  - If `!baselineCheck.has_baselines`:
    - **Distinguish the two cases in stderr output:**
      - If `baselineCheck.file_missing`: `[nf-solve] ADVISORY: requirements.json not found. Run 'node bin/sync-baseline-requirements.cjs' to create it with baseline requirements.`
      - Else (file exists, zero baselines): `[nf-solve] ADVISORY: requirements.json contains 0 of ${baselineCheck.total_count} requirements from baselines. Run 'node bin/sync-baseline-requirements.cjs' to populate baselines and improve coverage.`
    - If `requireBaselines` is true: write `[nf-solve] ERROR: --require-baselines set but no baselines found. Aborting.` to stderr and `process.exit(1)`
  - Store `baselineCheck` on a variable accessible to later output code (e.g., closure variable or attach to a shared context)

  **1d. CRITICAL — Add `baseline_advisory` field to the JSON output object (`jsonObj`), NOT to `solveState`.**
  The `--json` output is produced by `formatJSON()` which returns an object at line ~5347. Additional fields are patched onto `jsonObj` after the call (see line 5921-5922 where `jsonObj.oscillating_layers` is added). Add `baseline_advisory` the same way:
  ```javascript
  // After line 5922 (jsonObj.oscillating_layers = ...)
  jsonObj.baseline_advisory = baselineCheck.has_baselines ? null : {
    warning: baselineCheck.file_missing
      ? 'requirements.json not found'
      : 'no baseline-sourced requirements in requirements.json',
    suggestion: baselineCheck.file_missing
      ? 'run sync-baseline-requirements.cjs to create baseline requirements'
      : 'run sync-baseline-requirements.cjs to populate baselines',
    file_missing: baselineCheck.file_missing,
    baseline_count: 0,
    total_count: baselineCheck.total_count
  };
  ```
  Do NOT add this to `solveState` (line 5720) — that object is for solve-state.json persistence, not for --json stdout output.

  **1e. Handle --require-baselines in the Phase 0.5 --execute/--resume bypass path.**
  The `--execute` and `--resume` flags skip Phase 1 entirely (see solve.md lines 60-78). The `checkBaselinePresence()` call from 1c should be placed BEFORE the Phase 0.5 branch point — i.e., it runs regardless of whether --execute/--resume is set. If the code structure makes this awkward, add a second check at the top of the resume path:
  ```javascript
  // In the --execute/--resume path, before loading session:
  if (requireBaselines) {
    const baselineCheck = checkBaselinePresence();
    if (!baselineCheck.has_baselines) {
      process.stderr.write(TAG + ' ERROR: --require-baselines set but no baselines found. Aborting.\n');
      process.exit(1);
    }
  }
  ```
  This ensures `--require-baselines` is enforced even when Phase 1 is bypassed.

  **1f. Improve detail for layers returning residual=-1 due to missing requirements.json** — in sweepRtoD (line 1669), sweepCtoR (line 2184), and sweepDtoR (line 2603) where they return `residual: -1` with reason 'missing: requirements.json':
  - Add `baseline_hint: 'run sync-baseline-requirements.cjs to populate'` to the detail object alongside the existing `skipped: true, reason: ...` fields. Do NOT change the residual value or the skipped/reason fields — just augment the detail.

  **1g. Create test file `bin/nf-solve-baseline-check.test.cjs`:**
  - Follow existing test naming convention in bin/ (check other `.test.cjs` files for pattern)
  - Extract `checkBaselinePresence` as a testable function (exported via module.exports when not running as main, or test the function directly via a require guard pattern)
  - Alternative approach if extracting is too invasive: create a standalone test that sets up temp directories with mock requirements.json files and invokes the check logic
  - Test cases:
    - Empty requirements array -> has_baselines: false, file_missing: false
    - All requirements have provenance.source_file === 'nf-baseline' -> has_baselines: true
    - Mix of baseline and milestone requirements -> has_baselines: true (count correct)
    - Missing requirements.json file -> has_baselines: false, file_missing: true
    - requirements.json with no provenance field on reqs -> has_baselines: false
    - Malformed JSON file (corrupt content) -> fail-open, has_baselines: false, error field set
  - Use `node:test` runner (describe/it pattern matching existing test files)
  </action>
  <verify>
  ```bash
  node --test bin/nf-solve-baseline-check.test.cjs
  ```
  All tests pass (including malformed JSON fail-open test).
  
  ```bash
  node bin/nf-solve.cjs --json --report-only --no-timeout 2>&1 | grep -i "baseline"
  ```
  Shows the advisory on stderr and baseline_advisory field in JSON output.

  ```bash
  # Verify baseline_advisory is on jsonObj, not solveState
  grep 'jsonObj.baseline_advisory' bin/nf-solve.cjs
  ```
  Returns a match.

  ```bash
  # Verify --require-baselines is checked in resume path
  grep -A2 'requireBaselines' bin/nf-solve.cjs | grep -i 'resume\|execute\|session'
  ```
  Shows the flag check appears in or before the resume/execute code path.
  </verify>
  <done>
  - checkBaselinePresence() function works and is tested (6 test cases including malformed JSON)
  - file_missing field distinguishes "no file" from "file with zero baselines"
  - --require-baselines flag parsed and causes exit(1) when baselines missing
  - --require-baselines is enforced in BOTH the fresh-run AND --execute/--resume paths
  - Advisory emitted to stderr with distinct messages for missing-file vs zero-baselines
  - baseline_advisory field present in jsonObj (--json output), NOT in solveState
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
  - **Also forward the flag in the Phase 0.5 resume path** (around line 69 where solve-session.cjs is called and then nf-solve.cjs is invoked for --execute/--resume). Ensure `--require-baselines` is appended to the nf-solve.cjs invocation in that path too, so the flag reaches the bin script even when Phase 1 is bypassed.

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
    } catch (e) { console.log(JSON.stringify({ has_baselines: false, count: 0, total: 0, error: e.message })); }
    NF_EVAL
    )
    ```
    Note: The catch block handles both missing-file and parse errors with fail-open behavior.
  - In the "Present:" template block, after the "Formal Coverage" section and before "What's Next", add a conditional section:
    ```
    ## Baseline Coverage
    (Only show this section if BASELINE_CHECK.has_baselines is false AND FORMAL.available is true)
    No baseline requirements found. Run `node bin/sync-baseline-requirements.cjs` to populate baselines — this improves /nf:solve coverage across R->D, C->R, and D->R layers.
    ```

  **2c. Sync workflow to installed location** (required by project convention — the installer copies from `core/workflows/` to `~/.claude/nf/workflows/`, so edits to core/ must be synced to the installed copy to take effect in the current session):
  ```bash
  cp core/workflows/progress.md ~/.claude/nf/workflows/progress.md
  ```
  This is a standard nForma workflow sync step, not an implementation concern. The repo source (`core/workflows/`) is the durable copy; the installed copy (`~/.claude/nf/workflows/`) is ephemeral and overwritten on next install.
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

  ```bash
  # Verify flag is forwarded in both fresh-run AND resume paths
  grep -c "require-baselines" commands/nf/solve.md
  ```
  Returns 3+ (argument-hint, flag extraction, and forwarding in at least one invocation path).
  </verify>
  <done>
  - solve.md documents --require-baselines flag and forwards it to bin/nf-solve.cjs
  - Flag is forwarded in both the Phase 1 fresh-run path AND the Phase 0.5 --execute/--resume path
  - progress.md includes baseline nudge section when baselines are absent
  - progress.md inline script handles JSON.parse failures gracefully
  - Installed workflow copy is synced with repo source (standard nForma convention)
  </done>
</task>

</tasks>

<verification>
1. `node --test bin/nf-solve-baseline-check.test.cjs` — all tests pass (including malformed JSON fail-open)
2. Verify baseline_advisory field in JSON output:
```bash
node bin/nf-solve.cjs --json --report-only --no-timeout 2>/dev/null > /tmp/nf-solve-output.json && node << 'NF_EVAL'
const data = JSON.parse(require('fs').readFileSync('/tmp/nf-solve-output.json', 'utf8'));
console.log('baseline_advisory:', JSON.stringify(data.baseline_advisory, null, 2));
// Verify it distinguishes file-missing from zero-baselines
if (data.baseline_advisory) {
  console.log('file_missing field present:', 'file_missing' in data.baseline_advisory);
}
NF_EVAL
```
Shows advisory object with file_missing field when baselines are missing.
3. `grep "require-baselines" commands/nf/solve.md` — flag documented
4. `grep "baseline" core/workflows/progress.md` — nudge present
5. `diff core/workflows/progress.md ~/.claude/nf/workflows/progress.md` — synced
6. `grep 'jsonObj.baseline_advisory' bin/nf-solve.cjs` — confirms field is on jsonObj, not solveState
</verification>

<success_criteria>
- Advisory stderr message printed when nf-solve detects no baseline requirements (with distinct messages for missing-file vs zero-baselines)
- JSON output (jsonObj) includes baseline_advisory field with file_missing discriminator
- --require-baselines flag causes hard exit(1) when baselines missing, in both fresh-run and --execute/--resume paths
- nf:progress shows nudge when baselines absent
- All new tests pass (including malformed JSON and file_missing cases)
- No existing tests broken
</success_criteria>

<output>
After completion, create `.planning/quick/373-add-advisory-baseline-check-to-nf-solve-/373-SUMMARY.md`
</output>

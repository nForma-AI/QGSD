---
phase: quick-253
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/run-formal-verify.cjs
  - test/run-formal-verify-guard.test.cjs
autonomous: true
requirements: [SAFE-02]
formal_artifacts: none

must_haves:
  truths:
    - "When run-formal-verify.cjs executes in a non-nForma repo, nForma-internal static steps (generate:tla-from-xstate, generate:alloy-prism-specs, petri:quorum, ci:trace-redaction, ci:trace-schema-drift, ci:conformance-traces) are skipped"
    - "When run-formal-verify.cjs executes in the nForma repo (src/machines/nf-workflow.machine.ts exists), all static steps run as before"
    - "Skipped steps are logged with a clear reason so the user understands why they were excluded"
    - "Dynamic discovery steps (TLA+, Alloy, PRISM from .planning/formal/) still run in any repo"
  artifacts:
    - path: "bin/run-formal-verify.cjs"
      provides: "nForma-repo detection guard on STATIC_STEPS"
      contains: "nformaOnly"
    - path: "test/run-formal-verify-guard.test.cjs"
      provides: "Test proving guard filters nForma-only steps in non-nForma repos"
      min_lines: 30
  key_links:
    - from: "bin/run-formal-verify.cjs"
      to: "src/machines/nf-workflow.machine.ts"
      via: "fs.existsSync marker check"
      pattern: "nf-workflow\\.machine\\.ts"
---

<objective>
Guard run-formal-verify.cjs static steps so nForma-internal steps only run inside the nForma repo.

Purpose: Prevent cross-repo contamination when /nf:solve runs in target repos — nForma-internal models (quorum-votes.als, NFQuorum.tla, Petri nets, trace checks) should not be generated into or checked against external repos. Currently these steps either fail noisily (XState machine missing) or worse, write nForma artifacts into the target repo's .planning/formal/ directory, creating false F→C gaps.

Output: Guarded run-formal-verify.cjs + regression test.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@bin/run-formal-verify.cjs
@bin/generate-formal-specs.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add nForma-repo detection and filter nForma-only static steps</name>
  <files>bin/run-formal-verify.cjs</files>
  <action>
1. Add an `nformaOnly: true` property to the following STATIC_STEPS entries:
   - `generate:tla-from-xstate` (depends on src/machines/nf-workflow.machine.ts)
   - `generate:alloy-prism-specs` (depends on XState machine — generate-formal-specs.cjs already guards internally but still writes to target repo)
   - `petri:quorum` (generates nForma-specific Petri net via generate-petri-net.cjs)
   - `ci:trace-redaction` (checks nForma trace files)
   - `ci:trace-schema-drift` (checks nForma trace schema)
   - `ci:conformance-traces` (replays against XState machine)

2. Do NOT mark these as nformaOnly (they are generic and work in any repo with .planning/formal/):
   - `ci:liveness-fairness-lint` (scans any TLA+ files)
   - `ci:triage-bundle` (reads check-results.ndjson)
   - `traceability:matrix`, `traceability:coverage-guard`, `traceability:state-space` (generic)
   - `gates:per-model-aggregate` (generic)

3. After the ROOT resolution block (around line 64) and before STATIC_STEPS, add nForma detection:
   ```js
   // ── nForma repo detection ─────────────────────────────────────────────────────
   // The XState machine file is the canonical marker for the nForma repo.
   // Steps marked nformaOnly are skipped when running in external/target repos
   // to prevent cross-repo contamination of nForma-internal formal models.
   const isNformaRepo = fs.existsSync(path.join(ROOT, 'src', 'machines', 'nf-workflow.machine.ts'));
   ```

4. After the `const STEPS = [...]` merge (around line 415), add filtering logic that removes nformaOnly steps when `!isNformaRepo`. Log each skipped step:
   ```js
   // Filter out nForma-only steps when running in external repos
   if (!isNformaRepo) {
     const before = STEPS.length;
     const filtered = STEPS.filter(s => !s.nformaOnly);
     const skipped = before - filtered.length;
     if (skipped > 0) {
       process.stdout.write(TAG + ' Non-nForma repo detected — skipping ' + skipped + ' nForma-internal step(s)\n');
       for (const s of STEPS.filter(s => s.nformaOnly)) {
         process.stdout.write(TAG + '   skip: ' + s.id + ' (' + s.label + ')\n');
       }
     }
     STEPS.length = 0;
     STEPS.push(...filtered);
   }
   ```

   IMPORTANT: Because `STEPS` is declared with `const` as an array, mutate it in-place (splice/length=0 + push) rather than reassigning. Alternatively, change the declaration approach — either convert to `let` or use a new `const activeSteps` variable and update all downstream references to use `activeSteps` instead of `STEPS`.

   The cleanest approach: use `let` for STEPS so it can be reassigned after filtering, or introduce a new variable after filtering. Choose whichever minimizes diff.

5. Make sure the `steps` variable (the --only filtered version, around line 426) is derived from the already-filtered STEPS so the guard applies regardless of --only usage.
  </action>
  <verify>
    - `grep 'nformaOnly' bin/run-formal-verify.cjs` returns matches for the 6 flagged steps
    - `grep 'isNformaRepo' bin/run-formal-verify.cjs` returns the detection line
    - `node -c bin/run-formal-verify.cjs` exits 0 (syntax valid)
    - Run `node bin/run-formal-verify.cjs --only=generate` from the QGSD repo — both generate steps should still execute (isNformaRepo=true)
  </verify>
  <done>nForma-internal static steps are tagged and filtered when ROOT is not the nForma repo. All existing behavior preserved when running inside nForma repo.</done>
</task>

<task type="auto">
  <name>Task 2: Add regression test for the nForma-repo guard</name>
  <files>test/run-formal-verify-guard.test.cjs</files>
  <action>
Create a test file using Node's built-in `node:test` and `node:assert` (matching project test conventions — see test/check-coverage-guard.test.cjs for patterns).

Test cases:

1. **"skips nformaOnly steps when XState machine is absent"**
   - Create a tmpdir with `.planning/formal/` but NO `src/machines/nf-workflow.machine.ts`
   - Create a minimal `.planning/formal/check-results.ndjson` (empty file)
   - Run `node bin/run-formal-verify.cjs --project-root=<tmpdir>` and capture stdout
   - Assert stdout contains "Non-nForma repo detected" or "skipping" message
   - Assert stdout does NOT contain step IDs for the 6 nformaOnly steps (generate:tla-from-xstate, generate:alloy-prism-specs, petri:quorum, ci:trace-redaction, ci:trace-schema-drift, ci:conformance-traces) in the SUMMARY section as executed steps
   - Use a reasonable timeout (30s) since the script spawns child processes

2. **"runs all steps when XState machine is present"**
   - This is implicitly tested by normal CI runs, but add a lightweight assertion:
   - Run `node bin/run-formal-verify.cjs --only=generate --project-root=<QGSD_ROOT>` (uses real repo)
   - Assert stdout contains "generate:tla-from-xstate" in output (step was not skipped)
   - Note: this test may fail if run outside the nForma repo, which is acceptable — it validates the positive case

Clean up tmpdir in test teardown (use `fs.rmSync` with `{ recursive: true, force: true }`).
  </action>
  <verify>
    - `node --test test/run-formal-verify-guard.test.cjs` passes
  </verify>
  <done>Test proves that nForma-only steps are skipped in non-nForma repos and run in the nForma repo.</done>
</task>

</tasks>

<verification>
1. `node -c bin/run-formal-verify.cjs` — syntax check passes
2. `node --test test/run-formal-verify-guard.test.cjs` — guard test passes
3. `node bin/run-formal-verify.cjs --only=generate` — both generate steps run in nForma repo (existing behavior preserved)
4. Manual spot-check: in a non-nForma repo, `node /path/to/QGSD/bin/run-formal-verify.cjs --project-root=.` should skip 6 nForma-internal steps
</verification>

<success_criteria>
- run-formal-verify.cjs detects non-nForma repos and skips 6 nForma-internal static steps
- All 6 generic static steps + dynamic discovery steps still run in any repo
- Full existing behavior preserved when running inside nForma repo
- Regression test confirms the guard works
</success_criteria>

<output>
After completion, create `.planning/quick/253-guard-run-formal-verify-cjs-static-steps/253-SUMMARY.md`
</output>

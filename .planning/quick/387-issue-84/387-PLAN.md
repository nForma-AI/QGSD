---
phase: quick-387
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/formal/generated-stubs/COMP-03.stub.test.js
  - .planning/formal/generated-stubs/COMP-04.stub.test.js
  - .planning/formal/generated-stubs/CONF-01.stub.test.js
  - .planning/formal/generated-stubs/CONF-02.stub.test.js
  - .planning/formal/generated-stubs/CONF-03.stub.test.js
  - .planning/formal/generated-stubs/HEAL-01.stub.test.js
  - .planning/formal/generated-stubs/HEAL-02.stub.test.js
  - .planning/formal/generated-stubs/HLTH-02.stub.test.js
  - .planning/formal/generated-stubs/HLTH-03.stub.test.js
  - .planning/formal/generated-stubs/SIG-04.stub.test.js
  - .planning/formal/generated-stubs/TRIAGE-01.stub.test.js
  - .planning/formal/generated-stubs/TRIAGE-02.stub.test.js
  - .planning/formal/generated-stubs/UNIF-01.stub.test.js
  - .planning/formal/generated-stubs/UNIF-02.stub.test.js
  - .planning/formal/generated-stubs/UNIF-03.stub.test.js
  - .planning/formal/generated-stubs/VERIFY-03.stub.test.js
autonomous: true
requirements: []
formal_artifacts:
  update:
    - .planning/formal/generated-stubs/COMP-03.stub.test.js
    - .planning/formal/generated-stubs/COMP-04.stub.test.js
    - .planning/formal/generated-stubs/CONF-01.stub.test.js
    - .planning/formal/generated-stubs/CONF-02.stub.test.js
    - .planning/formal/generated-stubs/CONF-03.stub.test.js
    - .planning/formal/generated-stubs/HEAL-01.stub.test.js
    - .planning/formal/generated-stubs/HEAL-02.stub.test.js
    - .planning/formal/generated-stubs/HLTH-02.stub.test.js
    - .planning/formal/generated-stubs/HLTH-03.stub.test.js
    - .planning/formal/generated-stubs/SIG-04.stub.test.js
    - .planning/formal/generated-stubs/TRIAGE-01.stub.test.js
    - .planning/formal/generated-stubs/TRIAGE-02.stub.test.js
    - .planning/formal/generated-stubs/UNIF-01.stub.test.js
    - .planning/formal/generated-stubs/UNIF-02.stub.test.js
    - .planning/formal/generated-stubs/UNIF-03.stub.test.js
    - .planning/formal/generated-stubs/VERIFY-03.stub.test.js

must_haves:
  truths:
    - "Baseline sync confirms requirements.json is already up-to-date (0 new added from cli profile)"
    - "The 6 newly generated formal models (NFDistTag, NFRiverPolicy, NFSolveResidual, 3 Alloy) are confirmed semantically correct with @requirement annotations present"
    - "All 16 hollow test stubs with hardcoded absolute /Users/jonathanborduas/code/QGSD paths are replaced with portable ROOT-relative paths"
    - "No stub file uses a hardcoded absolute path after the fix"
  artifacts:
    - path: ".planning/formal/generated-stubs/CONF-01.stub.test.js"
      provides: "Portable structural test for CONF-01"
      contains: "path.resolve(__dirname"
    - path: ".planning/formal/generated-stubs/COMP-03.stub.test.js"
      provides: "Portable structural test for COMP-03"
      contains: "path.resolve(__dirname"
  key_links:
    - from: ".planning/formal/generated-stubs/*.stub.test.js"
      to: "bin/*.cjs"
      via: "ROOT-relative require paths"
      pattern: "path\\.resolve\\(__dirname"
---

<objective>
Run the baseline requirements sync to confirm idempotency, verify the 6 auto-generated formal models are semantically sound, and fix 16 hollow test stubs that use hardcoded absolute paths.

Purpose: The branch `feature/issue-84-sync-baseline-requirements` exists to validate the baseline sync workflow works correctly and that solver-generated formal artifacts are usable. Hollow scaffolding with non-portable paths blocks CI portability.
Output: Confirmed-idempotent requirements.json, audited formal models, and 16 fixed portable test stubs.
</objective>

<execution_context>
@./.claude/nf/workflows/execute-plan.md
@./.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/387-issue-84/scope-contract.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Confirm baseline sync idempotency and audit 6 formal models</name>
  <files>.planning/quick/387-issue-84/387-AUDIT.md</files>
  <action>
    Run the sync script to confirm idempotency:
    ```
    node bin/sync-baseline-requirements.cjs
    ```
    Expected output: 0 new added, 13 skipped (all already present). If any new requirements are added, note them.

    Then verify each of the 6 newly generated formal models for semantic correctness by reading them and checking:
    - TLA+ models: NFDistTag.tla, NFRiverPolicy.tla, NFSolveResidual.tla
      - Has MODULE header and EXTENDS clause
      - Has TypeOK invariant
      - Has Init, Next, Spec definitions
      - Has @requirement annotations matching live requirement IDs in requirements.json (DIST-01, ROUTE-05/06/07, DEBT-14/15)
      - Is not hollow scaffolding (properties and actions have real definitions, not empty strings)
    - Alloy models: code-standards-debt-audit.als, debug-invariants-instrumentation.als, shell-prompt-quorum-dedup.als
      - Has module declaration
      - Has facts, assertions, or predicates (not just sig declarations)
      - Has @requirement annotations matching live requirement IDs (DEBT-07 through DEBT-13, DEBT-16)
      - Is not hollow (sigs have relations defined)

    Write audit findings to `.planning/quick/387-issue-84/387-AUDIT.md` with:
    - Sync result (count before/after)
    - Per-model verdict: SOUND or HOLLOW with reasoning
    - List of any models to delete (if hollow) — do not delete in this task

    Note: The invariants.md files reference QGSDAccountManager.tla, QGSDCircuitBreaker.tla etc. by name, but the actual files are prefixed NF (NFAccountManager.tla, NFCircuitBreaker.tla). These are the same specs; the QGSD prefix in invariants.md is a stale name. The new models (NFDistTag, NFRiverPolicy, NFSolveResidual, alloy models) are separate from the invariant modules and do not require invariant updates.
  </action>
  <verify>
    - `node bin/sync-baseline-requirements.cjs` exits 0 and prints "Added: 0 new requirements"
    - `.planning/quick/387-issue-84/387-AUDIT.md` exists and contains SOUND/HOLLOW verdict for each of 6 models
    - No model is marked HOLLOW with an empty `definition` field in its recipe AND no Alloy with only bare sig declarations
  </verify>
  <done>
    Audit file exists with pass/fail verdict per model, sync confirms idempotency, and any hollow models are identified for action in Task 2.
  </done>
</task>

<task type="auto">
  <name>Task 2: Fix 16 hollow test stubs with hardcoded absolute paths</name>
  <files>
    .planning/formal/generated-stubs/COMP-03.stub.test.js
    .planning/formal/generated-stubs/COMP-04.stub.test.js
    .planning/formal/generated-stubs/CONF-01.stub.test.js
    .planning/formal/generated-stubs/CONF-02.stub.test.js
    .planning/formal/generated-stubs/CONF-03.stub.test.js
    .planning/formal/generated-stubs/HEAL-01.stub.test.js
    .planning/formal/generated-stubs/HEAL-02.stub.test.js
    .planning/formal/generated-stubs/HLTH-02.stub.test.js
    .planning/formal/generated-stubs/HLTH-03.stub.test.js
    .planning/formal/generated-stubs/SIG-04.stub.test.js
    .planning/formal/generated-stubs/TRIAGE-01.stub.test.js
    .planning/formal/generated-stubs/TRIAGE-02.stub.test.js
    .planning/formal/generated-stubs/UNIF-01.stub.test.js
    .planning/formal/generated-stubs/UNIF-02.stub.test.js
    .planning/formal/generated-stubs/UNIF-03.stub.test.js
    .planning/formal/generated-stubs/VERIFY-03.stub.test.js
  </files>
  <action>
    Each of the 16 stubs uses hardcoded absolute paths like:
    `/Users/jonathanborduas/code/QGSD/bin/gate-a-grounding.cjs`

    For each file, replace all hardcoded absolute path strings with ROOT-relative equivalents.

    The fix pattern:
    1. After the existing `const path = require('path');` (or add it if missing), add:
       `const ROOT = path.resolve(__dirname, '..', '..', '..');`
       (generated-stubs/ is 3 levels deep: .planning/formal/generated-stubs/)
    2. Replace every occurrence of `'/Users/jonathanborduas/code/QGSD/bin/FILENAME'` with:
       `path.join(ROOT, 'bin', 'FILENAME')`
    3. Replace every occurrence of `'/Users/jonathanborduas/code/QGSD/hooks/FILENAME'` with:
       `path.join(ROOT, 'hooks', 'FILENAME')`
    4. Replace every occurrence of `'/Users/jonathanborduas/code/QGSD/hooks/dist/FILENAME'` with:
       `path.join(ROOT, 'hooks', 'dist', 'FILENAME')`

    Also update the `import_hint` strings if they appear inside the JS file body (as comments). Keep the test logic and assertions intact — only the path strings change.

    For stubs that only check `fs.existsSync(path)` and `content.length > 0` (purely hollow — no semantic assertion about content), also add at least one `assert.match(content, /somePattern/)` check based on what the requirement describes. Use the comment at the top of each file (which states the requirement text) to derive an appropriate pattern. For example, CONF-01 is about global config at `~/.claude/qgsd.json`, so add `assert.match(content, /nf\.json/, 'should reference nf.json config')`.

    Do not change the `@requirement` annotation comment, the test name structure, or the overall test architecture.

    Also: if the audit from Task 1 identified any formal model to delete, delete it now using `fs.unlinkSync` equivalent — but since deletion of formal models is NOT in scope (see scope-contract.json: "Executing or validating formal model correctness through model checkers" and "Implementing new features or functionality in formal models"), skip deletion and note it in the audit file instead.
  </action>
  <verify>
    Run:
    ```bash
    grep -r "/Users/jonathanborduas/code/QGSD" .planning/formal/generated-stubs/*.stub.test.js
    ```
    Must return no matches (zero hardcoded absolute paths remain).

    Also verify the ROOT constant is present:
    ```bash
    grep -l "path.resolve(__dirname" .planning/formal/generated-stubs/CONF-01.stub.test.js
    ```
    Must return the file path (constant present).
  </verify>
  <done>
    All 16 stub files use `path.resolve(__dirname, '..', '..', '..')` for ROOT and `path.join(ROOT, ...)` for all source file references. No hardcoded absolute paths remain. Each stub has at least one `assert.match()` semantic check.
  </done>
</task>

<task type="auto">
  <name>Task 3: Commit audit and stub fixes</name>
  <files>.planning/quick/387-issue-84/387-SUMMARY.md</files>
  <action>
    Write `.planning/quick/387-issue-84/387-SUMMARY.md` documenting:
    - Sync result: requirements.json confirmed idempotent (N before, 0 added, N after)
    - Formal model audit verdict for all 6 models (SOUND/HOLLOW with reason)
    - Count of stubs fixed (16) and fix pattern applied
    - Any stubs that needed semantic assertion additions beyond path fix

    Then commit using gsd-tools:
    ```bash
    node ./.claude/nf/bin/gsd-tools.cjs commit "chore(387): sync baseline requirements, audit formal models, fix hollow stubs" --files \
      .planning/formal/generated-stubs/COMP-03.stub.test.js \
      .planning/formal/generated-stubs/COMP-04.stub.test.js \
      .planning/formal/generated-stubs/CONF-01.stub.test.js \
      .planning/formal/generated-stubs/CONF-02.stub.test.js \
      .planning/formal/generated-stubs/CONF-03.stub.test.js \
      .planning/formal/generated-stubs/HEAL-01.stub.test.js \
      .planning/formal/generated-stubs/HEAL-02.stub.test.js \
      .planning/formal/generated-stubs/HLTH-02.stub.test.js \
      .planning/formal/generated-stubs/HLTH-03.stub.test.js \
      .planning/formal/generated-stubs/SIG-04.stub.test.js \
      .planning/formal/generated-stubs/TRIAGE-01.stub.test.js \
      .planning/formal/generated-stubs/TRIAGE-02.stub.test.js \
      .planning/formal/generated-stubs/UNIF-01.stub.test.js \
      .planning/formal/generated-stubs/UNIF-02.stub.test.js \
      .planning/formal/generated-stubs/UNIF-03.stub.test.js \
      .planning/formal/generated-stubs/VERIFY-03.stub.test.js \
      .planning/quick/387-issue-84/387-AUDIT.md \
      .planning/quick/387-issue-84/387-SUMMARY.md
    ```
  </action>
  <verify>
    `git log --oneline -1` shows the commit message starting with "chore(387):"
  </verify>
  <done>
    Summary file written and commit created. Task 387 is complete.
  </done>
</task>

</tasks>

<verification>
After all tasks:
1. `node bin/sync-baseline-requirements.cjs` exits 0 and shows 0 new requirements added
2. `grep -r "/Users/jonathanborduas/code/QGSD" .planning/formal/generated-stubs/*.stub.test.js` returns no output
3. All 6 audited formal models have SOUND verdict (or HOLLOW with documented reason for not deleting per scope constraint)
4. `git log --oneline -1` shows chore(387) commit
</verification>

<success_criteria>
- requirements.json idempotency confirmed by running sync-baseline-requirements.cjs (0 new added)
- All 6 solver-generated formal models audited: NFDistTag.tla, NFRiverPolicy.tla, NFSolveResidual.tla, code-standards-debt-audit.als, debug-invariants-instrumentation.als, shell-prompt-quorum-dedup.als — each verdict documented
- 16 test stubs fixed: no hardcoded absolute paths, ROOT constant uses __dirname-relative resolution, each stub has at least one semantic assert.match() check
- Commit created with all changed files
</success_criteria>

<output>
After completion, create `.planning/quick/387-issue-84/387-SUMMARY.md` (done in Task 3).
</output>

---
phase: 400-nf-harden-adversarial
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - commands/nf/harden.md
  - core/workflows/harden.md
  - core/workflows/quick.md
autonomous: true
requirements: [INTENT-01]
formal_artifacts: none

must_haves:
  truths:
    - "Running /nf:harden runs up to 10 adversarial test-write-fix iterations and terminates with a convergence or cap-exhausted banner"
    - "The loop detects convergence when 2 consecutive iterations produce zero new test failures and stops early"
    - "The --area <path> flag restricts the adversarial agent to tests in the specified subtree"
    - "The --full flag increases adversarial pressure (more edge-case categories tested)"
    - "Running /nf:quick --full triggers a simplified hardening loop (max 5 iterations) in Step 6.5 after verification passes, before the final completion banner"
    - "The hardening loop in quick --full is optional and skips gracefully if no test files are found"
    - "Both core/workflows/harden.md and ~/.claude/nf/workflows/harden.md exist with identical content"
    - "commands/nf/harden.md and ~/.claude/commands/nf/harden.md exist with identical content (skill available at runtime)"
    - "core/workflows/quick.md and ~/.claude/nf/workflows/quick.md are in sync after the integration edit"
  artifacts:
    - path: "commands/nf/harden.md"
      provides: "nf:harden skill command that delegates to core/workflows/harden.md"
      contains: "harden"
    - path: "core/workflows/harden.md"
      provides: "Adversarial hardening loop workflow with convergence detection and iteration cap"
      contains: "convergence"
    - path: "core/workflows/quick.md"
      provides: "quick workflow with nf:harden hook wired into Step 6.5 post-verification"
      contains: "harden"
  key_links:
    - from: "commands/nf/harden.md"
      to: "~/.claude/nf/workflows/harden.md"
      via: "execution_context @reference"
      pattern: "harden.md"
    - from: "core/workflows/harden.md"
      to: "~/.claude/nf/workflows/harden.md"
      via: "cp sync (git-workflow.md rule)"
      pattern: "harden"
    - from: "core/workflows/quick.md Step 6.5"
      to: "core/workflows/harden.md"
      via: "@reference or inline steps after VERIFICATION_STATUS verified"
      pattern: "harden"
---

<objective>
Create the `nf:harden` adversarial hardening skill and integrate a simplified hardening loop into `nf:quick --full`.

The skill runs an iterative adversarial test-write-fix loop: an adversarial agent generates edge-case tests designed to break the code, the executor fixes failures, and the loop continues until convergence (2 consecutive zero-change iterations) or the iteration cap (max 10 standalone, max 5 in quick --full) is reached.

Purpose: Give users and the quick workflow a first-class hardening step that catches edge cases missed by standard verification.
Output: `commands/nf/harden.md`, `core/workflows/harden.md` (synced to `~/.claude/nf/workflows/harden.md`), and updated `core/workflows/quick.md` (synced to `~/.claude/nf/workflows/quick.md`) with a hardening hook.
</objective>

<execution_context>
@./.claude/nf/workflows/execute-plan.md
@./.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/quick/400-add-nf-harden-adversarial-skill/scope-contract.json
@commands/nf/quick.md
@core/workflows/quick.md
@.planning/formal/spec/agent-loop/invariants.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create nf:harden command and workflow</name>
  <files>
    commands/nf/harden.md
    core/workflows/harden.md
  </files>
  <action>
Create two files.

**File 1: `commands/nf/harden.md`**

```markdown
---
name: nf:harden
description: Run an adversarial hardening loop — iteratively generate edge-case tests, fix failures, and converge
argument-hint: "[--area <path>] [--full]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Task
---
<objective>
Run an adversarial test-write-fix loop to harden code against edge cases. An adversarial agent generates tests designed to break the implementation; the executor fixes the failures; the loop repeats until convergence (2 consecutive zero-change iterations) or the iteration cap (10) is reached.

**`--area <path>` flag:** Restrict adversarial testing to the specified file or directory subtree.

**`--full` flag:** Increase adversarial pressure — expand the categories of edge cases the adversarial agent probes (boundary values, type coercion, concurrency, error propagation).
</objective>

<execution_context>
@~/.claude/nf/workflows/harden.md
</execution_context>

<context>
$ARGUMENTS
</context>

<process>
Execute the harden workflow from @~/.claude/nf/workflows/harden.md end-to-end.
</process>
```

**File 2: `core/workflows/harden.md`**

Write the full adversarial hardening loop workflow:

```markdown
<purpose>
Adversarial hardening loop. Iteratively generates edge-case tests, fixes failures, and converges. Terminates via convergence detection (2 consecutive zero-change iterations) or iteration cap.
</purpose>

<process>

**Step 1: Parse arguments**

Parse `$ARGUMENTS` for:
- `--area <path>` flag → store as `$AREA` (path string or null). The value is the next token after `--area`.
- `--full` flag → store as `$FULL_MODE` (true/false)
- `--max <N>` flag → store as `$MAX_ITERATIONS` (integer, default: 10). Allows callers to override the cap.

If `--area` is present without a value: error: "Error: --area requires a path (e.g., --area src/payments/)"
If `--area` value is an empty string: error: "Error: --area requires a non-empty path"
If `--max` is present: parse `$MAX_ITERATIONS` as integer; if `$MAX_ITERATIONS <= 0`: error: "Error: --max must be a positive integer (got: N)"

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 nForma ► ADVERSARIAL HARDENING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Area: ${AREA || 'full repo'}
  Depth: ${FULL_MODE ? 'full (expanded edge cases)' : 'standard'}
  Max iterations: ${MAX_ITERATIONS}
```

---

**Step 2: Discover test scope**

Determine `$SCOPE_ROOT`:
- If `$AREA` is set: use `$AREA` as the search root
- Else: use repo root (`.`)

Find test files under `$SCOPE_ROOT`:
```bash
find "$SCOPE_ROOT" \( -name "*.test.js" -o -name "*.test.cjs" -o -name "*.test.ts" \
  -o -name "*.spec.js" -o -name "*.spec.ts" \) \
  -not -path "*/node_modules/*" -not -path "*/.git/*"
```
Store as `$TEST_FILES`.

If `$TEST_FILES` is empty:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 nForma ► HARDENING SKIPPED — no test files found
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Searched: ${SCOPE_ROOT}
Add test files and re-run /nf:harden to enable adversarial hardening.
```
STOP — return status: `skipped`.

Read `package.json` scripts.test to determine `$RUN_CMD`:
- Contains `vitest` → `npx vitest run`
- Contains `jest` → `npx jest --passWithNoTests`
- Contains `node --test` or default → `node --test`
- If `scripts.test` is missing or undefined: check for `vitest.config.js` or `jest.config.js` in repo root; if found, use the corresponding runner (`npx vitest run` or `npx jest --passWithNoTests`); if neither config file exists, emit warning `◆ WARNING: No test script found — using npm test as fallback` and set `$RUN_CMD = 'npm test'`

---

**Step 3: Run baseline test suite**

```bash
$RUN_CMD 2>&1
echo "EXIT:$?"
```

Store output as `$BASELINE_OUTPUT`. Extract exit code.

If exit code is non-zero:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 nForma ► HARDENING BLOCKED — baseline tests failing
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Fix baseline failures before hardening.
```
STOP — return status: `blocked`.

Display: `◆ Baseline: ${N} test file(s) passing. Starting adversarial loop...`

---

**Step 4: Adversarial hardening loop**

Initialize:
- `$ITERATION = 0`
- `$CONSECUTIVE_ZERO_CHANGE = 0`
- `$NEW_FAILURES_LAST = -1`
- `$TOTAL_TESTS_ADDED = 0`
- `$STATUS = "running"`

**LOOP** (while `$ITERATION < $MAX_ITERATIONS` AND `$CONSECUTIVE_ZERO_CHANGE < 2`):

Increment: `$ITERATION += 1`

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 nForma ► ITERATION ${ITERATION}/${MAX_ITERATIONS}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Step 4a: Spawn adversarial agent**

Determine edge-case categories for this iteration:
- Standard categories: boundary values, null/undefined inputs, empty collections, off-by-one errors, type coercion
- If `$FULL_MODE`: also include: concurrent invocation, error propagation chains, partial failures, invalid argument types, oversized inputs

Spawn adversarial agent:

```
Task(
  subagent_type="general-purpose",
  model="{executor_model}",
  description="Adversarial test generation (iteration ${ITERATION})",
  prompt="
You are an adversarial test writer. Your goal is to BREAK the implementation by writing tests that expose edge cases and unexpected behaviors.

## Scope
Test files: ${TEST_FILES}
Source files: (infer from test imports in the test files listed above)
Edge-case categories to probe: ${categories}

## Instructions
1. Read the test files to understand what is already tested
2. Read the corresponding source files to understand the implementation
3. Write NEW test cases targeting untested edge cases from the categories above
4. Add tests to the EXISTING test files (do not create new test files)
5. Each new test should be designed to FAIL if the implementation has a gap
6. Focus on the most likely gaps — do not add trivial tests that will trivially pass
7. Add between 2 and 5 new tests total (no more — quality over quantity)

## Constraints
- DO NOT modify source implementation files — only test files
- DO NOT modify or delete existing tests
- Use the same test framework already in use (detect from existing test syntax)
- Each test must have a descriptive name that explains what edge case it targets
- If the implementation already handles all obvious edge cases, add 1 test confirming an important invariant

Return a summary of what tests you added and why each one might expose a gap.
"
)
```

After adversarial agent returns, run tests:
```bash
$RUN_CMD 2>&1
echo "EXIT:$?"
```
Store as `$TEST_OUTPUT_AFTER_ADVERSARIAL`. Extract `$NEW_FAILURES_COUNT` from output (count of failing tests).

**Step 4b: Fix loop (only if new failures found)**

If `$NEW_FAILURES_COUNT > 0`:

  Display: `  ◆ ${NEW_FAILURES_COUNT} new failure(s) detected. Spawning fix executor...`

  Spawn fix executor:

  ```
  Task(
    subagent_type="nf-executor",
    model="{executor_model}",
    description="Fix adversarial failures (iteration ${ITERATION})",
    prompt="
  Fix the test failures introduced by adversarial tests in the current iteration.

  Test output showing failures:
  ${TEST_OUTPUT_AFTER_ADVERSARIAL}

  ## Instructions
  1. Read the failing test cases to understand what they expect
  2. Fix the source implementation (NOT the tests) to make the failing tests pass
  3. Do NOT remove or modify adversarial tests
  4. Run the tests after fixing to confirm they pass
  5. Commit fixes atomically using: node ~/.claude/nf/bin/nf-tools.cjs commit 'fix: harden iteration ${ITERATION} — fix adversarial gaps' --files <changed source files>

  Return the fix commit hash (format: 'Fix Commit: {hash}') and list of files changed.
  "
  )
  ```

  After fix executor returns, run tests again:
  ```bash
  $RUN_CMD 2>&1
  echo "EXIT:$?"
  ```
  Store as `$TEST_OUTPUT_AFTER_FIX`. Extract `$REMAINING_FAILURES`.

  If `$REMAINING_FAILURES > 0`:
    Display: `  ◆ WARNING: ${REMAINING_FAILURES} failure(s) remain after fix attempt. Proceeding to next iteration.`
    Set `$NEW_FAILURES_LAST = $REMAINING_FAILURES`
  Else:
    Display: `  ◆ All failures resolved.`
    Set `$NEW_FAILURES_LAST = 0`

  `$TOTAL_TESTS_ADDED += adversarial agent test count`

Else (`$NEW_FAILURES_COUNT == 0`):
  Display: `  ◆ No new failures introduced.`
  <!-- Convergence semantics: CONSECUTIVE_ZERO_CHANGE increments ONLY here, when the adversarial agent
       produced zero new failures (NEW_FAILURES_COUNT == 0 from Step 4a, BEFORE the fix executor runs).
       It is reset to 0 whenever the adversarial agent DID introduce failures (NEW_FAILURES_COUNT > 0). -->
  `$CONSECUTIVE_ZERO_CHANGE += 1`
  `$NEW_FAILURES_LAST = 0`

After each iteration: if `$NEW_FAILURES_COUNT > 0` (adversarial agent introduced failures): reset `$CONSECUTIVE_ZERO_CHANGE = 0`.

**Termination check:**
<!-- EventuallyTerminates: guaranteed by $ITERATION cap — the loop always reaches cap_exhausted if convergence is not reached first. -->
- `$CONSECUTIVE_ZERO_CHANGE >= 2` → set `$STATUS = "converged"`. Break loop.
- `$ITERATION >= $MAX_ITERATIONS` → set `$STATUS = "cap_exhausted"`. Break loop.

**END LOOP**

---

**Step 5: Display result banner**

If `$STATUS == "converged"`:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 nForma ► HARDENING CONVERGED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Iterations: ${ITERATION}
  Tests added: ${TOTAL_TESTS_ADDED}
  Status: Converged (2 consecutive zero-change iterations)
```

If `$STATUS == "cap_exhausted"`:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 nForma ► HARDENING CAP REACHED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Iterations: ${ITERATION} (max ${MAX_ITERATIONS})
  Tests added: ${TOTAL_TESTS_ADDED}
  Remaining failures: ${NEW_FAILURES_LAST}
  Status: Cap exhausted — run /nf:harden again to continue
```

Return `$STATUS` to caller (used by quick --full integration).

</process>
```

After writing both files, sync both to their installed locations (per git-workflow.md rule and bin/install.js command deployment):
```bash
cp core/workflows/harden.md ~/.claude/nf/workflows/harden.md
cp commands/nf/harden.md ~/.claude/commands/nf/harden.md
```
  </action>
  <verify>
test -f commands/nf/harden.md && grep "harden.md" commands/nf/harden.md && test -f core/workflows/harden.md && grep "convergence\|CONSECUTIVE_ZERO_CHANGE" core/workflows/harden.md && test -f ~/.claude/nf/workflows/harden.md && diff core/workflows/harden.md ~/.claude/nf/workflows/harden.md && test -f ~/.claude/commands/nf/harden.md && diff commands/nf/harden.md ~/.claude/commands/nf/harden.md
  </verify>
  <done>
`commands/nf/harden.md` exists with correct frontmatter and execution_context pointing to `~/.claude/nf/workflows/harden.md`. `core/workflows/harden.md` exists with the full adversarial loop including: argument parsing (--area, --full, --max) with validation (--max <= 0 errors, --area empty string errors), test discovery with empty-check and scripts.test fallback, baseline test run with blocking on failure, iterative loop with adversarial agent + fix executor, convergence detection (CONSECUTIVE_ZERO_CHANGE increments only when NEW_FAILURES_COUNT == 0, reset when > 0), iteration cap (default 10) guaranteeing termination, and a terminal result banner covering all three final states (converged, cap_exhausted, skipped/blocked). `~/.claude/nf/workflows/harden.md` is an exact copy of `core/workflows/harden.md` (diff returns empty). `~/.claude/commands/nf/harden.md` is an exact copy of `commands/nf/harden.md` (diff returns empty).
  </done>
</task>

<task type="auto">
  <name>Task 2: Wire nf:harden into quick --full post-verification and sync quick.md</name>
  <files>
    core/workflows/quick.md
  </files>
  <action>
Read `core/workflows/quick.md` in full.

Locate **Step 6.7: Requirement elevation** — this is the step that follows Step 6.5.1 (quorum review of VERIFICATION.md) when `$VERIFICATION_STATUS = "Verified"`.

Insert a new **Step 6.6: Adversarial hardening (only when `$FULL_MODE` AND `$VERIFICATION_STATUS = "Verified"`)** between Step 6.5.1 and Step 6.7. Insert it immediately before the `**Step 6.7: Requirement elevation` heading.

The new section text is:

```
---

**Step 6.6: Adversarial hardening (only when `$FULL_MODE` AND `$VERIFICATION_STATUS = "Verified"`)**

<!-- MUST_NOT_SKIP: This step runs after verification passes and before requirement elevation. Skip only if NOT $FULL_MODE or VERIFICATION_STATUS is not "Verified". -->

Skip this step if NOT `$FULL_MODE` OR `$VERIFICATION_STATUS` is not `"Verified"`.

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 nForma ► ADVERSARIAL HARDENING (quick --full)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning hardening loop (max 5 iterations)...
```

Spawn the harden workflow inline as a Task subagent:

```
Task(
  subagent_type="general-purpose",
  model="{executor_model}",
  description="Adversarial hardening: ${DESCRIPTION}",
  prompt="
Run the adversarial hardening loop for the quick task that just completed.

Read @~/.claude/nf/workflows/harden.md for the full workflow instructions.

## Arguments
--max 5

## Context
This is called from nf:quick --full post-verification. The implementation was just verified as passing. The goal is to harden it against edge cases.

## Constraints
- Max 5 iterations (--max 5)
- Use the repo root as scope (no --area flag)
- Fail-open: if no test files found, return status: skipped and stop gracefully
- Do NOT re-run the verifier after hardening — this step is hardening only
- Return the final harden status (converged | cap_exhausted | skipped | blocked) in your response (format: 'Harden Status: {status}')
"
)
```

Parse the subagent response for `Harden Status: {status}`.

**Fail-open:** If the subagent errors, times out, or returns no status, log:
```
◆ WARNING: Adversarial hardening subagent did not complete cleanly. Proceeding (fail-open).
```
Set `$HARDEN_STATUS = "skipped"`. Continue to Step 6.7.

Display result line based on status:
- `converged` → `◆ Hardening: CONVERGED`
- `cap_exhausted` → `◆ Hardening: CAP REACHED (5 iterations) — some edge cases may remain`
- `skipped` → `◆ Hardening: SKIPPED (no test files found)`
- `blocked` → `◆ Hardening: SKIPPED (baseline failures detected — fix first)`

Store `$HARDEN_STATUS` for inclusion in the final completion banner.

Update the final completion banner (the `nForma > QUICK TASK COMPLETE (FULL MODE)` block) to include a Hardening line:
```
Hardening: ${HARDEN_STATUS || 'not run'}
```
Add it after the `Verification:` line in the banner.

Also update the success_criteria checklist at the bottom of the workflow to add:
- `- [ ] (--full) Step 6.6 adversarial hardening runs when VERIFICATION_STATUS is "Verified"`
- `- [ ] (--full) Harden status included in final completion banner`
```

After editing `core/workflows/quick.md`, sync to installed location (per git-workflow.md rule):
```bash
cp core/workflows/quick.md ~/.claude/nf/workflows/quick.md
```
  </action>
  <verify>
grep -n "Step 6.6" core/workflows/quick.md && grep -n "harden" core/workflows/quick.md | head -10 && diff core/workflows/quick.md ~/.claude/nf/workflows/quick.md | wc -l | grep "^0$"
  </verify>
  <done>
`core/workflows/quick.md` contains a new "Step 6.6: Adversarial hardening" section that: (1) only runs when `$FULL_MODE` AND `$VERIFICATION_STATUS = "Verified"`, (2) spawns the harden workflow with `--max 5`, (3) handles all terminal states (converged, cap_exhausted, skipped, blocked) with a fail-open for errors, (4) includes `$HARDEN_STATUS` in the final completion banner. `~/.claude/nf/workflows/quick.md` is an exact sync of `core/workflows/quick.md` (diff line count is 0).
  </done>
</task>

</tasks>

<verification>
1. `test -f commands/nf/harden.md` — command skill file exists
2. `grep "execution_context" commands/nf/harden.md | grep "harden.md"` — skill points to workflow
3. `test -f core/workflows/harden.md && grep "cap_exhausted\|converged\|skipped" core/workflows/harden.md` — all terminal states declared in workflow
4. `grep "CONSECUTIVE_ZERO_CHANGE" core/workflows/harden.md | wc -l` — convergence detection variable present
5. `diff core/workflows/harden.md ~/.claude/nf/workflows/harden.md` — harden workflow files are identical
5b. `diff commands/nf/harden.md ~/.claude/commands/nf/harden.md` — harden command files are identical (skill available at runtime)
6. `grep "Step 6.6" core/workflows/quick.md` — hardening hook wired into quick workflow
7. `grep "HARDEN_STATUS" core/workflows/quick.md | wc -l` — status variable tracked in quick workflow
8. `diff core/workflows/quick.md ~/.claude/nf/workflows/quick.md | wc -l` — output is 0 (files in sync)
</verification>

<success_criteria>
- `commands/nf/harden.md` exists with frontmatter (name: nf:harden, argument-hint, allowed-tools) and execution_context pointing to `~/.claude/nf/workflows/harden.md`
- `~/.claude/commands/nf/harden.md` is an exact copy of `commands/nf/harden.md` (deployed via cp, matching bin/install.js behavior for commands/nf/)
- `core/workflows/harden.md` implements the full adversarial loop: argument parsing (--area, --full, --max) with validation (--max <= 0 errors, --area empty string errors), test discovery with empty/baseline guards and scripts.test fallback logic, iterative adversarial agent + fix executor, convergence detection (CONSECUTIVE_ZERO_CHANGE increments ONLY when adversarial agent produces zero new failures before the fix executor runs; reset when NEW_FAILURES_COUNT > 0), iteration cap (default 10), and banners for all terminal states
- The EventuallyTerminates invariant is satisfied: the loop always reaches `converged`, `cap_exhausted`, `skipped`, or `blocked` — no infinite loop is possible (guaranteed by $ITERATION cap)
- `~/.claude/nf/workflows/harden.md` is an exact copy of `core/workflows/harden.md`
- `core/workflows/quick.md` contains Step 6.6 that runs the harden subagent (--max 5) after verification passes in --full mode, with fail-open for all error paths
- `~/.claude/nf/workflows/quick.md` is in sync with `core/workflows/quick.md`
- `$HARDEN_STATUS` appears in the quick --full completion banner
</success_criteria>

<output>
After completion, create `.planning/quick/400-add-nf-harden-adversarial-skill/400-SUMMARY.md`
</output>

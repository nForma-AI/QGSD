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

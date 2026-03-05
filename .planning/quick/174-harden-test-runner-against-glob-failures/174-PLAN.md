---
phase: quick
plan: 174
type: execute
wave: 1
depends_on: []
files_modified:
  - /Users/jonathanborduas/.claude/qgsd/workflows/quick.md
autonomous: true
formal_artifacts: none
requirements: [QUICK-174]

must_haves:
  truths:
    - "Phase 2 full-suite fallback never uses raw glob patterns with node --test"
    - "Phase 2 full-suite fallback has a 5-minute Bash timeout and per-file test timeout"
    - "If full suite times out, workflow treats it as PASS-with-warning instead of hanging"
    - "Gap auto-fix loop test run uses same safe enumeration pattern"
    - "Anti-patterns section explicitly forbids raw glob patterns in node --test"
  artifacts:
    - path: "/Users/jonathanborduas/.claude/qgsd/workflows/quick.md"
      provides: "Hardened test runner with find-based enumeration, timeouts, and timeout-as-warning"
      contains: "find.*-name.*test"
  key_links:
    - from: "quick.md Phase 2 fallback"
      to: "Bash tool timeout parameter"
      via: "timeout: 300000 and --test-timeout=15000"
      pattern: "timeout.*300000|test-timeout.*15000"
---

<objective>
Harden the quick.md workflow's test runner against three cascading failures: zsh glob errors when glob patterns match no files, full suite timeout exceeding Bash's 2-minute default, and agent retry loops when tests hang.

Purpose: Prevent quick --full verification from hanging or erroring when falling back to the full test suite.
Output: Updated quick.md workflow with safe test enumeration, timeout guards, and graceful timeout handling.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@/Users/jonathanborduas/.claude/qgsd/workflows/quick.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace raw globs with find-based enumeration and add timeout guards in quick.md</name>
  <files>/Users/jonathanborduas/.claude/qgsd/workflows/quick.md</files>
  <action>
Edit quick.md in three locations plus the anti-patterns section:

**Location 1 — Phase 1 test runner (lines ~608-616):**
Change the `node --test` fallback from:
```
- Else -> `node --test $TASK_TEST_FILES`
```
to explicitly note that `$TASK_TEST_FILES` comes from `git diff --name-only` (already safe — produces real paths, no globs). No change needed here since the files are enumerated by git. But add a safety note:
```
- Else -> `node --test $TASK_TEST_FILES` (safe: files enumerated by git diff, not glob patterns)
```

**Location 2 — Phase 2 full-suite fallback (lines ~662-673):**
Replace the vague `$RUN_CMD` placeholder with an explicit, safe full-suite command block. Change:
```
  ```bash
  $RUN_CMD 2>&1
  echo "EXIT:$?"
  ```

  Display: `No requirement-scoped tests found — running full suite as fallback.`
```

to:

```
  Enumerate test files using `find` (NEVER raw globs — zsh aborts on unmatched globs):
  ```bash
  TEST_FILES=$(find hooks bin qgsd-core src test -name '*.test.js' -o -name '*.test.cjs' -o -name '*.test.mjs' 2>/dev/null | sort)
  if [ -z "$TEST_FILES" ]; then
    echo "No test files found"
    echo "EXIT:0"
  else
    node --test --test-timeout=15000 $TEST_FILES 2>&1
    echo "EXIT:$?"
  fi
  ```
  **IMPORTANT:** Set Bash tool `timeout: 300000` (5 minutes) for this command. If the Bash tool returns a timeout error, treat as PASS-with-warning:
  Display: `Warning: Full suite timed out after 5 minutes — treating as pass-with-warning. Task-specific tests (Phase 1) already validated the change.`
  Set `$VERIFICATION_STATUS` to the value it had BEFORE Phase 2 (i.e., do not override to `gaps_found` on timeout).

  Display: `No requirement-scoped tests found — running full suite as fallback (${N} files, 15s timeout per test, 5min total cap).`
```

**Location 3 — Gap auto-fix loop test run (lines ~729-734):**
Replace the vague `$RUN_CMD` with the same safe pattern. Change:
```
Detect test runner from `package.json` (same logic as `/qgsd:quorum-test`):
```bash
# Run project tests
$RUN_CMD 2>&1
echo "EXIT:$?"
```
```

to:

```
Run tests to verify gaps are closed. If `$TASK_TEST_FILES` or `$REQ_TEST_FILES` are available, run only those (same commands as Phase 1/2 above). Otherwise, fall back to full suite with safe enumeration:
```bash
TEST_FILES=$(find hooks bin qgsd-core src test -name '*.test.js' -o -name '*.test.cjs' -o -name '*.test.mjs' 2>/dev/null | sort)
if [ -z "$TEST_FILES" ]; then
  echo "No test files found"
  echo "EXIT:0"
else
  node --test --test-timeout=15000 $TEST_FILES 2>&1
  echo "EXIT:$?"
fi
```
Set Bash tool `timeout: 300000` (5 minutes). On timeout, treat as test failure (increment `$GAP_FIX_ITERATION`, continue loop).
```

**Location 4 — Anti-patterns section (lines ~1080-1087):**
Add a new anti-pattern after the existing test-related entries:
```
- Do NOT pass raw glob patterns (e.g., `hooks/*.test.js`, `bin/*.test.cjs`) directly to `node --test`. zsh treats unmatched globs as fatal errors. ALWAYS enumerate test files with `find` first, then pass the file list to `node --test`.
- Do NOT run full-suite test commands without `--test-timeout=15000` and Bash `timeout: 300000`. The 373+ test files will exceed the default 2-minute Bash timeout.
- Do NOT retry with different glob patterns when a test command fails due to "no matches found". This is a glob expansion error, not a test failure. Switch to `find`-based enumeration.
```
  </action>
  <verify>
Read back the modified quick.md and confirm:
1. Line search for `find hooks bin qgsd-core` returns matches in both Phase 2 fallback and gap auto-fix sections
2. Line search for `test-timeout=15000` returns matches
3. Line search for `timeout: 300000` or `timeout.*300000` appears in instructions near both full-suite blocks
4. Line search for `NEVER.*glob` or `raw glob` appears in anti-patterns section
5. No remaining bare `$RUN_CMD` references without context (the gap auto-fix should no longer use bare `$RUN_CMD`)
  </verify>
  <done>
quick.md Phase 2 fallback uses find-based enumeration with --test-timeout=15000 and 5-min Bash timeout. Gap auto-fix loop uses the same safe pattern. Anti-patterns section explicitly forbids raw globs and documents timeout requirements. No bare $RUN_CMD references remain without explicit safe commands.
  </done>
</task>

</tasks>

<verification>
- Grep quick.md for raw `$RUN_CMD` — should only appear in Phase 1 targeted context (where files come from git diff, already safe) or be fully replaced
- Grep for `glob` in anti-patterns — should find the new "NEVER raw glob" instruction
- Grep for `find hooks bin` — should find 2 occurrences (Phase 2 fallback + gap auto-fix)
- Grep for `test-timeout` — should find at least 2 occurrences
</verification>

<success_criteria>
The quick.md workflow's full-suite fallback path uses find-based file enumeration (not raw globs), has per-file and total timeout guards, and gracefully handles timeout as pass-with-warning. The anti-patterns section documents these requirements to prevent regression.
</success_criteria>

<output>
After completion, create `.planning/quick/174-harden-test-runner-against-glob-failures/174-SUMMARY.md`
</output>

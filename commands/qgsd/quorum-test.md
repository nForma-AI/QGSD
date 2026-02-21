---
name: qgsd:quorum-test
description: Run the test suite and submit the full execution bundle to quorum workers for independent quality review. Parallel workers evaluate whether tests genuinely pass and whether assertions are meaningful.
argument-hint: "[path/to/test.file.js]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Task
  - Glob
---

<objective>
Run the project test suite, assemble a full execution bundle, and dispatch parallel quorum workers to independently evaluate whether the tests genuinely pass and whether they are real tests.

This command extends QGSD quorum from *planning* (consensus on direction) to *verification* (consensus on test quality).
</objective>

<process>

**Step 1: Parse and validate target**

**1a. Parse `$ARGUMENTS`:**
- If non-empty and points to a **directory**: discover test files within that directory recursively
  ```bash
  find "$ARGUMENTS" \( -name "*.test.js" -o -name "*.test.cjs" \) \
    -not -path "*/node_modules/*" -not -path "*/.git/*"
  ```
- If non-empty and points to a **file**: use it directly as `$TEST_FILES`
- If empty: discover all test files from repo root:
  ```bash
  find . \( -name "*.test.js" -o -name "*.test.cjs" \) \
    -not -path "*/node_modules/*" -not -path "*/.git/*"
  ```

Store the list as `$TEST_FILES`.

**1b. Empty check:**

If `$TEST_FILES` is empty, stop: "No test files found."

**1c. File existence check:**

For each file in `$TEST_FILES`, verify it exists on disk:
```bash
ls $TEST_FILES 2>&1
```

If any file is missing, display:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► QUORUM-TEST: BLOCK (missing test files)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Missing: <list of missing files>
Fix: Run `find . -name "*.test.*" | grep -v node_modules` to re-discover valid test files.
```

STOP — do not proceed to test execution.

**1d. npm test script validation (mandatory when package.json exists):**

Check if `package.json` exists:
```bash
ls package.json 2>/dev/null
```

If it exists, read the `"test"` script value. Extract each file path argument (words ending in `.js` or `.cjs`). For each extracted path, check if it exists on disk.

If any path is missing, display:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► QUORUM-TEST: BLOCK (npm test script broken)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

package.json "test" script references missing file(s): <list>
Fix: Update package.json test script to:
  "test": "node --test <discovered test files from step 1>"
```

STOP — do not proceed.

**1e. Validation summary:**

Display:
```
✓ N test file(s) validated.
✓ npm test script OK. (or: ⚠ package.json not found — skipping script check)
Proceeding to test execution...
```

**Step 2: Capture execution bundle**

```bash
node --version
```
Store as `$NODE_VERSION`.

```bash
node --test $TEST_FILES 2>&1
echo "EXIT:$?"
```
Store full output as `$TEST_OUTPUT`. Extract exit code from the `EXIT:N` line at the end.

Read the full source of every file in `$TEST_FILES`. Store as `$TEST_SOURCES` — a combined block with filename headers:

```
=== hooks/qgsd-stop.test.js ===
<full source>

=== hooks/config-loader.test.js ===
<full source>
```

When reading each test source file:
- If the file content is empty: include `[WARN] empty source: <filename>` in place of content
- If the Read tool returns an error: include `[ERROR] read failed: <filename> — <reason>` in place of content

This lets quorum workers see exactly what happened per file rather than silently receiving an incomplete bundle.

**Step 3: Immediate BLOCK if exit code ≠ 0**

If exit code is non-zero, stop immediately and display:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► QUORUM-TEST: BLOCK (test infrastructure failure)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Tests did not run cleanly (exit code: N).
Fix the infrastructure failure before requesting quorum review.

<relevant excerpt from $TEST_OUTPUT>
```

Do NOT invoke quorum workers. Stop here.

**Step 4: Assemble bundle**

Compose `$BUNDLE`:

```
NODE VERSION: $NODE_VERSION
TEST FILES: $TEST_FILES
EXIT CODE: 0

=== TEST OUTPUT ===
$TEST_OUTPUT

=== TEST SOURCES ===
$TEST_SOURCES
```

**Step 5: Dispatch parallel quorum workers**

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► QUORUM-TEST: Dispatching workers...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Dispatch all four workers as parallel Task calls (Task subagents are isolated subprocesses — a failing Task does not propagate to sibling Tasks, so this is safe under CLAUDE.md R3.2 which restricts direct sibling MCP calls):

Worker prompt template for each:
```
You are a skeptical test reviewer for the QGSD project.

<bundle>
$BUNDLE
</bundle>

Evaluate this test execution bundle.
Return ONLY:

verdict: PASS | BLOCK | REVIEW-NEEDED
concerns:
  - <most-impactful concern first, or "none" if no concerns>
  - <second concern if applicable, or "none" if only one concern>

Your job is NOT to confirm the pass. Read the assertion code and ask: if someone changed the implementation in a meaningful way, would this test catch it? Look for swallowed exceptions, trivially true assertions, mocked internals that bypass real logic.

If the bundle contains no test source code, return:
verdict: REVIEW-NEEDED
concerns:
  - Bundle missing test sources — cannot verify assertion quality
```

Dispatch (each call in a single parallel message — Task subagents are isolated subprocesses; a failing Task does not propagate to co-submitted Tasks, unlike direct sibling MCP calls):
- `Task(subagent_type="general-purpose", prompt="Call mcp__gemini-cli__gemini with the following prompt. Pass the full literal text of the bundle inline — do not summarize or truncate: [full worker prompt with $BUNDLE inlined verbatim]")`
- `Task(subagent_type="general-purpose", prompt="Call mcp__opencode__opencode with the following prompt. Pass the full literal text of the bundle inline — do not summarize or truncate: [full worker prompt with $BUNDLE inlined verbatim]")`
- `Task(subagent_type="general-purpose", prompt="Call mcp__copilot-cli__ask with the following prompt. Pass the full literal text of the bundle inline — do not summarize or truncate: [full worker prompt with $BUNDLE inlined verbatim]")`
- `Task(subagent_type="general-purpose", prompt="Call mcp__codex-cli__review with the following prompt. Pass the full literal text of the bundle inline — do not summarize or truncate: [full worker prompt with $BUNDLE inlined verbatim]")`

Note: `agents/qgsd-quorum-test-worker.md` defines this same role and output format and can be invoked directly with a bundle as `$ARGUMENTS`. The parallel Task dispatch above is used when targeting specific external models (Gemini, OpenCode, Copilot, Codex) rather than a single agent.

**Step 6: Collect verdicts and render table**

Parse each worker response for `verdict:` and `concerns:` lines.
When parsing concerns: if a bullet reads `none`, treat it as absent and display `—` in the table.

If a worker errored or returned unparseable output, mark as `UNAVAIL`.

Determine consensus:
- All available models PASS → consensus `PASS`
- Any available model BLOCK → consensus `BLOCK`
- All available models REVIEW-NEEDED (no PASS, no BLOCK) → consensus `REVIEW-NEEDED`
- Mixed PASS/REVIEW → consensus `REVIEW-NEEDED`
- All UNAVAIL → stop: "All quorum models unavailable — cannot evaluate."

Display:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► QUORUM-TEST RESULTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌──────────────┬──────────────────┬─────────────────────────────────────┐
│ Model        │ Verdict          │ Concerns                            │
├──────────────┼──────────────────┼─────────────────────────────────────┤
│ Gemini       │ [verdict]        │ [first concern or —]                │
│ OpenCode     │ [verdict]        │ [first concern or —]                │
│ Copilot      │ [verdict]        │ [first concern or —]                │
│ Codex        │ [verdict]        │ [first concern or —]                │
├──────────────┼──────────────────┼─────────────────────────────────────┤
│ CONSENSUS    │ [consensus]      │ [N PASS, N BLOCK, N UNAVAIL]        │
└──────────────┴──────────────────┴─────────────────────────────────────┘
```

If any model has multiple concerns, list them below the table.

**Step 7: Save artifact**

Write `.planning/quick/quorum-test-latest.md`:

```markdown
# quorum-test artifact
date: [ISO timestamp]
files: $TEST_FILES
exit_code: 0

## verdict
[consensus verdict]

## worker verdicts
[table as text]

## execution bundle
[full $BUNDLE]
```

</process>

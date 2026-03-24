---
phase: quick-341
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - agents/nf-quorum-slot-worker.md
  - bin/quorum-slot-dispatch.cjs
  - bin/quorum-slot-dispatch.test.cjs
  - commands/nf/quorum.md
  - core/references/quorum-dispatch.md
autonomous: true
requirements: [INTENT-01]
formal_artifacts: none

must_haves:
  truths:
    - "Haiku slot-worker cannot fabricate a vote when bash dispatch fails"
    - "Questions with shell metacharacters (parentheses, em dashes, quotes) dispatch successfully without retry storms"
    - "Orchestrator can distinguish genuine dispatch results from Haiku-fabricated ones via dispatch_nonce field"
  artifacts:
    - path: "agents/nf-quorum-slot-worker.md"
      provides: "Anti-self-answer behavioral constraint + question-file pattern + nonce-file pattern"
      contains: "MUST NOT answer the question yourself"
    - path: "bin/quorum-slot-dispatch.cjs"
      provides: "Question-file flag + nonce generation + nonce-file write"
      exports: ["emitResultBlock"]
    - path: "commands/nf/quorum.md"
      provides: "Nonce verification guidance for orchestrator"
      contains: "dispatch_nonce"
    - path: "bin/quorum-slot-dispatch.test.cjs"
      provides: "Tests for question-file reading and nonce emission"
  key_links:
    - from: "agents/nf-quorum-slot-worker.md"
      to: "bin/quorum-slot-dispatch.cjs"
      via: "--question-file flag instead of --question for question text"
      pattern: "question-file"
    - from: "bin/quorum-slot-dispatch.cjs"
      to: "emitResultBlock output"
      via: "dispatch_nonce field in every result block"
      pattern: "dispatch_nonce"
    - from: "commands/nf/quorum.md"
      to: "slot-worker result parsing"
      via: "nonce presence check on result blocks"
      pattern: "dispatch_nonce"
---

<objective>
Implement three-layer anti-self-answer guard for quorum slot workers to prevent Haiku from fabricating votes when bash dispatch fails, eliminate shell escaping failures on question text, and add structural nonce verification for result authenticity.

Purpose: The quorum slot-worker (Haiku) has zero protection against self-answering when dispatch fails. Shell metacharacters in questions cause retry storms. The orchestrator cannot distinguish genuine from fabricated results.
Output: Hardened agent definition, question-via-file dispatch, nonce-verified result blocks.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@agents/nf-quorum-slot-worker.md
@bin/quorum-slot-dispatch.cjs
@bin/quorum-slot-dispatch.test.cjs
@commands/nf/quorum.md
@core/references/quorum-dispatch.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Layer 1 behavioral constraint + Layer 2 question-file in agent and dispatch script</name>
  <files>
    agents/nf-quorum-slot-worker.md
    bin/quorum-slot-dispatch.cjs
  </files>
  <action>
**agents/nf-quorum-slot-worker.md — Add behavioral constraints and question-file pattern:**

1. After the line "Do NOT modify, summarize, or reformat the script output. It IS the structured result block." add a new section:

```
## CRITICAL CONSTRAINTS
- You MUST NOT answer the question yourself. Your ONLY job is to run the bash command and emit its output.
- If the Bash command fails (non-zero exit, timeout, permission error), emit ONLY: `verdict: UNAVAIL` and STOP. Do NOT retry the Bash command. Do NOT attempt to answer the question. Do NOT fabricate a result block.
- Do NOT retry the Bash command under any circumstances. One attempt only.
```

2. In the bash script block, replace the `--question "$QUESTION"` pattern with a temp-file pattern. After the `TRACES_FILE=$(mktemp)` line, add:
```bash
QUESTION_FILE=$(mktemp)
echo "$ARGUMENTS" | grep '^question:' | sed 's/question: *//' > "$QUESTION_FILE"
```

3. Replace `--question "$QUESTION"` in the node command with `--question-file "$QUESTION_FILE"`.

4. Remove the line `QUESTION=$(echo "$ARGUMENTS"|grep '^question:'|sed 's/question: *//')` since it is no longer needed for CLI argument passing.

5. Add `QUESTION_FILE` to the `rm -f` cleanup line: `rm -f "$PRIOR_FILE" "$TRACES_FILE" "$QUESTION_FILE"`

6. Add a NONCE_FILE temp file creation and pass `--nonce-file "$NONCE_FILE"` to the dispatch command. After the dispatch call, cat the nonce file and emit it:
```bash
NONCE_FILE=$(mktemp)
```
Add `--nonce-file "$NONCE_FILE"` to the node command flags.
After the node command and before `rm -f`, add:
```bash
if [ -s "$NONCE_FILE" ]; then echo "dispatch_nonce: $(cat "$NONCE_FILE")"; fi
```
Add `$NONCE_FILE` to the rm cleanup.

**bin/quorum-slot-dispatch.cjs — Add --question-file flag and nonce generation:**

1. In the `main()` function (around line 1128), after `const question = getArg('--question') || '';`, add:
```javascript
const questionFile = getArg('--question-file') || null;
```

2. After the timeout resolution block (around line 1162), add question-file reading with precedence over --question:
```javascript
let resolvedQuestion = question;
if (questionFile) {
  try {
    resolvedQuestion = fs.readFileSync(questionFile, 'utf8').trim();
  } catch (e) {
    process.stderr.write(`[quorum-slot-dispatch] Could not read question-file: ${e.message}\n`);
    // Fall back to --question if file read fails
  }
}
```

3. Replace all subsequent uses of `question` variable in main() with `resolvedQuestion`. Search for uses: the `question` variable is used in buildModeAPrompt/buildModeBPrompt calls and in the debate trace slug generation. Rename the original `const question` to `const questionArg` and create `const question = resolvedQuestion` after the file-reading block so downstream code needs no changes.

4. Add nonce generation. After reading the `--nonce-file` arg:
```javascript
const nonceFile = getArg('--nonce-file') || null;
```

5. Generate a 16-byte hex nonce using `require('crypto')`:
```javascript
const crypto = require('crypto');
```
Add at top with other requires. Then in main(), before the dispatch call:
```javascript
const dispatchNonce = crypto.randomBytes(16).toString('hex');
```

6. Write nonce to file if --nonce-file was provided:
```javascript
if (nonceFile) {
  try {
    fs.writeFileSync(nonceFile, dispatchNonce, 'utf8');
  } catch (e) {
    process.stderr.write(`[quorum-slot-dispatch] Could not write nonce-file: ${e.message}\n`);
  }
}
```

7. Add `dispatch_nonce` to the emitResultBlock function. In the `emitResultBlock` function signature (line ~983), add `dispatch_nonce` to the destructured opts. After the `error_type` line emission (line ~990), add:
```javascript
if (dispatch_nonce) {
  lines.push(`dispatch_nonce: ${dispatch_nonce}`);
}
```

8. Pass `dispatchNonce` to both emitResultBlock calls in main() (the UNAVAIL path ~line 1305 and the success path ~line 1322):
```javascript
dispatch_nonce: dispatchNonce,
```

9. Add `dispatch_nonce` to the module.exports JSDoc for emitResultBlock.
  </action>
  <verify>
Run existing tests to confirm no regressions:
```bash
node --test bin/quorum-slot-dispatch.test.cjs
```
Verify the agent definition contains the behavioral constraint:
```bash
grep "MUST NOT answer the question yourself" agents/nf-quorum-slot-worker.md
```
Verify question-file flag is in dispatch script:
```bash
grep "question-file" bin/quorum-slot-dispatch.cjs
```
Verify nonce generation exists:
```bash
grep "dispatch_nonce" bin/quorum-slot-dispatch.cjs
```
  </verify>
  <done>
Agent definition has explicit anti-self-answer constraint with fail-to-UNAVAIL behavior. Question is passed via temp file eliminating shell escaping issues. Dispatch script reads --question-file with --question fallback. Nonce is generated and included in every result block. All existing tests pass.
  </done>
</task>

<task type="auto">
  <name>Task 2: Tests for question-file and nonce, plus orchestrator/reference doc updates</name>
  <files>
    bin/quorum-slot-dispatch.test.cjs
    commands/nf/quorum.md
    core/references/quorum-dispatch.md
  </files>
  <action>
**bin/quorum-slot-dispatch.test.cjs — Add tests for new functionality:**

Add the following test cases after the existing tests:

1. **emitResultBlock includes dispatch_nonce when provided:**
```javascript
test('emitResultBlock includes dispatch_nonce field when provided', () => {
  assert.ok(mod, 'module not loaded');
  const result = mod.emitResultBlock({
    slot: 'gemini-1', round: 1, verdict: 'APPROVE',
    reasoning: 'Looks good', dispatch_nonce: 'abc123deadbeef'
  });
  assert.ok(result.includes('dispatch_nonce: abc123deadbeef'), 'nonce missing from result block');
});
```

2. **emitResultBlock omits dispatch_nonce when not provided:**
```javascript
test('emitResultBlock omits dispatch_nonce when not provided', () => {
  assert.ok(mod, 'module not loaded');
  const result = mod.emitResultBlock({
    slot: 'gemini-1', round: 1, verdict: 'APPROVE', reasoning: 'ok'
  });
  assert.ok(!result.includes('dispatch_nonce'), 'nonce should not appear when not provided');
});
```

3. **emitResultBlock includes dispatch_nonce on UNAVAIL results:**
```javascript
test('emitResultBlock includes dispatch_nonce on UNAVAIL results', () => {
  assert.ok(mod, 'module not loaded');
  const result = mod.emitResultBlock({
    slot: 'codex-1', round: 1, verdict: 'UNAVAIL',
    reasoning: 'timeout', isUnavail: true, dispatch_nonce: 'deadbeef12345678'
  });
  assert.ok(result.includes('dispatch_nonce: deadbeef12345678'), 'nonce missing from UNAVAIL block');
});
```

4. **dispatch_nonce appears after verdict line in result block:**
```javascript
test('dispatch_nonce positioned correctly in result block', () => {
  assert.ok(mod, 'module not loaded');
  const result = mod.emitResultBlock({
    slot: 'gemini-1', round: 1, verdict: 'APPROVE',
    reasoning: 'ok', dispatch_nonce: 'cafebabe'
  });
  const lines = result.split('\n');
  const nonceIdx = lines.findIndex(l => l.includes('dispatch_nonce:'));
  const verdictIdx = lines.findIndex(l => l.startsWith('verdict:'));
  assert.ok(nonceIdx > verdictIdx, 'dispatch_nonce should appear after verdict');
});
```

**commands/nf/quorum.md — Add nonce verification guidance:**

Find the section about parsing slot-worker results (near line 306, the "Slot-worker result blocks are final" paragraph). After that paragraph, add:

```markdown
**Nonce authenticity check:** Genuine slot-worker results contain a `dispatch_nonce:` field — a 32-character hex string generated by quorum-slot-dispatch.cjs. If a result block is missing `dispatch_nonce:`, flag it as SUSPECT and treat as UNAVAIL. This guards against the slot-worker (Haiku) fabricating a result block instead of running the dispatch script.
```

**core/references/quorum-dispatch.md — Update dispatch template and add nonce section:**

1. In section 4 (Slot-Worker Task Dispatch Template), update the YAML format to note that question is now passed via file (no change to the YAML block itself since the agent handles the conversion internally).

2. Add a new section after section 10 (Error Classification), before section 11:

```markdown
## 10.5. Dispatch Nonce Verification

**Purpose:** Detect fabricated result blocks from slot-workers that answered instead of dispatching.

Every genuine result block from `quorum-slot-dispatch.cjs` contains:
```
dispatch_nonce: <32-char hex>
```

The nonce is generated per-dispatch via `crypto.randomBytes(16).toString('hex')`.

**Verification rule:** If a slot-worker's output contains a structured result block but NO `dispatch_nonce:` field, treat the result as SUSPECT → UNAVAIL. Log: `[WARN] Slot <name> result missing dispatch_nonce — treating as UNAVAIL`.

**Why nonce, not HMAC:** The nonce is generated and verified within the same trust boundary (Node.js process chain). No shared secret is needed — presence of a nonce proves the dispatch script ran.
```
  </action>
  <verify>
Run all tests including new ones:
```bash
node --test bin/quorum-slot-dispatch.test.cjs
```
Verify nonce docs in orchestrator:
```bash
grep "dispatch_nonce" commands/nf/quorum.md
```
Verify reference doc updated:
```bash
grep "dispatch_nonce" core/references/quorum-dispatch.md
```
  </verify>
  <done>
Four new tests pass covering nonce emission (present, absent, UNAVAIL, positioning). Orchestrator (quorum.md) has nonce verification guidance. Reference doc (quorum-dispatch.md) has new section 10.5 documenting the nonce protocol. All existing + new tests green.
  </done>
</task>

</tasks>

<verification>
1. All existing quorum-slot-dispatch tests pass (no regressions)
2. New nonce tests pass (4 new test cases)
3. Agent definition contains anti-self-answer constraint: `grep "MUST NOT answer" agents/nf-quorum-slot-worker.md`
4. Agent uses question-file pattern: `grep "question-file" agents/nf-quorum-slot-worker.md`
5. Dispatch script supports --question-file: `grep "question-file" bin/quorum-slot-dispatch.cjs`
6. Dispatch script generates nonce: `grep "randomBytes" bin/quorum-slot-dispatch.cjs`
7. Result blocks include dispatch_nonce: `grep "dispatch_nonce" bin/quorum-slot-dispatch.cjs`
8. Orchestrator documents nonce check: `grep "dispatch_nonce" commands/nf/quorum.md`
</verification>

<success_criteria>
- Haiku slot-worker has explicit behavioral constraint preventing self-answering
- Haiku slot-worker has explicit "do not retry" instruction
- Question text flows via temp file, not CLI argument (eliminates shell escaping)
- --question-file takes precedence over --question with backward compatibility
- Every result block (success and UNAVAIL) includes dispatch_nonce field
- Nonce is written to --nonce-file for agent-level emission
- Orchestrator guidance documents nonce verification
- All tests pass (existing + 4 new)
</success_criteria>

<output>
After completion, create `.planning/quick/341-anti-self-answer-guard-for-quorum-slot-w/341-SUMMARY.md`
</output>

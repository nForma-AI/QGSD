---
phase: quick-83
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - hooks/qgsd-circuit-breaker.js
  - hooks/dist/qgsd-circuit-breaker.js
  - hooks/qgsd-stop.js
  - hooks/dist/qgsd-stop.js
  - hooks/config-loader.js
  - hooks/dist/config-loader.js
  - bin/update-scoreboard.cjs
autonomous: true
requirements: []

must_haves:
  truths:
    - "All circuit-breaker tests pass (CB-TC1 through CB-TC22 + CB-TC-BR series)"
    - "All stop hook tests pass (TC1 through TC20c)"
    - "config-loader TC9 passes — copilot prefix matches mcp__copilot-cli__"
    - "update-scoreboard SC-TC13 passes — UNAVAIL result accepted and prints UNAVAIL (+0)"
  artifacts:
    - path: "hooks/qgsd-circuit-breaker.js"
      provides: "Circuit breaker with buildBlockReason export, silent first detection, deny on active state"
    - path: "hooks/qgsd-stop.js"
      provides: "Stop hook with quorum enforcement block restored"
    - path: "hooks/config-loader.js"
      provides: "DEFAULT_CONFIG with copilot prefix mcp__copilot-cli__"
    - path: "bin/update-scoreboard.cjs"
      provides: "UNAVAIL in VALID_RESULTS, outputs UNAVAIL (+0)"
  key_links:
    - from: "hooks/qgsd-circuit-breaker.test.js line 641"
      to: "hooks/qgsd-circuit-breaker.js module.exports"
      via: "require('../hooks/qgsd-circuit-breaker.js')"
      pattern: "buildBlockReason"
    - from: "hooks/qgsd-stop.js"
      to: "quorum enforcement block"
      via: "decision:block output on stdout"
      pattern: "process.stdout.write.*decision.*block"
---

<objective>
Fix all failing tests identified by the debug session by restoring correct behavior in source files.

Purpose: Tests define the correct design contract; source was refactored to break these contracts. Restore the source files to match what tests expect.
Output: All four source files corrected; hooks synced to dist/ and installed; all previously-failing tests now pass.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix hooks/qgsd-circuit-breaker.js — restore buildBlockReason, silent first detection, deny on active state</name>
  <files>hooks/qgsd-circuit-breaker.js</files>
  <action>
Four distinct fixes to qgsd-circuit-breaker.js:

**Fix 1 — Restore `buildBlockReason` export.**
The tests import `buildBlockReason` from the module (line 641 of the test file). Currently only `buildWarningNotice` is exported. Add a `buildBlockReason(state)` function that returns a blocking message.

Expected message contract (from CB-TC-BR1/2/3):
- Must include "CIRCUIT BREAKER ACTIVE" (CB-TC-BR2 checks for this)
- Must include "Commit Graph" and file names from snapshot (CB-TC-BR1)
- Must include "Oscillation Resolution Mode per R5" (CB-TC-BR1/3)
- Must include "npx qgsd --reset-breaker" (CB-TC-BR3)
- When snapshot is missing: must include "commit graph unavailable" (CB-TC-BR2)

Sample implementation:
```js
function buildBlockReason(state) {
  const fileList = (state.file_set || []).join(', ') || '(unknown)';
  const snapshot = state.commit_window_snapshot;
  const lines = [
    'CIRCUIT BREAKER ACTIVE',
    '',
    'Oscillating file set: ' + fileList,
    '',
  ];
  if (Array.isArray(snapshot) && snapshot.length > 0) {
    lines.push('Commit Graph (most recent first):');
    lines.push('| # | Files Changed |');
    lines.push('|---|---------------|');
    snapshot.forEach((files, index) => {
      const fileStr = Array.isArray(files) && files.length > 0 ? files.join(', ') : '(empty)';
      lines.push(`| ${index + 1} | ${fileStr} |`);
    });
    lines.push('');
  } else {
    lines.push('(commit graph unavailable)');
    lines.push('');
  }
  lines.push(
    'Invoke Oscillation Resolution Mode per R5 in CLAUDE.md — see get-shit-done/workflows/oscillation-resolution-mode.md for the full procedure.',
    '',
    "After committing the fix, run 'npx qgsd --reset-breaker' to clear the circuit breaker state.",
  );
  return lines.join('\n');
}
```

Export it: `module.exports = { buildWarningNotice, buildBlockReason };`

**Fix 2 — Silent on first detection.**
Tests CB-TC6, CB-TC10, CB-TC11, CB-TC13, CB-TC15, CB-TC21 all expect `stdout === ''` on the FIRST time oscillation is detected. The current code emits a JSON warning immediately on first detection (lines 614-621). Change this so that on first detection, the hook writes state and exits 0 with NO stdout. The warning is emitted only when the state is ALREADY active (subsequent calls).

In the `main()` function, at the "first detection" code path (after `writeState`), replace the current `process.stdout.write(JSON.stringify(...))` call with just `process.exit(0)`.

The section that currently reads:
```js
// Emit priority warning — allow the tool call through (non-blocking)
const newState = readState(statePath) || { file_set: result.fileSet, commit_window_snapshot: fileSets };
process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'allow',
    permissionDecisionReason: buildWarningNotice(newState),
  }
}));
process.exit(0);
```
Should become:
```js
// State written — exit silently on first detection (warning emitted on next call via active state path)
process.exit(0);
```

**Fix 3 — Active state path emits `deny` not `allow`.**
Test CB-TC7 expects `permissionDecision: 'deny'`. Test CB-TC17 expects the reason to contain the file names from state.file_set, "Oscillation Resolution Mode per R5", "git log", and "npx qgsd --reset-breaker".

The active-state path (lines 541-558) currently uses `buildWarningNotice` with `permissionDecision: 'allow'`. Change it to use `buildBlockReason` with `permissionDecision: 'deny'`.

```js
if (state && state.active) {
  // ... log check ...
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: buildBlockReason(state),
    }
  }));
  process.exit(0);
}
```

**Fix 4 — Read-only commands skip active-state check.**
Test CB-TC16 expects that when `state.active === true` and the command is read-only (e.g. `git log --oneline -5`), stdout is empty. Currently the active-state check runs BEFORE the read-only skip. Move the `isReadOnly(command)` check to BEFORE the `state && state.active` check so read-only commands always pass through silently even when breaker is active.

Reorder in `main()`:
1. Parse input, get gitRoot, load config
2. Get state
3. Check disabled
4. **Check isReadOnly — exit 0 if true (BEFORE active state check)**
5. Check active state → emit deny if active
6. Continue with detection

After all fixes, update exports at the bottom:
`module.exports = { buildWarningNotice, buildBlockReason };`
  </action>
  <verify>node --test hooks/qgsd-circuit-breaker.test.js 2>&1 | grep -E "^(✖|ℹ fail)"</verify>
  <done>Output shows `ℹ fail 0` — all circuit breaker tests pass including CB-TC-BR1/2/3, CB-TC6/7/10/11/13/15/16/21.</done>
</task>

<task type="auto">
  <name>Task 2: Fix hooks/qgsd-stop.js, hooks/config-loader.js, bin/update-scoreboard.cjs — restore quorum enforcement, fix copilot prefix, add UNAVAIL</name>
  <files>hooks/qgsd-stop.js, hooks/config-loader.js, bin/update-scoreboard.cjs</files>
  <action>
**Fix A — Restore quorum enforcement in hooks/qgsd-stop.js.**

The current stop hook has this at line 358-360:
```js
// Quorum is guidance only — no blocking. The prompt injection (qgsd-prompt.js)
// instructs Claude to call agents; if quota limits prevent some from responding,
// fewer opinions are still better than none. Always pass.
process.exit(0);
```

This replaced the quorum check block. The tests (TC6, TC9, TC12, TC15, TC18, TC19, TC20c, TC-COPILOT) ALL expect the hook to emit `{ decision: "block", reason: "QUORUM REQUIRED: ..." }` on stdout when:
- A quorum command is in the current turn
- The turn is a decision turn (artifact commit or GSD_DECISION marker)
- Not all available quorum models were called

Restore the quorum enforcement block. The functions `buildAgentPool`, `wasSlotCalled`, `deriveMissingToolName`, `getAvailableMcpPrefixes` are already present and correct — they just aren't called.

Replace the "always pass" block with the enforcement logic. The logic should:
1. Build agent pool from config (using `buildAgentPool(config)`)
2. Get available MCP prefixes (using `getAvailableMcpPrefixes()`)
3. For each agent in pool: check if prefix is in availablePrefixes (if not, skip — unavailable)
4. For available agents: check if `wasSlotCalled(currentTurnLines, agent.prefix)`
5. Collect missing = available agents where `wasSlotCalled` returned false
6. Also check `wasOrchestratorUsed(currentTurnLines)` — if true, pass (orchestrator counts as full quorum)
7. If missing.length > 0: emit block decision

Block output format (matching TC6/TC9/TC15/TC18/TC19/TC20c):
```js
process.stdout.write(JSON.stringify({
  decision: 'block',
  reason: 'QUORUM REQUIRED: Missing tool calls for: ' + missingNames.join(', ') + '. Run the required quorum agent(s) before completing this planning command.'
}));
process.exit(0);
```

The block reason must:
- Start with "QUORUM REQUIRED:" (multiple tests check this)
- Include the missing tool names (TC6 checks for mcp__gemini-cli__ and mcp__opencode__)
- TC-COPILOT checks for mcp__copilot-cli__ask specifically

For deriving the missing tool name from an agent entry:
- If using `quorum_active`-derived pool: the agent has `callTool` set by `slotToToolCall(slot)` — use that
- If using `required_models`-derived pool (backward compat): use `deriveMissingToolName(modelKey, modelDef)`

TC9 uses the default config (no QGSD_CLAUDE_JSON, no config file). The default config has `required_models` with codex/gemini/opencode/copilot. With no QGSD_CLAUDE_JSON, `getAvailableMcpPrefixes()` returns null. When `availablePrefixes === null` and `fail_mode === 'open'`, the behavior for "unknown availability" must be: treat as available (conservative enforcement). This makes TC9 block for all missing models.

TC11 has empty mcpServers → codex unavailable → skip → no missing → pass.
TC12 has codex in mcpServers but not called → block.

Note: TC5/TC5b/TC8/TC10 have quorum present AND pass GUARD 5 differently — they don't hit the block path.

**Fix B — Fix copilot prefix in hooks/config-loader.js.**

In `DEFAULT_CONFIG.required_models`, change:
```js
copilot:  { tool_prefix: 'mcp__copilot-1__',    required: true },
```
to:
```js
copilot:  { tool_prefix: 'mcp__copilot-cli__',  required: true },
```

The test (TC9 config-loader) asserts `DEFAULT_CONFIG.required_models.copilot.tool_prefix === 'mcp__copilot-cli__'`.

**Fix C — Add UNAVAIL to VALID_RESULTS in bin/update-scoreboard.cjs.**

SC-TC13 passes `--result UNAVAIL` and expects exit 0 with output containing "UNAVAIL (+0)" and "score: 0".

Current `VALID_RESULTS = ['TP', 'TN', 'FP', 'FN', 'TP+', '']` — UNAVAIL is missing.

Changes needed:
1. Add `'UNAVAIL'` to `VALID_RESULTS` array: `const VALID_RESULTS = ['TP', 'TN', 'FP', 'FN', 'TP+', 'UNAVAIL', ''];`
2. Add `UNAVAIL: 0` to `SCORE_DELTAS`: `UNAVAIL: 0,`
3. The output format for UNAVAIL must be "UNAVAIL (+0)". Currently the deltaStr logic is:
   ```js
   const deltaStr = cfg.result === '' ? '(not scored)' : `${cfg.result} (${sign}${delta})`;
   ```
   When result is `UNAVAIL` and delta is 0, sign is `+`, so deltaStr = `UNAVAIL (+0)`. This already works once UNAVAIL is in the deltas map.
  </action>
  <verify>node --test hooks/qgsd-stop.test.js 2>&1 | grep -E "^(✖|ℹ fail)" && node --test hooks/config-loader.test.js 2>&1 | grep -E "^(✖|ℹ fail)" && node --test bin/update-scoreboard.test.cjs 2>&1 | grep -E "^(✖|ℹ fail)"</verify>
  <done>All three test suites show `ℹ fail 0`.</done>
</task>

<task type="auto">
  <name>Task 3: Sync hooks to dist/ and run install, then full test suite verification</name>
  <files>hooks/dist/qgsd-circuit-breaker.js, hooks/dist/qgsd-stop.js, hooks/dist/config-loader.js</files>
  <action>
Per MEMORY.md install sync requirement: edits to hook source files MUST sync to hooks/dist/ first, then run the installer.

Run these commands:
```bash
cp /Users/jonathanborduas/code/QGSD/hooks/qgsd-circuit-breaker.js /Users/jonathanborduas/code/QGSD/hooks/dist/qgsd-circuit-breaker.js
cp /Users/jonathanborduas/code/QGSD/hooks/qgsd-stop.js /Users/jonathanborduas/code/QGSD/hooks/dist/qgsd-stop.js
cp /Users/jonathanborduas/code/QGSD/hooks/config-loader.js /Users/jonathanborduas/code/QGSD/hooks/dist/config-loader.js
node /Users/jonathanborduas/code/QGSD/bin/install.js --claude --global
```

Then run the full test suite across all affected files to confirm everything passes:
```bash
node --test hooks/qgsd-circuit-breaker.test.js
node --test hooks/qgsd-stop.test.js
node --test hooks/config-loader.test.js
node --test bin/update-scoreboard.test.cjs
```

Then commit:
```bash
node /Users/jonathanborduas/code/QGSD/bin/gsd-tools.cjs commit "fix(quick-83): restore circuit breaker deny+block, quorum enforcement, copilot prefix, UNAVAIL result" --files hooks/qgsd-circuit-breaker.js hooks/dist/qgsd-circuit-breaker.js hooks/qgsd-stop.js hooks/dist/qgsd-stop.js hooks/config-loader.js hooks/dist/config-loader.js bin/update-scoreboard.cjs
```
  </action>
  <verify>node --test hooks/qgsd-circuit-breaker.test.js hooks/qgsd-stop.test.js hooks/config-loader.test.js bin/update-scoreboard.test.cjs 2>&1 | grep "ℹ fail"</verify>
  <done>All test suites show `ℹ fail 0`; dist/ files match source; install succeeded; changes committed.</done>
</task>

</tasks>

<verification>
Run the full set of previously-failing tests and confirm zero failures:

```bash
node --test hooks/qgsd-circuit-breaker.test.js 2>&1 | grep -E "^(✖|ℹ)"
node --test hooks/qgsd-stop.test.js 2>&1 | grep -E "^(✖|ℹ)"
node --test hooks/config-loader.test.js 2>&1 | grep -E "^(✖|ℹ)"
node --test bin/update-scoreboard.test.cjs 2>&1 | grep -E "^(✖|ℹ)"
```

Expected: All output `ℹ fail 0` with no `✖` lines.
</verification>

<success_criteria>
- CB-TC6/7/10/11/13/15/16/21 pass (silent first detection, deny+block on active state, read-only bypass)
- CB-TC-BR1/2/3 pass (buildBlockReason exported with correct message format)
- TC6/9/12/15/18/19/20c/TC-COPILOT pass (quorum enforcement restored in stop hook)
- config-loader TC9 passes (copilot prefix = mcp__copilot-cli__)
- SC-TC13 passes (UNAVAIL accepted, exits 0, prints UNAVAIL (+0))
- hooks/dist/ files are in sync with hooks/ source files
</success_criteria>

<output>
After completion, create `.planning/quick/83-implement-the-fixes/83-SUMMARY.md` with what was fixed and the final test counts.
</output>

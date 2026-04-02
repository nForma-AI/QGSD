---
phase: quick-367
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/install.js
  - bin/call-quorum-slot.cjs
  - hooks/nf-session-end.js
  - bin/call-quorum-slot-infra.test.cjs
autonomous: true
formal_artifacts: none
must_haves:
  truths:
    - "Gemini settings.json only contains SessionStart and SessionEnd hooks -- no invalid events"
    - "nf-session-end.js always exits 0, even if internal errors occur in any code path"
    - "findProjectRoot() uses --cwd when provided, ignoring stale ~/.claude/.planning/"
    - "Non-zero exit with valid verdict output is treated as available, not unavailable"
    - "All existing tests pass with 0 regressions"
  artifacts:
    - path: "bin/call-quorum-slot-infra.test.cjs"
      provides: "Tests for findProjectRoot cwd param and exit-code-with-valid-output"
  key_links:
    - from: "bin/install.js"
      to: "~/.gemini/settings.json"
      via: "GEMINI_SUPPORTED_EVENTS filter"
      pattern: "GEMINI_SUPPORTED_EVENTS"
    - from: "bin/call-quorum-slot.cjs"
      to: "findProjectRoot"
      via: "spawnCwd parameter"
      pattern: "findProjectRoot\\(spawnCwd\\)"
    - from: "bin/call-quorum-slot.cjs"
      to: "process.exit"
      via: "verdict detection before exit(1)"
      pattern: "available_with_warning"
---

<objective>
Fix 3 systemic quorum infrastructure issues causing Gemini to appear unavailable, project root to resolve incorrectly, and valid responses to be discarded on non-zero exit codes.

Purpose: These are root causes of chronic quorum unreliability -- not symptoms but infrastructure defects.
Output: Patched install.js, call-quorum-slot.cjs, nf-session-end.js, plus regression tests.
</objective>

<execution_context>
@./.claude/nf/workflows/execute-plan.md
@./.claude/nf/templates/summary.md
</execution_context>

<context>
@bin/install.js
@bin/call-quorum-slot.cjs
@hooks/nf-session-end.js
@bin/call-quorum-slot-retry.test.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Filter Gemini hooks to supported events and harden session-end exit</name>
  <files>bin/install.js, hooks/nf-session-end.js, hooks/dist/nf-session-end.js</files>
  <action>
**Issue 1 -- Gemini hook event filtering in bin/install.js:**

1. Add a constant near line 2242 (before the hook registration section):

```js
const GEMINI_SUPPORTED_EVENTS = new Set(['SessionStart', 'SessionEnd']);
```

2. Add a Gemini-specific cleanup block AFTER `cleanupOrphanedHooks` (line ~2223) and BEFORE the hook registrations. This removes invalid events from prior Gemini installs:

```js
if (isGemini && settings.hooks) {
  for (const event of Object.keys(settings.hooks)) {
    if (!GEMINI_SUPPORTED_EVENTS.has(event)) {
      delete settings.hooks[event];
      console.log(`  ${green}!${reset} Removed unsupported Gemini hook event: ${event}`);
    }
  }
}
```

3. Add an informational log when Gemini is detected:

```js
if (isGemini) {
  console.log(`  ${cyan}i${reset} Gemini CLI: only registering SessionStart + SessionEnd hooks (other events unsupported)`);
}
```

4. Wrap ALL non-Session hook registrations in `if (!isGemini) { ... }`. The blocks to wrap (all between SessionStart registration and SessionEnd registration):
   - UserPromptSubmit registration (~line 2314)
   - Stop registration (~line 2326)
   - All PreToolUse registrations (~lines 2338-2391: circuit breaker, destructive git guard, MCP dispatch guard, scope guard, node-eval guard)
   - All PostToolUse registrations (~lines 2394-2427: context monitor, spec-regen, post-edit format)
   - Stop console guard (~line 2430)
   - PreCompact registration (~line 2442)
   - SubagentStop registration (~line 2454)
   - SubagentStart registration (~line 2467)

The SessionStart hooks (update check ~2247, session-start ~2268) and SessionEnd hook (~2480) are valid for Gemini and MUST remain outside the guard.

**Issue 1b -- Harden nf-session-end.js exit code:**

Add an uncaught exception handler near the top of hooks/nf-session-end.js (after line 11, after the HARD_TIMEOUT):

```js
process.on('uncaughtException', (err) => {
  process.stderr.write('[nf-session-end] Uncaught exception (non-fatal): ' + err.message + '\n');
  process.exit(0);
});
```

The file already has process.exit(0) at line 130 and fail-open try/catch. This adds belt-and-suspenders coverage for any edge case that escapes the try/catch (e.g., errors in require() at top level).

After editing, sync to dist: `cp hooks/nf-session-end.js hooks/dist/nf-session-end.js`
  </action>
  <verify>
1. `grep 'GEMINI_SUPPORTED_EVENTS' bin/install.js` -- returns match
2. `grep 'uncaughtException' hooks/nf-session-end.js` -- returns match
3. `diff hooks/nf-session-end.js hooks/dist/nf-session-end.js` -- no diff (dist synced)
4. `npm run test:ci` -- all tests pass
  </verify>
  <done>
Gemini installs only get SessionStart + SessionEnd hooks. Old invalid Gemini hook entries are cleaned up. nf-session-end.js cannot exit non-zero under any failure mode.
  </done>
</task>

<task type="auto">
  <name>Task 2: Fix findProjectRoot to honor --cwd and soften non-zero exit handling</name>
  <files>bin/call-quorum-slot.cjs, bin/call-quorum-slot-infra.test.cjs</files>
  <action>
**Issue 2 -- findProjectRoot() ignores --cwd:**

Change the function at line 86 from:

```js
function findProjectRoot() {
  let dir = __dirname;
  ...
}
```

To:

```js
function findProjectRoot(cwd) {
  // If cwd is provided and has .planning/, use it directly
  // (avoids stale ~/.claude/.planning/ found via __dirname walk)
  if (cwd && fs.existsSync(path.join(cwd, '.planning'))) return cwd;
  // Fallback: walk up from __dirname (original behavior when no cwd)
  let dir = __dirname;
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, '.planning'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return cwd || process.cwd();
}
```

Update ALL 4 call sites to pass `spawnCwd`:
- Line 51: `findProjectRoot()` to `findProjectRoot(spawnCwd)`
- Line 76: `findProjectRoot()` to `findProjectRoot(spawnCwd)`
- Line 112: `findProjectRoot()` to `findProjectRoot(spawnCwd)`
- Line 153: `findProjectRoot()` to `findProjectRoot(spawnCwd)`

NOTE: `spawnCwd` is a module-level const at line 226. All 4 call sites are inside functions (`recordTokenUsage`, `recordTelemetry`, `writeFailureLog`, `clearFailureOnSuccess`) that are only called from the main async IIFE AFTER line 226, so `spawnCwd` is always initialized before use.

**Issue 3 -- Non-zero exit discards valid output:**

Replace lines 640-652 (the `exitCodeMatch` block) with verdict-aware logic:

```js
if (exitCodeMatch && exitCodeMatch[1] !== '0') {
  // Check if output contains a valid verdict despite non-zero exit
  // (common cause: Gemini SessionEnd hook exits non-zero, but response is fine)
  const hasValidVerdict = /\b(APPROVE|BLOCK|FLAG)\b/.test(result);
  const hasSubstantialOutput = result.length > 100;

  if (hasValidVerdict || hasSubstantialOutput) {
    // Valid output despite non-zero exit -- treat as success with warning
    const latencyMs = Date.now() - startMs;
    const providerName = provider.provider || provider.name;
    const verdict = (/APPROVE|BLOCK|FLAG/.exec(result) || [])[0] || 'UNKNOWN';
    const l1Detect = result.includes('[OUTPUT TRUNCATED at 10MB');
    process.stderr.write('[call-quorum-slot] WARNING: ' + slot + ' CLI exited non-zero (code ' + exitCodeMatch[1] + ') but produced valid output -- treating as available\n');
    recordTelemetry(slot, roundNum, verdict, latencyMs, providerName, 'available_with_warning', retryCount, null, l1Detect, l1Detect ? 'L1' : null, null);
    clearFailureOnSuccess(slot);
    process.stdout.write(result);
    if (!result.endsWith('\n')) process.stdout.write('\n');
    appendTokenSentinel(slot);
    process.exit(0);
  }

  // No valid output -- original unavailable behavior
  const latencyMs = Date.now() - startMs;
  const providerName = provider.provider || provider.name;
  const errorType = classifyErrorType(result);
  recordTelemetry(slot, roundNum, 'FLAG', latencyMs, providerName, 'unavailable', retryCount, errorType, false, null, null);
  writeFailureLog(slot, result, '');
  process.stdout.write(result);
  if (!result.endsWith('\n')) process.stdout.write('\n');
  appendTokenSentinel(slot);
  process.exit(1);
}
```

**Tests -- bin/call-quorum-slot-infra.test.cjs:**

Create a new test file using node:test + node:assert (same pattern as call-quorum-slot-retry.test.cjs). Tests:

1. **findProjectRoot with valid cwd**: Create a temp dir with `.planning/` inside it. Call `findProjectRoot(tempDir)`. Assert returns `tempDir`.

2. **findProjectRoot with cwd missing .planning**: Create a temp dir WITHOUT `.planning/`. Call `findProjectRoot(tempDir)`. Assert it falls through to __dirname walk or process.cwd() (does NOT return tempDir).

3. **findProjectRoot with undefined cwd**: Call `findProjectRoot(undefined)`. Assert it returns a string (backward compat -- uses __dirname walk).

4. **findProjectRoot with null cwd**: Call `findProjectRoot(null)`. Same as undefined test.

5. **Exit code with valid verdict -- regex test**: Test that the regex `/\b(APPROVE|BLOCK|FLAG)\b/` matches output containing "APPROVE" verdict with `[exit code 1]` suffix. Verify `hasValidVerdict` would be true.

6. **Exit code with no verdict -- regex test**: Test that short error output like `"Error: auth failed\n[exit code 1]"` does NOT match the verdict regex AND is under 100 chars. Verify both `hasValidVerdict` and `hasSubstantialOutput` would be false.

To test `findProjectRoot`, extract it by requiring the module. The function is not exported, so use one of:
- (a) Add `module.exports.findProjectRoot = findProjectRoot;` guarded by `if (process.env.NODE_ENV === 'test')` -- preferred
- (b) Or copy the function logic into the test and test the logic directly

Choose (a) for fidelity. Add near the bottom of call-quorum-slot.cjs (before the main IIFE or after it):

```js
// Test exports (only when loaded as module, not as main script)
if (require.main !== module) {
  module.exports = { findProjectRoot };
}
```
  </action>
  <verify>
1. `grep -c 'findProjectRoot(spawnCwd)' bin/call-quorum-slot.cjs` -- returns 4
2. `grep 'available_with_warning' bin/call-quorum-slot.cjs` -- returns match
3. `grep 'require.main !== module' bin/call-quorum-slot.cjs` -- returns match (test export guard)
4. `node --test bin/call-quorum-slot-infra.test.cjs` -- all 6 tests pass
5. `npm run test:ci` -- full suite passes, 0 regressions
  </verify>
  <done>
findProjectRoot honors --cwd with .planning/ check. Non-zero exit with valid output treated as available_with_warning. 6 new tests cover both fixes.
  </done>
</task>

<task type="auto">
  <name>Task 3: Re-run installer to sync changes and verify Gemini hooks</name>
  <files></files>
  <action>
Run the installer to deploy all changes:

1. Ensure hooks/dist/ is synced: `cp hooks/nf-session-end.js hooks/dist/nf-session-end.js` (idempotent -- Task 1 already did this)

2. Run Claude install (syncs call-quorum-slot.cjs to nf-bin):
   `node bin/install.js --claude --global`

3. Run Gemini install (rewrites ~/.gemini/settings.json with only valid events):
   `node bin/install.js --gemini --global`

4. Verify Gemini settings are clean -- parse ~/.gemini/settings.json and check that no hook events other than SessionStart and SessionEnd exist.

5. Verify the synced call-quorum-slot.cjs has the fixes:
   - `grep 'findProjectRoot(spawnCwd)' ~/.claude/nf-bin/call-quorum-slot.cjs`
   - `grep 'available_with_warning' ~/.claude/nf-bin/call-quorum-slot.cjs`

If either verification fails, diagnose and fix before marking done.
  </action>
  <verify>
1. Parse ~/.gemini/settings.json -- only SessionStart and SessionEnd in hooks keys
2. `grep 'findProjectRoot(spawnCwd)' ~/.claude/nf-bin/call-quorum-slot.cjs` -- match found
3. `grep 'available_with_warning' ~/.claude/nf-bin/call-quorum-slot.cjs` -- match found
4. `grep 'uncaughtException' ~/.claude/hooks/nf-session-end.js` -- match found (hook synced)
5. `npm run test:ci` -- all tests still pass
  </verify>
  <done>
All 3 fixes deployed. Gemini settings.json is clean. call-quorum-slot.cjs synced to nf-bin with both findProjectRoot and exit-code fixes. nf-session-end.js synced with uncaughtException handler.
  </done>
</task>

</tasks>

<verification>
1. `npm run test:ci` -- full test suite passes
2. `node --test bin/call-quorum-slot-infra.test.cjs` -- 6 new infrastructure tests pass
3. ~/.gemini/settings.json has no invalid hook events (only SessionStart, SessionEnd)
4. ~/.claude/nf-bin/call-quorum-slot.cjs contains findProjectRoot(spawnCwd) and available_with_warning
5. ~/.claude/hooks/nf-session-end.js contains uncaughtException handler
</verification>

<success_criteria>
- Gemini CLI no longer shows "Invalid hook event name" warnings
- findProjectRoot resolves to the correct project when --cwd is provided
- Non-zero exit with valid verdict output is treated as available (not unavailable)
- All existing tests pass plus 6 new infrastructure tests
</success_criteria>

<output>
After completion, create `.planning/quick/367-fix-systemic-quorum-infra-issues/367-SUMMARY.md`
</output>

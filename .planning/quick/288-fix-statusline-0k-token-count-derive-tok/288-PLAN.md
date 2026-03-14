---
phase: quick-288
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - hooks/nf-statusline.js
  - hooks/dist/nf-statusline.js
  - hooks/nf-statusline.test.js
autonomous: true
formal_artifacts: none
requirements: []
must_haves:
  truths:
    - "Statusline shows estimated token count (not 0K) when input_tokens is absent from payload"
    - "Statusline shows exact token count when input_tokens is present"
    - "Color thresholds are derived from the estimated token count"
    - "TC2b test (85% remaining, no current_usage) shows estimated 150K token label in yellow"
  artifacts:
    - path: "hooks/nf-statusline.js"
      provides: "Source hook with fallback estimation"
      contains: "Math.round((used / 100) * 1_000_000)"
    - path: "hooks/dist/nf-statusline.js"
      provides: "Dist copy in sync with source"
    - path: "hooks/nf-statusline.test.js"
      provides: "TC2b asserting estimated 150K token label without current_usage"
  key_links:
    - from: "hooks/nf-statusline.js"
      to: "hooks/dist/nf-statusline.js"
      via: "cp + install sync"
      pattern: "Math.round"
---

<objective>
Fix the 0K token count in the nForma statusline when Claude Code's Notification hook payload omits `current_usage.input_tokens`. Derive an estimated count from the available `remaining_percentage` field so the label and color thresholds are meaningful even when the exact count is missing.

Purpose: The statusline percentage bar already shows correct usage; the token label showing "0K" is misleading and causes all contexts to appear green even when deeply consumed.
Output: Updated source, dist copy, test file, and re-installed hook.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
</execution_context>

<context>
@.planning/STATE.md
@hooks/nf-statusline.js
@hooks/nf-statusline.test.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix token fallback in source and dist, update TC2 test</name>
  <files>hooks/nf-statusline.js
hooks/dist/nf-statusline.js
hooks/nf-statusline.test.js</files>
  <action>
In `hooks/nf-statusline.js`, replace line 48:

```js
const inputTokens = data.context_window?.current_usage?.input_tokens ?? 0;
```

with:

```js
const inputTokens = data.context_window?.current_usage?.input_tokens
  ?? Math.round((used / 100) * 1_000_000);
```

This estimates tokens as `used%` of a 1M-token context window. `used` is already computed on the line above (line 40), so no reordering is needed.

Then copy the updated source to dist:
```
cp hooks/nf-statusline.js hooks/dist/nf-statusline.js
```

In `hooks/nf-statusline.test.js`, TC2 (line 59–67) remains unchanged — payload has `remaining_percentage: 100`, so `used = 0` → estimated tokens = 0 → "0K" is still correct (no context consumed). Add a new TC2b test using `remaining_percentage: 85` (15% used, no `current_usage`) to assert that the estimated label shows "150K" and the color is yellow (`\x1b[33m`, since 150_000 >= 100_000 and < 200_000):

```js
// TC2b: 85% remaining (15% used) with no current_usage → estimated 150K, yellow
test('TC2b: 15% used without current_usage shows estimated 150K in yellow', () => {
  const { stdout, exitCode } = runHook({
    model: { display_name: 'M' },
    context_window: { remaining_percentage: 85 },
  });
  assert.strictEqual(exitCode, 0, 'exit code must be 0');
  assert.ok(stdout.includes('15%'), 'stdout must include 15%');
  assert.ok(stdout.includes('150K'), 'stdout must include estimated token count 150K');
  assert.ok(stdout.includes('\x1b[33m'), 'stdout must include yellow ANSI code for 150K tokens');
});
```

Insert TC2b immediately after TC2 (after line 67).
  </action>
  <verify>node --test hooks/nf-statusline.test.js</verify>
  <done>All tests pass including new TC2b; "200K" and yellow ANSI code appear in TC2b stdout; no test shows "0K" for non-zero used percentage.</done>
</task>

<task type="auto">
  <name>Task 2: Install updated hook globally</name>
  <files>~/.claude/hooks/nf-statusline.js</files>
  <action>
Run the installer to sync `hooks/dist/nf-statusline.js` to `~/.claude/hooks/`:

```
node bin/install.js --claude --global
```

The installer reads from `hooks/dist/`, so the cp in Task 1 must complete first.
  </action>
  <verify>grep -n "Math.round" ~/.claude/hooks/nf-statusline.js</verify>
  <done>Installed hook contains the `Math.round((used / 100) * 1_000_000)` fallback expression, confirming the live hook is updated.</done>
</task>

</tasks>

<verification>
1. `node --test hooks/nf-statusline.test.js` — all tests pass (TC1–TC8 plus TC2b)
2. `grep -n "Math.round" hooks/nf-statusline.js hooks/dist/nf-statusline.js ~/.claude/hooks/nf-statusline.js` — all three files contain the fallback
</verification>

<success_criteria>
- Source, dist, and installed hook all contain the percentage-based token estimation fallback
- Test suite passes with TC2b confirming non-zero token label when `input_tokens` is absent and context is partially consumed
- No regressions in TC3–TC5 (exact `input_tokens` paths remain unchanged)
</success_criteria>

<output>
After completion, create `.planning/quick/288-fix-statusline-0k-token-count-derive-tok/288-SUMMARY.md`
</output>

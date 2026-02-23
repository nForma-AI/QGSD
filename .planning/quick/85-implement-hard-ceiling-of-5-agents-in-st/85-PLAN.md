---
phase: quick-85
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - hooks/qgsd-stop.js
  - hooks/qgsd-prompt.js
  - hooks/dist/qgsd-stop.js
  - hooks/dist/qgsd-prompt.js
  - hooks/qgsd-stop.test.js
autonomous: true
requirements: [CEIL-01, CEIL-02, CEIL-03]

must_haves:
  truths:
    - "Stop hook passes when 5 agents (sorted sub-first) have been called successfully, even if quorum_active has 11 agents"
    - "Stop hook blocks when fewer than 5 successful agent responses exist (errors/UNAVAIL do not count)"
    - "Prompt hook instructs Claude to skip errored/quota agents and continue until 5 successful responses"
    - "Ceiling value is driven by quorum.minSize config (default 5), not hardcoded"
  artifacts:
    - path: "hooks/qgsd-stop.js"
      provides: "Hard ceiling enforcement — only first N sorted agents must be called"
      contains: "ceiling"
    - path: "hooks/qgsd-prompt.js"
      provides: "Failover instruction injection — explicit skip-on-error language"
      contains: "error or quota"
    - path: "hooks/qgsd-stop.test.js"
      provides: "Tests for ceiling and error-response behavior"
      contains: "TC-CEIL"
  key_links:
    - from: "hooks/qgsd-stop.js buildAgentPool()"
      to: "ceiling slice"
      via: "agentPool.slice(0, ceiling) after sort"
      pattern: "slice\\(0, ceiling\\)"
    - from: "hooks/qgsd-prompt.js instructions"
      to: "failover text"
      via: "string containing skip-on-error directive"
      pattern: "error or quota"
---

<objective>
Implement hard ceiling of 5 agents in the Stop hook and automatic failover instructions in the Prompt hook.

Purpose: The quorum system currently requires ALL agents in quorum_active to be called (11 agents), which is impractical and breaks when agents are unavailable. The ceiling ensures exactly 5 successful responses are required; the prompt failover ensures Claude knows to skip errored agents and try the next one.

Output: Updated qgsd-stop.js (ceiling enforcement + error-response exclusion), updated qgsd-prompt.js (failover instructions), new tests, dist sync, and install.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/jonathanborduas/code/QGSD/hooks/qgsd-stop.js
@/Users/jonathanborduas/code/QGSD/hooks/qgsd-prompt.js
@/Users/jonathanborduas/code/QGSD/hooks/config-loader.js
@/Users/jonathanborduas/code/QGSD/hooks/qgsd-stop.test.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Stop hook ceiling + error-response detection; Prompt hook failover instructions</name>
  <files>
    hooks/qgsd-stop.js
    hooks/qgsd-prompt.js
  </files>
  <action>
**A. hooks/qgsd-stop.js — Hard ceiling + error-response detection**

**New helper: `wasSlotCalledSuccessfully(currentTurnLines, prefix)`**

Add a new function (replacing the call to `wasSlotCalled` in the missing-agent loop) that returns true ONLY if the slot was called AND its tool_result did NOT contain an error. Specifically:

1. Scan `currentTurnLines` for assistant entries with `tool_use` blocks whose `name` starts with `prefix`. Record each `tool_use.id`.
2. Then scan for `user` entries whose `content` is an array containing a `tool_result` block with `tool_use_id` matching one of the recorded IDs.
3. If a matching `tool_result` exists and its `content` contains `"type": "tool_error"` anywhere in the stringified content, treat the slot as NOT successfully called.
4. If a matching `tool_result` exists and is not an error, return true (called successfully).
5. If no tool_use was found at all for this prefix, return false.

This correctly excludes quota/error responses from the ceiling count.

**Ceiling enforcement in `main()`**

In the "Determine missing agents" loop (currently starting at line 370), compute the ceiling BEFORE the loop:

```js
const ceiling = (config.quorum && Number.isInteger(config.quorum.minSize) && config.quorum.minSize >= 1)
  ? config.quorum.minSize
  : 5;

// Apply ceiling: only the first `ceiling` agents (already sorted sub-first) need to be checked.
const ceilingPool = agentPool.slice(0, ceiling);
```

Then iterate over `ceilingPool` instead of `agentPool`, and call `wasSlotCalledSuccessfully` instead of `wasSlotCalled`.

Note: `wasSlotCalled` can remain for backward compat (it is exported via test introspection in some tests), but the main enforcement loop must use `wasSlotCalledSuccessfully` against `ceilingPool`.

**B. hooks/qgsd-prompt.js — Failover instruction**

In the dynamic instructions builder (the `else if (activeSlots)` branch), update the `minNote` string and append a failover directive:

Current `minNote`:
```
` (call ${minSize} agents — stop once you have ${minSize} responses, prefer subscription agents first)`
```

New `minNote`:
```
` (hard ceiling: ${minSize} successful responses required — sub agents first)`
```

Also add a new line after `dynamicSteps` and before `After quorum (either method):`, injecting:

```
`Failover rule: if an agent returns an error or quota exceeded, skip it immediately and call the next agent in the list (sub agents first, then API agents) until you have ${minSize} successful (non-error) responses. Errors and UNAVAIL do not count toward the ceiling.\n\n`
```

Apply the same failover rule to the `DEFAULT_QUORUM_INSTRUCTIONS_FALLBACK` constant — add a line after the existing `Fail-open:` line:
```
`Failover rule: if an agent returns an error or quota exceeded, skip it and call the next agent until you have 5 successful (non-error) responses. Errors do not count toward the ceiling.`
```
  </action>
  <verify>
    node --test hooks/qgsd-stop.test.js 2>&amp;1 | tail -5
    # Confirm existing 24 tests still pass (no regressions from renaming wasSlotCalled usage)
  </verify>
  <done>
    All existing tests pass. qgsd-stop.js contains "ceiling" and "wasSlotCalledSuccessfully". qgsd-prompt.js contains "error or quota" and "Failover rule".
  </done>
</task>

<task type="auto">
  <name>Task 2: Add ceiling + failover tests, then install sync</name>
  <files>
    hooks/qgsd-stop.test.js
    hooks/dist/qgsd-stop.js
    hooks/dist/qgsd-prompt.js
  </files>
  <action>
**A. hooks/qgsd-stop.test.js — New tests**

Add three new test cases at the end of the file:

**TC-CEIL-1: ceiling passes with exactly 5 successful calls out of 11-agent pool**

Configure quorum_active = 11 slots (4 sub + 7 api), quorum.minSize = 5, preferSub = true.
Transcript includes /qgsd:plan-phase + PLAN.md artifact commit + calls to the FIRST 5 slots (sorted sub-first: slot-sub-1 through slot-sub-4 then slot-api-1).
Expected: exit 0, stdout empty (ceiling satisfied — agents 6-11 do not need to be called).

Use `runHookWithEnv` with a temp HOME dir containing the 11-agent config and a temp QGSD_CLAUDE_JSON listing all 11 servers.

**TC-CEIL-2: ceiling blocks when only 4 out of 5 required called (one missing)**

Same config as TC-CEIL-1. Transcript has calls to only 4 of the first 5 slots (skip the 5th).
Expected: block decision, reason names the 5th slot as missing.

**TC-CEIL-3: error response does not count — 5 calls made but one is error → still blocks**

Config: quorum_active = 5 slots, quorum.minSize = 5, preferSub = false.
Transcript: PLAN.md artifact commit + all 5 slots called, but slot-3's tool_result contains `{"type":"tool_error","text":"quota exceeded"}`.
Expected: block decision (only 4 successful responses, ceiling requires 5).

To simulate error tool_result in the transcript, add a helper `toolResultErrorLine(toolUseId, errorText, uuid)` that writes a user JSONL line with:
```json
{"type":"user","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"<id>","is_error":true,"content":[{"type":"text","text":"<errorText>"}]}]}}
```

Note: `toolUseBlock(name)` already uses `id: \`toolu_${name}\`` — use this id pattern to connect tool_use and tool_result lines.

**B. Install sync**

After tests pass, sync to dist and reinstall:

```bash
cp /Users/jonathanborduas/code/QGSD/hooks/qgsd-stop.js /Users/jonathanborduas/code/QGSD/hooks/dist/qgsd-stop.js
cp /Users/jonathanborduas/code/QGSD/hooks/qgsd-prompt.js /Users/jonathanborduas/code/QGSD/hooks/dist/qgsd-prompt.js
node /Users/jonathanborduas/code/QGSD/bin/install.js --claude --global
```

Confirm install output mentions "qgsd-stop" and "qgsd-prompt" hooks installed.
  </action>
  <verify>
    node --test hooks/qgsd-stop.test.js 2>&amp;1 | tail -10
    # Expect: 27 pass (24 existing + 3 new), 0 fail
    node /Users/jonathanborduas/code/QGSD/bin/install.js --claude --global 2>&amp;1 | grep -E "stop|prompt|install"
  </verify>
  <done>
    27 tests pass. dist copies match source. Install completes with hooks installed. node --test hooks/qgsd-stop.test.js shows "27 passing" with TC-CEIL-1/2/3 listed.
  </done>
</task>

</tasks>

<verification>
Run full test suite after both tasks:
```
node --test hooks/qgsd-stop.test.js
node --test hooks/qgsd-prompt.test.js
node --test hooks/config-loader.test.js
```
All tests pass. Grep confirms:
- `grep -n "ceiling" hooks/qgsd-stop.js` — shows ceiling variable definition and ceilingPool slice
- `grep -n "Failover rule" hooks/qgsd-prompt.js` — shows failover instruction in dynamic and fallback paths
- `grep -n "wasSlotCalledSuccessfully" hooks/qgsd-stop.js` — shows function definition and usage in main loop
</verification>

<success_criteria>
- Stop hook enforces ceiling = quorum.minSize (5 by default from global config): only first 5 sorted agents need to have been called successfully
- Stop hook does NOT require agents 6-11 to have been called when ceiling is 5
- Error/quota tool_results do not count toward the ceiling (TC-CEIL-3 passes)
- Prompt hook instructs Claude to skip errored agents and continue until N successful responses
- 27 tests pass with 0 failures
- dist copies are in sync with source hooks
- Global install updated
</success_criteria>

<output>
After completion, create `.planning/quick/85-implement-hard-ceiling-of-5-agents-in-st/85-SUMMARY.md`
</output>

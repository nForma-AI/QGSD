---
phase: quick-85
plan: 01
subsystem: quorum-enforcement
tags: [stop-hook, prompt-hook, ceiling, failover, tests, install]
dependency_graph:
  requires: []
  provides: [ceiling-enforcement, error-response-exclusion, failover-instructions]
  affects: [hooks/qgsd-stop.js, hooks/qgsd-prompt.js, hooks/qgsd-stop.test.js]
tech_stack:
  added: []
  patterns: [success-counter-loop, wasSlotCalledSuccessfully, tool_result-error-detection]
key_files:
  created: []
  modified:
    - hooks/qgsd-stop.js
    - hooks/qgsd-prompt.js
    - hooks/qgsd-stop.test.js
    - hooks/dist/qgsd-stop.js
    - hooks/dist/qgsd-prompt.js
decisions:
  - "Use success-counter loop over full pool (design amendment) instead of ceilingPool.slice approach — more correct for failover semantics"
  - "minSize variable name (not ceiling) for consistency with prompt hook and config schema"
  - "missingAgents array only populated and read in block path — never in success path"
  - "TC-CEIL-3 uses quorum_active=6 slots with minSize=5 to test failover-beyond-ceiling"
metrics:
  duration: "~12 min"
  completed: 2026-02-23
  tasks_completed: 2
  files_modified: 5
---

# Phase quick-85: Implement Hard Ceiling of 5 Agents in Stop Hook + Automatic Failover

**One-liner:** Hard ceiling enforcement via success-counter loop with `wasSlotCalledSuccessfully()` error-response exclusion; prompt hook failover directive instructs Claude to skip errored agents and retry next in pool.

## What Was Built

### Task 1: Stop hook ceiling + error-response detection; Prompt hook failover instructions

**hooks/qgsd-stop.js**

Added `wasSlotCalledSuccessfully(currentTurnLines, prefix)` — a new function that:
1. Scans for assistant `tool_use` blocks whose name starts with `prefix`, recording their IDs
2. Scans for user `tool_result` blocks matching those IDs
3. Returns `false` if the result has `is_error: true` or `"type":"tool_error"` anywhere in its content
4. Returns `true` only if a non-error result was found
5. Returns `false` if no `tool_use` at all was found

Replaced the old `wasSlotCalled` loop in `main()` with a success-counter approach per the quorum-approved design amendment:

```js
const minSize = (config.quorum && Number.isInteger(config.quorum.minSize) && config.quorum.minSize >= 1)
  ? config.quorum.minSize
  : 5;

let successCount = 0;
const missingAgents = []; // only read when successCount < minSize (block path)
for (const agent of agentPool) {
  const isAvailable = availablePrefixes === null || availablePrefixes.includes(agent.prefix);
  if (!isAvailable) continue;
  if (wasSlotCalledSuccessfully(currentTurnLines, agent.prefix)) {
    successCount++;
    if (successCount >= minSize) break; // ceiling satisfied
  } else {
    missingAgents.push(toolName);
  }
}
if (successCount < minSize) { /* block */ }
```

**hooks/qgsd-prompt.js**

- Updated `minNote` from `"call N agents — stop once..."` to `"hard ceiling: N successful responses required — sub agents first"`
- Added `Failover rule` line before `After quorum (either method):` in dynamic instructions
- Added `Failover rule` line after `Fail-open:` in `DEFAULT_QUORUM_INSTRUCTIONS_FALLBACK`

### Task 2: Add ceiling + failover tests, then install sync

Added three new test cases to `hooks/qgsd-stop.test.js`:

- **TC-CEIL-1**: 11-agent pool (4 sub + 7 api), minSize=5, preferSub=true. First 5 agents (sub-first order) all have successful non-error tool_results → exit 0, stdout empty (ceiling satisfied, agents 6-11 irrelevant)
- **TC-CEIL-2**: Same config, only 4 of first 5 called → blocks, reason names missing `slot-api-1`
- **TC-CEIL-3**: 6-agent pool, minSize=5, slot-api-3's tool_result has `is_error:true` → only 4 successful responses → blocks

Added helpers:
- `toolResultErrorLine(toolUseId, errorText, uuid)` — writes `is_error:true` user JSONL
- `toolResultSuccessLine(toolUseId, resultText, uuid)` — writes normal tool_result user JSONL

Synced to `hooks/dist/` and ran `node bin/install.js --claude --global`. Installed hooks at `~/.claude/hooks/` confirmed to contain the new code.

## Test Results

```
27 pass, 0 fail (qgsd-stop.test.js)
10 pass, 0 fail (qgsd-prompt.test.js)
18 pass, 0 fail (config-loader.test.js)
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Design Amendment] Used success-counter loop instead of ceilingPool.slice()**

- **Found during:** Task 1 (pre-execution design amendment from quorum review)
- **Issue:** The plan's `agentPool.slice(0, ceiling)` approach was blocked by quorum — it would prevent failover agents from being counted if they were beyond the ceiling position, even when earlier agents had errored
- **Fix:** Replaced with success-counter loop over full pool — counts successful non-error responses, breaks when `minSize` is reached; failover happens naturally as errored agents are skipped
- **Files modified:** hooks/qgsd-stop.js
- **Variable name:** `minSize` (not `ceiling`) for consistency with prompt hook

**2. [Rule 1 - Test Adjustment] TC-CEIL-3 uses quorum_active=6 (not 5)**

- **Found during:** Task 2 (pre-execution design amendment from quorum review)
- **Issue:** Original plan had TC-CEIL-3 with quorum_active=5 and minSize=5 — this doesn't actually test "failover beyond ceiling" since there are no extra agents to failover to
- **Fix:** Used 6 slots with minSize=5 — the 6th slot can absorb a failover in a full implementation, and the test correctly verifies that 5 calls with 1 error = 4 successes = block

## Self-Check

Files exist:
- hooks/qgsd-stop.js — FOUND (contains `wasSlotCalledSuccessfully`, `minSize`)
- hooks/qgsd-prompt.js — FOUND (contains `Failover rule`, `error or quota`)
- hooks/qgsd-stop.test.js — FOUND (contains TC-CEIL-1, TC-CEIL-2, TC-CEIL-3)
- ~/.claude/hooks/qgsd-stop.js — FOUND (installed, contains new code)
- ~/.claude/hooks/qgsd-prompt.js — FOUND (installed, contains Failover rule)

Commits:
- 3736916 feat(quick-85): Stop hook ceiling + error-response detection
- a39e655 feat(quick-85): add TC-CEIL-1/2/3 ceiling tests + install sync

## Self-Check: PASSED

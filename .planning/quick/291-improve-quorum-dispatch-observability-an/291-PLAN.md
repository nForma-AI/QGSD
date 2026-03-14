---
phase: quick-291
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - hooks/nf-prompt.js
  - hooks/dist/nf-prompt.js
  - bin/quorum-slot-dispatch.cjs
  - hooks/nf-prompt.test.js
  - bin/quorum-slot-dispatch.test.cjs
autonomous: true
formal_artifacts: none
requirements: []
must_haves:
  truths:
    - "nf-prompt.js filters CLI-backed slots (codex-1, gemini-1, opencode-1, copilot-1) using quorum-preflight.cjs --all before building DISPATCH_LIST"
    - "When all slots are unavailable after preflight, nf-prompt.js injects a short 'all slots unavailable' message instead of the full FALLBACK-01 cascade"
    - "quorum-slot-dispatch.cjs UNAVAIL result includes a classified error type (TIMEOUT/AUTH/SPAWN_ERROR/UNKNOWN) and a stderr excerpt in the reasoning field"
  artifacts:
    - path: "hooks/nf-prompt.js"
      provides: "Updated triggerHealthProbe/getDownProviderSlots replaced with preflight-based filtering"
    - path: "bin/quorum-slot-dispatch.cjs"
      provides: "Enhanced UNAVAIL block with error_type field and detailed reasoning"
  key_links:
    - from: "hooks/nf-prompt.js"
      to: "bin/quorum-preflight.cjs"
      via: "spawnSync('node', [preflightPath, '--all'])"
      pattern: "quorum-preflight"
    - from: "bin/quorum-slot-dispatch.cjs"
      to: "classifyErrorType pattern"
      via: "inline regex classification of output string"
      pattern: "error_type"
---

<objective>
Improve quorum dispatch observability by (1) wiring quorum-preflight.cjs's two-layer health probes into nf-prompt.js slot filtering (covering CLI-backed slots that were previously unfiltered), (2) short-circuiting the FALLBACK-01 cascade when preflight confirms zero available slots, and (3) surfacing classified error details in the UNAVAIL result block of quorum-slot-dispatch.cjs.

Purpose: Eliminate wasteful dispatch to known-down slots and give operators a readable error type when a slot fails.
Output: Updated nf-prompt.js, quorum-slot-dispatch.cjs, synced dist, and new tests.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@hooks/nf-prompt.js
@bin/quorum-slot-dispatch.cjs
@bin/quorum-preflight.cjs
@bin/call-quorum-slot.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace triggerHealthProbe+getDownProviderSlots with preflight-based slot filtering and add all-down short-circuit in nf-prompt.js</name>
  <files>hooks/nf-prompt.js</files>
  <action>
In hooks/nf-prompt.js make the following changes:

1. REPLACE the `triggerHealthProbe()` function (lines ~166-172) and `getDownProviderSlots()` function (lines ~257-304) with a single new function `runPreflightFilter(slots)` that:
   - spawnSync `node [preflightPath] --all` with a 6000ms timeout (covers Layer 1 3s + Layer 2 5s probes with buffer)
   - Parse stdout as JSON; on any failure (non-zero exit, parse error, missing fields) fail-open and return `{ filteredSlots: slots, allDown: false }`
   - Extract `available_slots` array from the preflight JSON output
   - Filter the incoming `slots` array: keep slots where `s.slot` is in `available_slots`, OR where `s.slot` is NOT in the preflight output at all (i.e., not a probed slot — e.g., claude-* slots are not probed)
   - If ALL probed CLI slots are down AND no unprobed slots remain, set `allDown: true`
   - Return `{ filteredSlots, allDown, unavailableSlots }` where `unavailableSlots` is the `unavailable_slots` array from preflight output
   - Always use `resolveBin('quorum-preflight.cjs')` for the path; if not found, fail-open
   - Log to stderr: `[nf-dispatch] PREFLIGHT: available=[...], unavailable=[...]` with slot names

2. At the point where the code currently calls `triggerHealthProbe()` and `getDownProviderSlots()` (around lines 527-533):
   - Call `runPreflightFilter(orderedSlots)` instead
   - Use its `filteredSlots` as the replacement for the skip-filtered cappedSlots
   - Preserve the existing `recentTimeouts` / `getAvailableSlots` / `sortBySuccessRate` pipeline — preflight filtering is an ADDITIONAL filter applied BEFORE those
   - After calling `runPreflightFilter`, apply the remaining existing filters (recentTimeouts, scoreboard availability, sort by success rate) as before

3. SHORT-CIRCUIT: After `runPreflightFilter`, before the cache check and before building `cappedSlots`, check if `allDown === true` AND `orderedSlots.length > 0`. If so:
   - Build a short instructions string: `<!-- NF_ALL_SLOTS_DOWN -->\nAll quorum slots are currently unavailable (preflight probe failed for: ${unavailableSlots.map(u => u.name + ': ' + u.reason).join('; ')}). Proceeding without quorum — Claude's vote is the quorum. Write <!-- GSD_DECISION --> in your final output.`
   - Write the JSON output and call `process.exit(0)` immediately (same pattern as the solo-mode early exit)

DO NOT remove `getAvailableSlots()` or `sortBySuccessRate()` — those remain and are called after preflight filtering.
DO keep the SC-4 graceful fallback (restore at least one slot if all filtered) — it now runs after preflight filtering.
DO use fail-open for all preflight failures.
  </action>
  <verify>
node --test hooks/nf-prompt.test.js 2>&1 | tail -20
Also manually verify the function exists: grep -n 'runPreflightFilter\|NF_ALL_SLOTS_DOWN\|quorum-preflight' hooks/nf-prompt.js
  </verify>
  <done>
`runPreflightFilter` function present in hooks/nf-prompt.js; `triggerHealthProbe` and `getDownProviderSlots` functions removed; `NF_ALL_SLOTS_DOWN` short-circuit path present; existing tests still pass.
  </done>
</task>

<task type="auto">
  <name>Task 2: Enhance UNAVAIL result block in quorum-slot-dispatch.cjs with error_type and classified reasoning</name>
  <files>bin/quorum-slot-dispatch.cjs</files>
  <action>
In bin/quorum-slot-dispatch.cjs, around lines 1042-1055, update the UNAVAIL result block:

1. Add an inline `classifyDispatchError(output)` helper function near the top of the file (or near the UNAVAIL block) that mirrors the logic from call-quorum-slot.cjs's `classifyErrorType`:
   ```
   function classifyDispatchError(output) {
     if (/TIMEOUT/i.test(output)) return 'TIMEOUT';
     if (/401|403|unauthorized|forbidden/i.test(output)) return 'AUTH';
     if (/402|quota|rate.?limit/i.test(output)) return 'QUOTA';
     if (/spawn error/i.test(output)) return 'SPAWN_ERROR';
     if (/usage:|unknown flag|unknown option|invalid flag|unrecognized/i.test(output)) return 'CLI_SYNTAX';
     return 'UNKNOWN';
   }
   ```

2. In the `isUnavail` block (around line 1046-1055), replace:
   ```
   reasoning: 'Bash call failed or timed out.',
   ```
   with:
   ```
   reasoning: `UNAVAIL (${classifyDispatchError(output)}): ${output.slice(0, 200).replace(/\n/g, ' ')}`,
   ```

3. Add an `error_type` field to the `emitResultBlock` call:
   ```
   error_type: classifyDispatchError(output),
   ```
   Place it after the `isUnavail: true` field.

4. Also update `emitResultBlock` to include `error_type` in its output XML if provided. Find where `emitResultBlock` builds its output string and add:
   - If `opts.error_type` is present, emit `<error_type>${opts.error_type}</error_type>` in the result block XML, adjacent to the `<verdict>` field.

Verify `emitResultBlock` accepts and emits the new field without breaking existing callers (all other calls omit `error_type`, which is fine since it's optional).
  </action>
  <verify>
node --test bin/quorum-slot-dispatch.test.cjs 2>&1 | tail -20
grep -n 'classifyDispatchError\|error_type\|UNAVAIL (' bin/quorum-slot-dispatch.cjs | head -20
  </verify>
  <done>
`classifyDispatchError` function present; UNAVAIL reasoning includes classified error type and output excerpt; `error_type` field emitted in result XML; existing tests pass.
  </done>
</task>

<task type="auto">
  <name>Task 3: Add tests for new behavior and sync hook to dist + reinstall</name>
  <files>hooks/nf-prompt.test.js, bin/quorum-slot-dispatch.test.cjs, hooks/dist/nf-prompt.js</files>
  <action>
**Part A — nf-prompt.test.js tests:**

Add the following test cases to hooks/nf-prompt.test.js:

TC-PREFLIGHT-1: "runPreflightFilter: all-down short-circuit emits NF_ALL_SLOTS_DOWN"
- Set up a temp dir with a minimal nf.json (quorum_active: ['codex-1', 'gemini-1'], quorum_commands: ['/nf:plan-phase'])
- Mock the preflight by setting an env var that causes it to fail/timeout (or use a temp quorum-preflight.cjs stub that outputs `{"available_slots":[],"unavailable_slots":[{"name":"codex-1","reason":"layer1: binary not found"},{"name":"gemini-1","reason":"layer1: binary not found"}]}`)
- The test approach: since we can't easily stub modules, verify that when quorum-preflight.cjs is absent (resolveBin returns nonexistent path), the hook FAILS OPEN and still dispatches normally (not the short-circuit)
- Alternatively: test the short-circuit by checking that when `NF_ALL_SLOTS_DOWN` comment appears, exit code is 0 and stdout contains `NF_ALL_SLOTS_DOWN`

TC-PREFLIGHT-2: "runPreflightFilter fail-open: missing preflight script does not crash hook"
- Run hook with a prompt `/nf:plan-phase test`, cwd with nf.json that has quorum_active but no preflight script resolvable
- Expect: exit code 0, stdout contains additionalContext with slot dispatch instructions (fail-open)

**Part B — quorum-slot-dispatch.test.cjs tests:**

Add test cases for `classifyDispatchError` (unit test the helper directly if exported, or test via the UNAVAIL output block):

TC-DISPATCH-UNAVAIL-1: "UNAVAIL result includes error_type TIMEOUT when output contains TIMEOUT"
TC-DISPATCH-UNAVAIL-2: "UNAVAIL result includes error_type AUTH when output contains 401"
TC-DISPATCH-UNAVAIL-3: "UNAVAIL reasoning includes first 200 chars of output"

For these, find how existing tests invoke the dispatch function and add similar invocations with mock child process output containing TIMEOUT / 401 patterns.

**Part C — Sync and reinstall:**

Run:
```
cp hooks/nf-prompt.js hooks/dist/nf-prompt.js && node bin/install.js --claude --global
```

Verify the installed copy is updated:
```
grep -c 'runPreflightFilter\|NF_ALL_SLOTS_DOWN' ~/.claude/hooks/nf-prompt.js
```
  </action>
  <verify>
node --test hooks/nf-prompt.test.js 2>&1 | tail -20
node --test bin/quorum-slot-dispatch.test.cjs 2>&1 | tail -20
grep -c 'runPreflightFilter' ~/.claude/hooks/nf-prompt.js
  </verify>
  <done>
New test cases pass; installed hook at ~/.claude/hooks/nf-prompt.js contains `runPreflightFilter`; npm test suite passes with no regressions.
  </done>
</task>

</tasks>

<verification>
1. `node --test hooks/nf-prompt.test.js` — all existing + new tests pass
2. `node --test bin/quorum-slot-dispatch.test.cjs` — all existing + new tests pass
3. `grep -n 'triggerHealthProbe\|getDownProviderSlots' hooks/nf-prompt.js` — returns no matches (functions removed)
4. `grep -n 'runPreflightFilter\|NF_ALL_SLOTS_DOWN' hooks/nf-prompt.js` — returns matches
5. `grep -n 'classifyDispatchError\|error_type' bin/quorum-slot-dispatch.cjs` — returns matches
6. `grep -c 'runPreflightFilter' ~/.claude/hooks/nf-prompt.js` — returns non-zero (installed)
</verification>

<success_criteria>
- CLI-backed slots (codex-1, gemini-1, opencode-1, copilot-1) are filtered by quorum-preflight.cjs Layer 1+2 probe results before DISPATCH_LIST is built
- When preflight reports 0 available slots, the hook short-circuits with `<!-- NF_ALL_SLOTS_DOWN -->` instead of the full FALLBACK-01 cascade
- quorum-slot-dispatch.cjs UNAVAIL blocks include `error_type` field (TIMEOUT/AUTH/QUOTA/SPAWN_ERROR/UNKNOWN) and a 200-char output excerpt in reasoning
- All changes fail-open: preflight failures never block dispatch
- hooks/dist/nf-prompt.js synced and installed globally
</success_criteria>

<output>
After completion, create `.planning/quick/291-improve-quorum-dispatch-observability-an/291-SUMMARY.md`
</output>

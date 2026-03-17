---
phase: quick-315
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - hooks/nf-prompt.js
  - hooks/nf-prompt.test.js
  - hooks/dist/nf-prompt.js
autonomous: true
formal_artifacts: none
must_haves:
  truths:
    - "When all capped sub-type slots fail preflight, remaining T2 api slots are promoted and probed before exiting"
    - "allDown short-circuit only fires when ALL slots (including promoted T2) are unavailable"
    - "Promoted T2 slots appear in dispatch instructions when they pass preflight"
  artifacts:
    - path: "hooks/nf-prompt.js"
      provides: "T2 promotion logic in allDown branch"
      contains: "remaining slots"
    - path: "hooks/nf-prompt.test.js"
      provides: "TC-PROMPT-ALLDOWN-PROMOTES-T2 regression test"
      contains: "TC-PROMPT-ALLDOWN-PROMOTES-T2"
    - path: "hooks/dist/nf-prompt.js"
      provides: "Synced copy of nf-prompt.js for installer"
  key_links:
    - from: "hooks/nf-prompt.js allDown branch (line ~529)"
      to: "runPreflightFilter function (line ~171)"
      via: "second preflight call on promoted slots"
      pattern: "runPreflightFilter.*remaining"
---

<objective>
Fix the allDown short-circuit in nf-prompt.js that prematurely exits when sub-type primary slots fail preflight, without checking if T2 (api-type) slots from orderedSlots could serve as fallback primaries.

Purpose: Ensure quorum dispatch resilience — when sub-CLI slots are down, api-type slots get promoted and probed before giving up entirely.
Output: Patched nf-prompt.js with T2 promotion logic, regression test, synced dist copy.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@hooks/nf-prompt.js
@hooks/nf-prompt.test.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add T2 promotion logic to allDown branch and regression test</name>
  <files>hooks/nf-prompt.js, hooks/nf-prompt.test.js</files>
  <action>
In hooks/nf-prompt.js, replace the allDown short-circuit block (lines 527-539) with T2 promotion logic:

1. When `preflightResult.allDown && orderedSlots.length > 0`:
   - Compute `remainingSlots` = slots from `orderedSlots` that are NOT in the failed `cappedSlots` set (use slot name comparison). These are the overflow slots that were sliced off by `externalSlotCap`.
   - If `remainingSlots.length > 0`:
     - Slice remaining to `externalSlotCap` (promote up to the cap).
     - Call `runPreflightFilter(promotedSlots)` on them.
     - If the promoted preflight ALSO returns `allDown` (or `promotedSlots` filtered to empty), THEN emit the `NF_ALL_SLOTS_DOWN` message and `process.exit(0)` as before.
     - Otherwise, replace `cappedSlots` with the promoted filtered result and continue normal dispatch flow (do NOT exit). Log to stderr: `[nf-dispatch] ALLDOWN-PROMOTE: promoted ${promotedSlots.length} T2 slots after sub-type primaries failed preflight`.
   - If `remainingSlots.length === 0`: proceed with existing allDown exit behavior (no remaining slots to try).

2. Key constraint: the `cappedSlots` variable is `let`-declared (line 519), so reassignment is safe. The promoted slots replace the failed ones entirely — do not merge.

3. Keep the existing `preflightResult.unavailableSlots` data for the allDown message if we do exit.

In hooks/nf-prompt.test.js, add test `TC-PROMPT-ALLDOWN-PROMOTES-T2` after TC-PREFLIGHT-2:

The test must:
- Create a temp git dir with nf.json containing:
  - `quorum_active: ['codex-1', 'gemini-1', 'claude-1']`
  - `quorum: { maxSize: 4 }` (externalSlotCap=3, all 3 slots dispatched as cappedSlots)
  - `agent_config: { 'codex-1': { auth_type: 'sub' }, 'gemini-1': { auth_type: 'sub' }, 'claude-1': { auth_type: 'api' } }`
- BUT we need the sub slots to fail preflight while claude-1 (api) survives. Since we cannot mock preflight internals from outside, use this approach:
  - Set `quorum: { maxSize: 3 }` so externalSlotCap=2, cappedSlots=[codex-1, gemini-1] (sub-first ordering), leaving claude-1 in orderedSlots overflow.
  - Run with `NF_SKIP_PREFLIGHT: '0'` and `HOME` set to tempDir (no real CLIs → preflight will report codex-1 and gemini-1 as unavailable since their CLIs don't exist).
  - The allDown branch fires for cappedSlots, then must promote claude-1 from remaining.
  - claude-1 is api-type (no CLI probe needed, passes through preflight unconditionally per line 196).
  - Assert: output does NOT contain `NF_ALL_SLOTS_DOWN`.
  - Assert: output contains `QUORUM REQUIRED` (normal dispatch proceeded).
  - Assert: the additionalContext contains `claude-1` in a Task dispatch line.
  - Use 12000ms timeout (preflight needs 6s).

IMPORTANT: If preflight with isolated HOME causes codex-1/gemini-1 to fail-open instead of reporting down (because quorum-preflight.cjs binary is not found), then the test must account for this. Check stderr for `ALLDOWN-PROMOTE` to confirm the promotion path fired. If the preflight binary cannot be resolved from the temp HOME, the whole preflight returns fail-open (line 177 check). In that case, adjust the approach:
- Instead of relying on real preflight failure, create a mock `quorum-preflight.cjs` script in the temp dir's bin/ that outputs `{ "available_slots": [], "unavailable_slots": [{"name":"codex-1","reason":"down"},{"name":"gemini-1","reason":"down"}] }`. Set `NF_BIN_DIR` env var if the hook uses `resolveBin()` — check how `resolveBin` works and place the mock script where it will be found (likely needs `~/.claude/nf-bin/quorum-preflight.cjs` relative to HOME, or the project's `bin/` dir).
- Read `resolveBin` in nf-prompt.js to understand resolution order, then place mock accordingly.
  </action>
  <verify>
Run `node --test hooks/nf-prompt.test.js` — all existing tests pass and TC-PROMPT-ALLDOWN-PROMOTES-T2 passes.
Check stderr output of new test for `ALLDOWN-PROMOTE` log message confirming the promotion path executed.
  </verify>
  <done>
The allDown branch no longer short-circuits when orderedSlots contains remaining slots beyond the failed cappedSlots. T2 api-type slots get promoted and probed. Test TC-PROMPT-ALLDOWN-PROMOTES-T2 proves the behavior.
  </done>
</task>

<task type="auto">
  <name>Task 2: Sync to dist and install</name>
  <files>hooks/dist/nf-prompt.js</files>
  <action>
Copy the patched source to dist and run the installer:

```bash
cp hooks/nf-prompt.js hooks/dist/nf-prompt.js
node bin/install.js --claude --global
```

Verify the installed copy at `~/.claude/hooks/nf-prompt.js` contains the `ALLDOWN-PROMOTE` string.
  </action>
  <verify>
`grep 'ALLDOWN-PROMOTE' ~/.claude/hooks/nf-prompt.js` returns a match.
`grep 'ALLDOWN-PROMOTE' hooks/dist/nf-prompt.js` returns a match.
Run `node --test hooks/nf-prompt.test.js` one final time to confirm nothing broke.
  </verify>
  <done>
hooks/dist/nf-prompt.js is synced. Global installed copy at ~/.claude/hooks/ contains the fix. All tests pass.
  </done>
</task>

</tasks>

<verification>
- `node --test hooks/nf-prompt.test.js` — all tests pass including TC-PROMPT-ALLDOWN-PROMOTES-T2
- `grep 'ALLDOWN-PROMOTE' hooks/nf-prompt.js` — promotion log exists in source
- `diff hooks/nf-prompt.js hooks/dist/nf-prompt.js` — no diff (synced)
- `grep 'ALLDOWN-PROMOTE' ~/.claude/hooks/nf-prompt.js` — installed copy has the fix
</verification>

<success_criteria>
1. When sub-type primary slots all fail preflight but api-type slots remain in orderedSlots, the hook promotes api slots and continues dispatch instead of exiting
2. When ALL slots (including promoted) fail, the allDown exit still fires correctly
3. TC-PROMPT-ALLDOWN-PROMOTES-T2 regression test passes
4. All existing tests continue to pass (no regressions)
5. dist/ and installed copies are synced
</success_criteria>

<output>
After completion, create `.planning/quick/315-fix-alldown-short-circuit-to-promote-t2-/315-SUMMARY.md`
</output>

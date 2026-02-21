---
phase: quick-31
plan: 31
type: execute
wave: 1
depends_on: []
files_modified:
  - get-shit-done/workflows/execute-phase.md
autonomous: true
requirements: [QUICK-31]

must_haves:
  truths:
    - "After an auto-spawned quick task completes, the orchestrator re-runs quorum-test on the fixed plan before resuming"
    - "If quorum-test still fails after the fix, no second quick task is spawned — the user is asked instead"
    - "If quorum-test passes after the fix, phase execution resumes normally"
  artifacts:
    - path: "get-shit-done/workflows/execute-phase.md"
      provides: "Post-fix verification (cap: 1 retry) instructions replacing the vague resume line"
      contains: "Post-fix verification (cap: 1 retry)"
    - path: "~/.claude/qgsd/workflows/execute-phase.md"
      provides: "Installed copy matches source (disk-only)"
      contains: "Post-fix verification (cap: 1 retry)"
  key_links:
    - from: "auto-spawn quick task mechanism"
      to: "/qgsd:quorum-test re-run"
      via: "explicit 3-step post-fix verification block"
      pattern: "Post-fix verification"
---

<objective>
Replace the vague "Then resume phase execution from the failed plan." line in execute-phase.md with a concrete 3-step post-fix verification block that re-runs quorum-test, marks the plan complete on PASS, and asks the user on a second BLOCK (cap: 1 retry).

Purpose: Prevent infinite auto-spawn loops and guarantee CI is actually fixed before the orchestrator moves on.
Output: Updated execute-phase.md in source (committed) and installed copy (disk-only).
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
  <name>Task 1: Replace vague resume line with post-fix verification block in source execute-phase.md</name>
  <files>get-shit-done/workflows/execute-phase.md</files>
  <action>
In `get-shit-done/workflows/execute-phase.md`, find lines 201-202 (the end of the Auto-spawn quick task mechanism section):

```
   After executor completes, update STATE.md quick tasks table and commit (same as quick.md Steps 7-8).
   Then resume phase execution from the failed plan.
```

Replace those two lines with this expanded version (preserving the 3-space indent of the surrounding block):

```
   After executor completes, update STATE.md quick tasks table and commit (same as quick.md Steps 7-8).

   **Post-fix verification (cap: 1 retry):**
   1. Re-run `/qgsd:quorum-test` on the same plan to confirm CI now passes.
   2. If quorum-test PASS → mark plan complete, continue to next wave/phase normally.
   3. If quorum-test BLOCK again → do NOT auto-spawn another quick task. Ask user: "CI still failing after fix. Review and retry manually?"
```

Do not alter any other lines in the file.
  </action>
  <verify>
Run: grep -n "Post-fix verification" /Users/jonathanborduas/code/QGSD/get-shit-done/workflows/execute-phase.md
Expected: line found with "(cap: 1 retry)"

Also confirm the old line is gone:
grep -n "Then resume phase execution from the failed plan" /Users/jonathanborduas/code/QGSD/get-shit-done/workflows/execute-phase.md
Expected: no output (line removed).
  </verify>
  <done>Source file contains the 3-step post-fix verification block; vague resume line is absent.</done>
</task>

<task type="auto">
  <name>Task 2: Mirror the same change to installed copy (disk-only)</name>
  <files>~/.claude/qgsd/workflows/execute-phase.md</files>
  <action>
Apply the identical replacement to `~/.claude/qgsd/workflows/execute-phase.md`.

Find lines 201-202 (same position as source):

```
   After executor completes, update STATE.md quick tasks table and commit (same as quick.md Steps 7-8).
   Then resume phase execution from the failed plan.
```

Replace with:

```
   After executor completes, update STATE.md quick tasks table and commit (same as quick.md Steps 7-8).

   **Post-fix verification (cap: 1 retry):**
   1. Re-run `/qgsd:quorum-test` on the same plan to confirm CI now passes.
   2. If quorum-test PASS → mark plan complete, continue to next wave/phase normally.
   3. If quorum-test BLOCK again → do NOT auto-spawn another quick task. Ask user: "CI still failing after fix. Review and retry manually?"
```

This file is outside the git repo — disk-only update, no git staging.
  </action>
  <verify>
Run: grep -n "Post-fix verification" ~/.claude/qgsd/workflows/execute-phase.md
Expected: line found with "(cap: 1 retry)"

Run: grep -n "Then resume phase execution from the failed plan" ~/.claude/qgsd/workflows/execute-phase.md
Expected: no output.

Confirm files are in sync:
diff /Users/jonathanborduas/code/QGSD/get-shit-done/workflows/execute-phase.md ~/.claude/qgsd/workflows/execute-phase.md
Expected: no diff output.
  </verify>
  <done>Installed copy matches source. Both files contain the post-fix verification block; vague line is absent in both.</done>
</task>

</tasks>

<verification>
1. grep "Post-fix verification (cap: 1 retry)" get-shit-done/workflows/execute-phase.md — must return a match
2. grep "Post-fix verification (cap: 1 retry)" ~/.claude/qgsd/workflows/execute-phase.md — must return a match
3. diff get-shit-done/workflows/execute-phase.md ~/.claude/qgsd/workflows/execute-phase.md — must produce no output
4. grep "Then resume phase execution from the failed plan" get-shit-done/workflows/execute-phase.md — must produce no output
</verification>

<success_criteria>
- Source and installed execute-phase.md both contain the 3-step post-fix verification block
- The vague "Then resume phase execution from the failed plan." line is removed from both files
- No other lines in either file were changed
- Source change is committed to git; installed copy is disk-only (not staged)
</success_criteria>

<output>
After completion, create `.planning/quick/31-tighten-execute-phase-auto-spawn-resume-/31-SUMMARY.md` and update `.planning/STATE.md` quick tasks table with quick-31.
</output>

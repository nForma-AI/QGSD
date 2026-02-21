---
phase: quick-12
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - commands/qgsd/debug.md
  - /Users/jonathanborduas/.claude/commands/qgsd/debug.md
autonomous: true
requirements: [QUICK-12]

must_haves:
  truths:
    - "When quorum reaches consensus, Claude executes the next step immediately without asking user permission"
    - "After executing the consensus step, Claude displays what was done and a continuation banner"
    - "When quorum has no consensus, Claude displays all recommendations and an instructional banner for the user to choose"
    - "Both copies of debug.md (repo and ~/.claude) are byte-for-byte identical after the change"
  artifacts:
    - path: "commands/qgsd/debug.md"
      provides: "Updated Step 7 with autonomous execution branch"
      contains: "Execute the consensus next step autonomously"
    - path: "/Users/jonathanborduas/.claude/commands/qgsd/debug.md"
      provides: "Sync copy of updated debug.md"
      contains: "Execute the consensus next step autonomously"
  key_links:
    - from: "Step 4 consensus determination"
      to: "Step 7 execution branch"
      via: "IF consensus was reached / IF no consensus conditional"
      pattern: "IF consensus was reached"
---

<objective>
Fix /qgsd:debug Step 7 to auto-execute the consensus next step when quorum agrees, instead of instructing the user to apply it manually (which causes Claude to add a conversational permission gate on top of the instruction).

Purpose: Remove the user gate that was never intended to be there. When quorum reaches consensus, Claude should act, not ask.
Output: Both debug.md files updated with an IF/ELSE Step 7 that executes autonomously on consensus and falls back to the instructional banner only when there is no consensus.
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
  <name>Task 1: Rewrite Step 7 in commands/qgsd/debug.md</name>
  <files>commands/qgsd/debug.md</files>
  <action>
Replace the entire **Step 7** section (lines 166–174) with the following content. Keep everything above (Steps 1–6) and the closing `</process>` tag exactly as they are. Only Step 7 changes.

The new Step 7 text:

```
**Step 7: Execute or escalate**

IF consensus was reached (Step 4):
  Execute the consensus next step autonomously using available tools (Bash, Read, Grep, etc.)
  Display what was done.
  Then display:
  ```
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Consensus step executed. Run /qgsd:debug again to continue.
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ```

IF no consensus:
  Display:
  ```
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  No consensus — review recommendations above and apply the most relevant step.
  Then run /qgsd:debug again with updated output.
  To start a full autonomous debug session: /gsd:debug [description]
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ```
```

Do NOT add any "Want me to..." language or any other user-permission gates anywhere in the file.
  </action>
  <verify>
Run: grep -n "Execute the consensus next step autonomously" /Users/jonathanborduas/code/QGSD/commands/qgsd/debug.md
Expected: one matching line.
Also verify the old gate text is gone: grep -c "Apply the consensus next step" /Users/jonathanborduas/code/QGSD/commands/qgsd/debug.md
Expected: 0
  </verify>
  <done>commands/qgsd/debug.md Step 7 contains the IF/ELSE autonomous execution branch. The old single-branch "Apply the consensus next step" banner is replaced. No user-permission language anywhere in Step 7.</done>
</task>

<task type="auto">
  <name>Task 2: Sync updated debug.md to ~/.claude/commands/qgsd/debug.md</name>
  <files>/Users/jonathanborduas/.claude/commands/qgsd/debug.md</files>
  <action>
Copy the updated file from the repo to the global commands directory so the two copies are identical:

```bash
cp /Users/jonathanborduas/code/QGSD/commands/qgsd/debug.md /Users/jonathanborduas/.claude/commands/qgsd/debug.md
```

Then verify the diff is empty:
```bash
diff /Users/jonathanborduas/code/QGSD/commands/qgsd/debug.md /Users/jonathanborduas/.claude/commands/qgsd/debug.md
```

If diff reports any differences, fix them before proceeding.
  </action>
  <verify>
diff /Users/jonathanborduas/code/QGSD/commands/qgsd/debug.md /Users/jonathanborduas/.claude/commands/qgsd/debug.md
Expected: no output (files identical).
Also: grep -n "Execute the consensus next step autonomously" /Users/jonathanborduas/.claude/commands/qgsd/debug.md
Expected: one matching line.
  </verify>
  <done>~/.claude/commands/qgsd/debug.md is byte-for-byte identical to the repo copy. Both files contain the autonomous execution branch in Step 7.</done>
</task>

</tasks>

<verification>
After both tasks complete:
1. grep -c "Apply the consensus next step" /Users/jonathanborduas/code/QGSD/commands/qgsd/debug.md → 0
2. grep -c "Execute the consensus next step autonomously" /Users/jonathanborduas/code/QGSD/commands/qgsd/debug.md → 1
3. diff /Users/jonathanborduas/code/QGSD/commands/qgsd/debug.md /Users/jonathanborduas/.claude/commands/qgsd/debug.md → empty (files identical)
4. The file still has Steps 1–6 and the closing </process> tag intact
</verification>

<success_criteria>
- When /qgsd:debug finds consensus, Claude executes the step immediately (no "Want me to..." gate)
- When /qgsd:debug finds no consensus, the instructional banner is shown for the user to choose
- Both debug.md copies are identical
- Repo state is committed
</success_criteria>

<output>
After completion, create `.planning/quick/12-fix-qgsd-debug-to-auto-proceed-when-quor/12-SUMMARY.md`
</output>

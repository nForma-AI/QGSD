---
phase: quick-64
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - commands/qgsd/debug.md
autonomous: true
requirements: [SCBD-01, SCBD-02, SCBD-03]
must_haves:
  truths:
    - "Orchestrator Mode A scoreboard block instructs --slot <slot_name> + --model-id <full_model_id> for claude-mcp servers"
    - "Orchestrator Mode A still instructs --model <model_name> for native CLI agents (claude, gemini, opencode, copilot, codex)"
    - "The orchestrator text no longer describes the deprecated 'derive key from health_check model field' pattern for claude-mcp servers"
    - "Installed ~/.claude/agents/qgsd-quorum-orchestrator.md reflects the fix (install sync completed)"
  artifacts:
    - path: "agents/qgsd-quorum-orchestrator.md"
      provides: "Corrected Mode A scoreboard update block"
      contains: "--slot"
    - path: "~/.claude/agents/qgsd-quorum-orchestrator.md"
      provides: "Installed copy of corrected orchestrator"
      contains: "--slot"
  key_links:
    - from: "agents/qgsd-quorum-orchestrator.md Mode A scoreboard block"
      to: "bin/update-scoreboard.cjs --slot path"
      via: "--slot <slot_name> --model-id <model_id>"
      pattern: "--slot"
---

<objective>
Commit the already-applied backtick cleanup in commands/qgsd/debug.md, then run install sync to propagate the previously-committed orchestrator fix to the installed copy.

Purpose: SCBD-01/02/03 require that the scoreboard writes to data.slots{} using composite key <slot>:<model-id>. The orchestrator fix was already committed at HEAD (agents/qgsd-quorum-orchestrator.md now contains the two-case --slot/--model-id block). This plan finalises the remaining work: commit the pending debug.md cleanup and sync the installed copy.

Output: debug.md cleanup committed + ~/.claude/agents/qgsd-quorum-orchestrator.md updated with the fix.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/v0.7-MILESTONE-AUDIT.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Commit debug.md backtick cleanup</name>
  <files>
    commands/qgsd/debug.md
  </files>
  <action>
commands/qgsd/debug.md has uncommitted backtick cleanup changes (trivial formatting — removing backtick wrapping from $ARGUMENTS references). Stage and commit only this file.

IMPORTANT: Do NOT stage any other modified files (.planning/config.json, get-shit-done/bin/gsd-tools.cjs, get-shit-done/workflows/fix-tests.md). Stage only commands/qgsd/debug.md.

```bash
git add /Users/jonathanborduas/code/QGSD/commands/qgsd/debug.md
git commit -m "fix(quick-64): remove backtick wrapping from \$ARGUMENTS in debug.md"
```
  </action>
  <verify>
1. git diff --name-only HEAD~1 HEAD -- shows commands/qgsd/debug.md
2. git status --short -- commands/qgsd/debug.md returns empty (file is clean)
  </verify>
  <done>
- commands/qgsd/debug.md backtick cleanup is committed
- No other unrelated files were swept into the commit
  </done>
</task>

<task type="auto">
  <name>Task 2: Install sync</name>
  <files>
    ~/.claude/agents/qgsd-quorum-orchestrator.md
  </files>
  <action>
Run the install sync to propagate the already-committed orchestrator fix to the installed copy:

```bash
node /Users/jonathanborduas/code/QGSD/bin/install.js --claude --global
```

This copies agents/qgsd-quorum-orchestrator.md → ~/.claude/agents/qgsd-quorum-orchestrator.md (and all other QGSD files). No git commit needed for installed files (gitignored from ~/.claude).
  </action>
  <verify>
grep -n "\-\-slot" /Users/jonathanborduas/.claude/agents/qgsd-quorum-orchestrator.md — must show the --slot line in the scoreboard block
  </verify>
  <done>
~/.claude/agents/qgsd-quorum-orchestrator.md contains the corrected two-case scoreboard block with --slot + --model-id for claude-mcp servers.
  </done>
</task>

</tasks>

<verification>
After both tasks:
1. grep -n "\-\-slot" /Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-orchestrator.md — hits in Mode A scoreboard block
2. grep -n "\-\-slot" /Users/jonathanborduas/.claude/agents/qgsd-quorum-orchestrator.md — same hits in installed copy
3. grep -n "derive the key" /Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-orchestrator.md — no results
4. git status --short shows commands/qgsd/debug.md is clean
</verification>

<success_criteria>
- Orchestrator Mode A scoreboard block instructs --slot + --model-id for claude-mcp servers (already committed)
- Orchestrator Mode A still instructs --model for native CLI agents (already committed)
- Deprecated "derive key from health_check model field" language is removed from the orchestrator (already committed)
- Installed ~/.claude/agents/qgsd-quorum-orchestrator.md reflects the fix
- Backtick cleanup change in debug.md is committed
- SCBD-01, SCBD-02, SCBD-03 now fully satisfied: the primary execution path (Mode A) writes to data.slots{} via the composite key <slot>:<model-id>
</success_criteria>

<output>
After completion, create .planning/quick/64-fix-scbd-01-02-03-propagate-int-04-slot-/64-SUMMARY.md
</output>

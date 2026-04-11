---
phase: quick-384
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - commands/nf/mcp-repair.md
autonomous: true
requirements: [INTENT-01]
formal_artifacts: none

must_haves:
  truths:
    - "nf:mcp-repair calls MCP identity/health_check/deep_health_check tools directly in the orchestrator (no Task() sub-agent wrapper)"
    - "Step 1 calls all 30 MCP tools inline and assembles $BEFORE_STATE in the orchestrator"
    - "Step 4 service auto-start verification calls deep_health_check directly (no Task() sub-agent)"
    - "Step 6 post-repair verification calls identity/health_check/deep_health_check directly on repaired slots (no Task() sub-agent)"
    - "The allowed-tools frontmatter list is unchanged (MCP tools remain listed there)"
    - "The success_criteria line 'Task() sub-agent pattern used for MCP tool calls' is removed or corrected"
  artifacts:
    - path: "commands/nf/mcp-repair.md"
      provides: "Updated skill with direct MCP tool call instructions"
      contains: "Call mcp__codex-1__identity directly"
  key_links:
    - from: "Step 1 process text"
      to: "mcp__*__identity / mcp__*__health_check / mcp__*__deep_health_check"
      via: "direct orchestrator tool calls (no Task wrapper)"
      pattern: "Call mcp__"
---

<objective>
Remove all Task() sub-agent wrappers from nf:mcp-repair that are used to invoke MCP tools, replacing them with direct orchestrator tool calls.

Purpose: Sub-agents spawned via the Agent/Task tool do not inherit the parent session's MCP servers. Every mcp__*__identity, mcp__*__health_check, and mcp__*__deep_health_check call issued inside a Task() silently fails. The fix is to issue these calls directly in the main conversation where MCP servers are accessible.

Output: commands/nf/mcp-repair.md with all three Task() sub-agent call sites replaced by inline direct-call instructions.
</objective>

<execution_context>
@./.claude/nf/workflows/execute-plan.md
@./.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@commands/nf/mcp-repair.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace Task() sub-agent MCP calls with direct orchestrator calls</name>
  <files>commands/nf/mcp-repair.md</files>
  <action>
There are three Task() sub-agent call sites in mcp-repair.md that invoke MCP tools. Replace all three with inline direct-call instructions. Do NOT change any other logic — bash scripts, classification tables, display tables, step numbering, or the allowed-tools frontmatter are all unchanged.

**Site 1 — Step 1 (lines ~83–144): Initial before-state collection**

Remove the entire Task() block and the "Store the sub-agent's returned JSON object as `$BEFORE_STATE`" line that follows it.

Replace with inline instructions:

```
Call each of the following MCP tools directly in the orchestrator, one at a time, sequentially. Wrap each call in try/catch mentally — if a tool is unavailable or throws, record null for that slot/field. Assemble the results into `$BEFORE_STATE` as you go.

Call in this order:
1.  mcp__codex-1__identity({})          → codex_id
2.  mcp__gemini-1__identity({})         → gemini_id
3.  mcp__opencode-1__identity({})       → opencode_id
4.  mcp__copilot-1__identity({})        → copilot_id
5.  mcp__codex-1__health_check({})      → codex_hc
6.  mcp__gemini-1__health_check({})     → gemini_hc
7.  mcp__opencode-1__health_check({})   → opencode_hc
8.  mcp__copilot-1__health_check({})    → copilot_hc
9.  mcp__claude-1__identity({})         → claude1_id
10. mcp__claude-1__health_check({})     → claude1_hc
11. mcp__claude-2__identity({})         → claude2_id
12. mcp__claude-2__health_check({})     → claude2_hc
13. mcp__claude-3__identity({})         → claude3_id
14. mcp__claude-3__health_check({})     → claude3_hc
15. mcp__claude-4__identity({})         → claude4_id
16. mcp__claude-4__health_check({})     → claude4_hc
17. mcp__claude-5__identity({})         → claude5_id
18. mcp__claude-5__health_check({})     → claude5_hc
19. mcp__claude-6__identity({})         → claude6_id
20. mcp__claude-6__health_check({})     → claude6_hc
21. mcp__codex-1__deep_health_check({})    → codex_1_deep
22. mcp__gemini-1__deep_health_check({})   → gemini_1_deep
23. mcp__opencode-1__deep_health_check({}) → opencode_1_deep
24. mcp__copilot-1__deep_health_check({})  → copilot_1_deep
25. mcp__claude-1__deep_health_check({})   → claude_1_deep
26. mcp__claude-2__deep_health_check({})   → claude_2_deep
27. mcp__claude-3__deep_health_check({})   → claude_3_deep
28. mcp__claude-4__deep_health_check({})   → claude_4_deep
29. mcp__claude-5__deep_health_check({})   → claude_5_deep
30. mcp__claude-6__deep_health_check({})   → claude_6_deep

Assemble `$BEFORE_STATE` as a JSON object with this structure:
{
  "codex-1":    { "identity": <codex_id or null>,    "hc": <codex_hc or null>,    "deep": <codex_1_deep or null> },
  "gemini-1":   { "identity": <gemini_id or null>,   "hc": <gemini_hc or null>,   "deep": <gemini_1_deep or null> },
  "opencode-1": { "identity": <opencode_id or null>, "hc": <opencode_hc or null>, "deep": <opencode_1_deep or null> },
  "copilot-1":  { "identity": <copilot_id or null>,  "hc": <copilot_hc or null>,  "deep": <copilot_1_deep or null> },
  "claude-1":   { "identity": <claude1_id or null>,  "hc": <claude1_hc or null>,  "deep": <claude_1_deep or null> },
  "claude-2":   { "identity": <claude2_id or null>,  "hc": <claude2_hc or null>,  "deep": <claude_2_deep or null> },
  "claude-3":   { "identity": <claude3_id or null>,  "hc": <claude3_hc or null>,  "deep": <claude_3_deep or null> },
  "claude-4":   { "identity": <claude4_id or null>,  "hc": <claude4_hc or null>,  "deep": <claude_4_deep or null> },
  "claude-5":   { "identity": <claude5_id or null>,  "hc": <claude5_hc or null>,  "deep": <claude_5_deep or null> },
  "claude-6":   { "identity": <claude6_id or null>,  "hc": <claude6_hc or null>,  "deep": <claude_6_deep or null> }
}

Store this as `$BEFORE_STATE`.
```

**Site 2 — Step 4 (lines ~305–316): Service auto-start deep_health_check re-verify**

Remove the Task() block used for post-restart deep_health_check verification:
```
Task(
  subagent_type: "general-purpose",
  model: "claude-haiku-4-5",
  prompt: """
Call mcp__<slot>__deep_health_check({}) and return the raw result JSON.
"""
)
```

Replace with:
```
Call mcp__<slot>__deep_health_check({}) directly and record the result.
```

**Site 3 — Step 6 (lines ~406–409): Post-repair after-state collection**

Remove the Task() sub-agent description entirely.

Replace:
```
If any auto-repairs were attempted in Step 4, re-run identity + health_check + deep_health_check on ONLY the repaired slots using a Task() sub-agent (same pattern as Step 1, but listing only the repaired slot tools).
```

With:
```
If any auto-repairs were attempted in Step 4, call identity, health_check, and deep_health_check directly on ONLY the repaired slots (same sequential direct-call pattern as Step 1). Assemble results into `$AFTER_STATE` using the same JSON structure as `$BEFORE_STATE` but only for repaired slots.
```

**Also fix success_criteria:** Remove the line:
```
- Task() sub-agent pattern used for MCP tool calls (keeps raw output out of conversation)
```

And replace with:
```
- MCP tool calls issued directly in the orchestrator (not via Task() sub-agents, which lack MCP server access)
```

**Also remove Task from allowed-tools frontmatter** since it is no longer needed for MCP collection. Remove `- Task` from the `allowed-tools:` list in the YAML frontmatter.
  </action>
  <verify>
1. `grep -n "Task(" commands/nf/mcp-repair.md` returns no results (all Task() sub-agent blocks removed).
2. `grep -n "sub-agent" commands/nf/mcp-repair.md` returns no results referencing the old pattern.
3. `grep -c "mcp__.*__identity" commands/nf/mcp-repair.md` returns a count >= 10 (all direct call references present).
4. `grep -n "^  - Task$" commands/nf/mcp-repair.md` returns no results (Task removed from allowed-tools).
5. The file still contains "Step 1", "Step 2", "Step 3", "Step 4", "Step 5", "Step 6", "Step 7" headings.
  </verify>
  <done>
commands/nf/mcp-repair.md contains no Task() sub-agent wrappers for MCP calls. All identity, health_check, and deep_health_check calls are issued directly in the orchestrator. The allowed-tools list no longer includes Task. The success_criteria accurately reflects the direct-call pattern.
  </done>
</task>

</tasks>

<verification>
After the task completes:
- `grep "Task(" commands/nf/mcp-repair.md` — should return empty
- `grep "subagent_type" commands/nf/mcp-repair.md` — should return empty
- `grep "mcp__claude-1__identity" commands/nf/mcp-repair.md` — should return a result showing direct call
- `grep "mcp__codex-1__deep_health_check" commands/nf/mcp-repair.md` — should return a result
- YAML frontmatter `allowed-tools:` should not contain `- Task`
</verification>

<success_criteria>
- commands/nf/mcp-repair.md has zero Task() sub-agent call sites for MCP tools
- All 30 MCP tool calls (identity, health_check, deep_health_check x 10 slots) are specified as direct orchestrator calls in Step 1
- Step 4 deep_health_check re-verify uses direct call
- Step 6 post-repair uses direct call pattern
- Task removed from allowed-tools frontmatter
- success_criteria updated to reflect direct-call approach
</success_criteria>

<output>
After completion, create `.planning/quick/384-fix-nf-mcp-repair-to-call-mcp-tools-dire/384-SUMMARY.md` with:
- What changed (sites modified, approach)
- Verification results
- Commit hash
</output>

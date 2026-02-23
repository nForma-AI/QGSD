---
phase: quick-73
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - commands/qgsd/mcp-status.md
autonomous: true
requirements: []
must_haves:
  truths:
    - "For claude-1 through claude-6, the Health column shows a live result from health_check (healthy/unhealthy/error), not a guess derived from UNAVAIL counts"
    - "Latency (ms) from health_check is visible in the table for claude-N agents"
    - "CLI agents (codex-cli-1, gemini-cli-1, opencode-1, copilot-1) still derive health from scoreboard UNAVAIL counts (no health_check available)"
    - "A failed health_check call (timeout/error) shows health=error for that agent without aborting the loop"
    - "Both source (commands/qgsd/mcp-status.md) and installed (~/.claude/commands/qgsd/mcp-status.md) are updated"
  artifacts:
    - path: "commands/qgsd/mcp-status.md"
      provides: "Updated mcp-status command with health_check integration"
      contains: "health_check"
    - path: "/Users/jonathanborduas/.claude/commands/qgsd/mcp-status.md"
      provides: "Installed copy of updated command"
      contains: "health_check"
  key_links:
    - from: "mcp-status.md Step 3"
      to: "mcp__claude-N__health_check"
      via: "sequential tool calls after identity"
      pattern: "health_check"
    - from: "mcp-status.md Step 4"
      to: "health derivation logic"
      via: "branch on agent type (claude-N vs cli)"
      pattern: "healthy.*latencyMs"
---

<objective>
Extend /qgsd:mcp-status so that for claude-1 through claude-6 agents, it calls the `health_check` tool after `identity` to get a live `{ healthy, latencyMs, model }` response from the actual HTTP API endpoint. The Health column for these agents becomes a real-time reading, not a guess from historical UNAVAIL counts. CLI agents remain scoreboard-only.

Purpose: Users can see whether each claude-mcp-server instance is actually reachable right now, not just whether it has historically failed.
Output: Updated mcp-status.md in both source and installed locations.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/jonathanborduas/code/QGSD/commands/qgsd/mcp-status.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add health_check integration to mcp-status.md source</name>
  <files>commands/qgsd/mcp-status.md</files>
  <action>
Rewrite commands/qgsd/mcp-status.md with the following changes (preserve all unchanged sections exactly):

**1. allowed-tools frontmatter** — add health_check tools for claude-1 through claude-6:
```yaml
  - mcp__claude-1__health_check
  - mcp__claude-2__health_check
  - mcp__claude-3__health_check
  - mcp__claude-4__health_check
  - mcp__claude-5__health_check
  - mcp__claude-6__health_check
```
Append these after the existing `mcp__claude-6__identity` line.

**2. Agent table** — add a `Has health_check` column to the agent list (informational, helps executor know which to call):

| Display Name    | Identity Tool                   | health_check Tool                | Scoreboard Key |
|---|---|---|---|
| codex-cli-1     | mcp__codex-cli-1__identity      | — (none)                         | codex          |
| gemini-cli-1    | mcp__gemini-cli-1__identity     | — (none)                         | gemini         |
| opencode-1      | mcp__opencode-1__identity       | — (none)                         | opencode       |
| copilot-1       | mcp__copilot-1__identity        | — (none)                         | copilot        |
| claude-1        | mcp__claude-1__identity         | mcp__claude-1__health_check      | deepseek       |
| claude-2        | mcp__claude-2__identity         | mcp__claude-2__health_check      | minimax        |
| claude-3        | mcp__claude-3__identity         | mcp__claude-3__health_check      | qwen-coder     |
| claude-4        | mcp__claude-4__identity         | mcp__claude-4__health_check      | kimi           |
| claude-5        | mcp__claude-5__identity         | mcp__claude-5__health_check      | llama4         |
| claude-6        | mcp__claude-6__identity         | mcp__claude-6__health_check      | glm            |

**3. Step 3 — after calling identity for a claude-N agent**, also call its `health_check` tool with `{}` as input (wrapped in try/catch). Store the result as `hc`. Extract `hc.healthy` (boolean), `hc.latencyMs` (number), `hc.model` (string, can be used to confirm model). On error, set `hc = null`.

For CLI agents (codex-cli-1, gemini-cli-1, opencode-1, copilot-1), do NOT call health_check — there is no such tool for them.

**4. Step 4 — health derivation logic**: Replace the current single-path logic with two paths:

For CLI agents (codex-cli-1, gemini-cli-1, opencode-1, copilot-1) — existing behavior unchanged:
- If identity threw → health = `error`
- Else if counts[scoreboardKey] > 0 → health = `quota-exceeded`
- Else → health = `available`

For HTTP agents (claude-1 through claude-6) — new live path:
- If identity threw → health = `error`, latency = `—`
- Else if hc is null (health_check threw/timed out) → health = `unreachable`, latency = `—`
- Else if hc.healthy === false → health = `unhealthy`, latency = `${hc.latencyMs}ms`
- Else → health = `available`, latency = `${hc.latencyMs}ms`
Note: UNAVAIL count from scoreboard is still shown in the UNAVAIL column for context, but no longer drives the health field for claude-N agents.

**5. Step 5 — table columns**: Add a `Latency` column for the HTTP agents. CLI agents show `—` in this column. Updated columns: Agent | Version | Model | Health | Latency | Available Models | UNAVAIL

Update the example table to show the new Latency column:
```
┌─────────────────────┬─────────┬──────────────────────────┬─────────────┬─────────┬───────────────────────────────┬─────────┐
│ Agent               │ Version │ Model                    │ Health      │ Latency │ Available Models              │ UNAVAIL │
├─────────────────────┼─────────┼──────────────────────────┼─────────────┼─────────┼───────────────────────────────┼─────────┤
│ codex-cli-1         │ 1.2.3   │ codex                    │ quota-excee │ —       │ codex, o3-mini, gpt-4o, ...   │ 56      │
│ gemini-cli-1        │ 1.1.0   │ gemini-3-pro-preview     │ quota-excee │ —       │ gemini-3-pro, flash, ...      │ 34      │
│ opencode-1          │ 1.0.0   │ claude-sonnet-4-6        │ available   │ —       │ claude-sonnet-4-6, gpt-4o     │ 4       │
│ copilot-1           │ 1.2.0   │ gpt-4.1                  │ available   │ —       │ gpt-4.1, gpt-4o, claude-3.5   │ 0       │
│ claude-1            │ 1.0.0   │ deepseek-ai/DeepSeek-V3  │ available   │ 312ms   │ —                             │ 0       │
│ claude-2            │ 1.0.0   │ MiniMaxAI/MiniMax-M2.5   │ available   │ 480ms   │ —                             │ 0       │
│ claude-3            │ 1.0.0   │ Qwen/Qwen3-Coder-480B    │ unhealthy   │ 9800ms  │ —                             │ 3       │
│ claude-4            │ 1.0.0   │ kimi                     │ available   │ 220ms   │ —                             │ 0       │
│ claude-5            │ 1.0.0   │ meta-llama/Llama-4-M     │ unreachable │ —       │ —                             │ 1       │
│ claude-6            │ 1.0.0   │ glm-5                    │ available   │ 670ms   │ —                             │ 0       │
└─────────────────────┴─────────┴──────────────────────────┴─────────────┴─────────┴───────────────────────────────┴─────────┘
```

**6. success_criteria** — update to mention:
- Health for claude-1..6 is live from health_check (not from UNAVAIL count)
- Latency column shows ms for claude-N agents, `—` for CLI agents
- `unreachable` state shown when health_check call itself fails
- `unhealthy` state shown when health_check returns `healthy: false`
  </action>
  <verify>
grep -c "health_check" /Users/jonathanborduas/code/QGSD/commands/qgsd/mcp-status.md
# Should be >= 8 (6 allowed-tools entries + table entries + prose references)

grep "unreachable\|unhealthy\|latencyMs\|Latency" /Users/jonathanborduas/code/QGSD/commands/qgsd/mcp-status.md
# Should show multiple matches confirming all four new concepts are present

grep "mcp__claude-1__health_check" /Users/jonathanborduas/code/QGSD/commands/qgsd/mcp-status.md
# Should match at least once (allowed-tools entry)
  </verify>
  <done>
Source file updated with: 6 health_check entries in allowed-tools, updated agent table with health_check tool column, Step 3 calls health_check for claude-N agents, Step 4 uses two-path health derivation (CLI=scoreboard, claude-N=live), Step 5 table includes Latency column, success_criteria updated.
  </done>
</task>

<task type="auto">
  <name>Task 2: Sync updated command to installed location</name>
  <files>/Users/jonathanborduas/.claude/commands/qgsd/mcp-status.md</files>
  <action>
Copy the updated source file to the installed location:

```bash
cp /Users/jonathanborduas/code/QGSD/commands/qgsd/mcp-status.md /Users/jonathanborduas/.claude/commands/qgsd/mcp-status.md
```

This is the file Claude Code actually reads when running /qgsd:mcp-status. The source at commands/qgsd/mcp-status.md and installed copy must be identical.

Do NOT run the full install.js — that is only needed when hooks/ source files change. For command .md files, a direct copy is correct and sufficient.
  </action>
  <verify>
diff /Users/jonathanborduas/code/QGSD/commands/qgsd/mcp-status.md /Users/jonathanborduas/.claude/commands/qgsd/mcp-status.md
# Should output nothing (files identical)

grep "mcp__claude-1__health_check" /Users/jonathanborduas/.claude/commands/qgsd/mcp-status.md
# Should match
  </verify>
  <done>
Source and installed copies are identical. /qgsd:mcp-status will use the updated logic when next invoked.
  </done>
</task>

</tasks>

<verification>
- commands/qgsd/mcp-status.md contains health_check tool calls in allowed-tools for claude-1..6
- Health derivation has two paths: CLI agents use scoreboard, claude-N agents use live health_check result
- Latency column present in table example
- `unreachable` and `unhealthy` health states defined
- diff between source and installed copy is empty
</verification>

<success_criteria>
- claude-N agents report live health (available/unhealthy/unreachable) from health_check, not from UNAVAIL count
- CLI agents (codex/gemini/opencode/copilot) unchanged — scoreboard-derived health
- Latency (ms) visible for claude-N agents in table
- Both source and installed mcp-status.md files updated and identical
- No regression: missing scoreboard still handled gracefully, individual agent failures still non-fatal
</success_criteria>

<output>
After completion, create .planning/quick/73-modify-so-that-mcp-status-already-pulls-/73-SUMMARY.md
</output>

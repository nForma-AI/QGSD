# Phase 26: MCP Status Command — Research

**Researched:** 2026-02-22
**Domain:** QGSD command authoring, quorum scoreboard schema, MCP identity tool protocol
**Confidence:** HIGH

## Summary

Phase 26 adds `/qgsd:mcp-status` — a read-only status display command that calls `identity` on each configured quorum agent, reads UNAVAIL counts from the quorum scoreboard, and renders a unified table showing name, version, model, health state, available models, and UNAVAIL count per agent.

All infrastructure is already in place from prior phases:
- All 6 MCP repos expose a 5-field `identity` tool (Phase 25, STD-04)
- The quorum scoreboard at `.planning/quorum-scoreboard.json` contains round-level UNAVAIL data and a `team.agents` section capturing the last known identity snapshot
- The QGSD command system follows a simple `.md` file pattern — new commands are added to `commands/qgsd/` and installed by `bin/install.js` to `~/.claude/commands/qgsd/`

**Primary recommendation:** Implement mcp-status as a single QGSD command file (`commands/qgsd/mcp-status.md`) with inline orchestration logic — no new workflow file needed, no new gsd-tools subcommand. The command calls identity sequentially on available agents, parses scoreboard for UNAVAIL counts, and renders a formatted table.

## Standard Stack

### Core
| Component | Source | Purpose | Why Standard |
|-----------|--------|---------|--------------|
| `mcp__*__identity` | MCP tool calls | Get name/version/model/available_models/install_method | Phase 25 STD-04 — all 6 repos implement it |
| `.planning/quorum-scoreboard.json` | Local file (Read tool) | UNAVAIL counts, team.agents snapshot | Already populated by quorum rounds |
| `~/.claude/qgsd.json` (two-layer) | config-loader.js pattern | `required_models` → which agents are configured | Source of truth for configured agent list |
| `~/.claude.json` `mcpServers` | Read tool | Detect which MCP servers are actually installed | Phase 25 scoreboard `team.mcps` uses same source |

### No new dependencies
No new npm packages. No new gsd-tools subcommand. No new workflow file. Single command `.md` file.

## Architecture Patterns

### Data Sources and Their Mapping

```
qgsd.json required_models
  → keyed by agent name (codex, gemini, opencode, copilot)
  → tool_prefix: "mcp__codex-cli__" etc.

~/.claude.json mcpServers
  → keys: codex-cli, gemini-cli, opencode, copilot-cli, claude-deepseek, etc.
  → determines which MCP tool prefix is callable

identity tool response (per agent)
  → { name, version, model, available_models, install_method }
  → call: mcp__codex-cli__identity, mcp__gemini-cli__identity, mcp__opencode__identity, mcp__copilot-cli__identity
  → claude-deepseek/minimax/qwen-coder/kimi/llama4 use mcp__claude-*__identity

quorum-scoreboard.json schema
  → rounds[].votes[model] = "UNAVAIL" | "TP" | "TN" | etc.
  → team.agents[model] = { type, model } — last known identity snapshot
  → UNAVAIL count = count of rounds where votes[model] === "UNAVAIL"
```

### Health State Derivation

Health state (OBS-02) is derived from scoreboard UNAVAIL ratio:
- `available` — 0 UNAVAIL in last N rounds (or no scoreboard data yet)
- `quota-exceeded` — agent has UNAVAIL votes in the scoreboard rounds
- `error` — identity tool call itself throws/errors during mcp-status execution

The simplest reliable approach: count total UNAVAIL rounds for the agent across all scoreboard rounds. If > 0 → `quota-exceeded`. If identity call fails during mcp-status → `error`. Otherwise → `available`.

### Agent Name-to-Tool-Prefix Mapping

The 4 primary quorum agents (configured in `required_models`):
| qgsd.json key | Identity tool call | MCP server name in .claude.json |
|---------------|--------------------|----------------------------------|
| codex | `mcp__codex-cli__identity` | codex-cli |
| gemini | `mcp__gemini-cli__identity` | gemini-cli |
| opencode | `mcp__opencode__identity` | opencode |
| copilot | `mcp__copilot-cli__identity` | copilot-cli |

The claude-mcp-server instances (deepseek, minimax, qwen-coder, kimi, llama4):
| MCP server name | Identity tool call | Known model |
|-----------------|--------------------|----|
| claude-deepseek | `mcp__claude-deepseek__identity` | deepseek-ai/DeepSeek-V3.2 |
| claude-minimax | `mcp__claude-minimax__identity` | MiniMaxAI/MiniMax-M2.5 |
| claude-qwen-coder | `mcp__claude-qwen-coder__identity` | Qwen/Qwen3-Coder-480B |
| claude-kimi | `mcp__claude-kimi__identity` | kimi |
| claude-llama4 | `mcp__claude-llama4__identity` | llama4 |

Note: The 5 claude-mcp-server instances share the same claude-mcp-server binary but each has a different `CLAUDE_DEFAULT_MODEL` env var set in `.claude.json`. The identity tool returns `process.env['CLAUDE_DEFAULT_MODEL'] ?? 'claude-sonnet-4-6'`, so each will report its own model correctly.

### UNAVAIL Count Computation (OBS-04)

The scoreboard `rounds` array has per-round vote objects. To compute UNAVAIL count per agent:

```javascript
const scoreboard = JSON.parse(fs.readFileSync('.planning/quorum-scoreboard.json'));
const unavailCounts = {};
for (const round of scoreboard.rounds || []) {
  for (const [model, vote] of Object.entries(round.votes || {})) {
    if (vote === 'UNAVAIL') {
      unavailCounts[model] = (unavailCounts[model] || 0) + 1;
    }
  }
}
```

Real example from QGSD scoreboard: codex=56 UNAVAIL out of 61 rounds, gemini=34, opencode=4, copilot=0.

### Command Architecture Pattern (from existing commands)

QGSD commands follow one of two patterns:
1. **Thin wrapper** (e.g. `fix-tests.md`): frontmatter + `@workflow-file` reference
2. **Self-contained** (e.g. `quorum.md`): full orchestration inline in the `.md` file

For mcp-status, use **self-contained** — the logic is short enough (~50 lines of process description) and doesn't justify a separate workflow file.

Command frontmatter pattern (from quorum.md):
```yaml
---
name: qgsd:mcp-status
description: Show status of all connected quorum agents — name, version, model, health, available models, UNAVAIL count
allowed-tools:
  - Read
  - Bash
  - mcp__codex-cli__identity
  - mcp__gemini-cli__identity
  - mcp__opencode__identity
  - mcp__copilot-cli__identity
  - mcp__claude-deepseek__identity
  - mcp__claude-minimax__identity
  - mcp__claude-qwen-coder__identity
  - mcp__claude-kimi__identity
  - mcp__claude-llama4__identity
---
```

### Install Mechanism

`bin/install.js` copies everything in `commands/qgsd/` to `~/.claude/commands/qgsd/`. Adding `commands/qgsd/mcp-status.md` to the source repo makes it installable by running `node bin/install.js` (or users will pick it up on next `npx qgsd@latest`). The installed copy at `~/.claude/commands/qgsd/mcp-status.md` is also updated directly (matching the pattern used in all prior quick tasks).

### Output Table Format (OBS-01, OBS-02, OBS-03, OBS-04)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► MCP STATUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌────────────────┬─────────┬──────────────────────────┬────────────────┬───────────────────────────────────┬──────────┐
│ Agent          │ Version │ Model                    │ Health         │ Available Models                  │ UNAVAIL  │
├────────────────┼─────────┼──────────────────────────┼────────────────┼───────────────────────────────────┼──────────┤
│ codex-cli      │ 1.2.3   │ codex                    │ quota-exceeded │ codex, o3-mini, gpt-4o            │ 56       │
│ gemini-cli     │ 1.1.0   │ gemini-3-pro-preview     │ quota-exceeded │ gemini-3-pro, gemini-3-flash      │ 34       │
│ opencode       │ 1.0.0   │ claude-sonnet-4-6        │ available      │ claude-sonnet-4-6, gpt-4o         │ 4        │
│ copilot-cli    │ 1.2.0   │ gpt-4.1                  │ available      │ gpt-4.1, gpt-4o, claude-3.5       │ 0        │
│ claude-deepseek│ 1.0.0   │ deepseek-ai/DeepSeek-V3  │ available      │ n/a                               │ 0        │
│ claude-minimax │ 1.0.0   │ MiniMaxAI/MiniMax-M2.5   │ available      │ n/a                               │ 0        │
│ claude-qwen    │ 1.0.0   │ Qwen/Qwen3-Coder-480B    │ available      │ n/a                               │ 0        │
│ claude-kimi    │ 1.0.0   │ kimi                     │ available      │ n/a                               │ 0        │
│ claude-llama4  │ 1.0.0   │ meta-llama/Llama-4-M     │ available      │ n/a                               │ 0        │
└────────────────┴─────────┴──────────────────────────┴────────────────┴───────────────────────────────────┴──────────┘

Last scoreboard update: 2026-02-22 (61 rounds recorded)
```

## Common Pitfalls

### Pitfall 1: Scoreboard not found (fresh project)
**What goes wrong:** `.planning/quorum-scoreboard.json` doesn't exist in new projects.
**How to avoid:** Check if file exists before reading — if absent, show UNAVAIL=0 and health=unknown. Don't error out.

### Pitfall 2: Identity tool call fails (MCP not running or UNAVAIL)
**What goes wrong:** `mcp__codex-cli__identity` throws if codex-cli MCP isn't configured or is down.
**How to avoid:** Wrap each call in try/catch; show health=`error` and fill version/model/available_models with `—` on failure. Never crash the whole command.

### Pitfall 3: Agents not in qgsd.json required_models vs. agents in .claude.json
**What goes wrong:** The 5 claude-mcp-server instances (deepseek, minimax, etc.) are NOT in `required_models` — they're directly in `.claude.json`. mcp-status must read from BOTH sources.
**How to avoid:** Build the agent list from `~/.claude.json mcpServers` keys, not only from `required_models`. Map mcp server name → identity tool prefix.

### Pitfall 4: UNAVAIL count comes from scoreboard model keys, not MCP server names
**What goes wrong:** Scoreboard uses `codex`, `gemini`, `opencode`, `copilot` as model keys — NOT `codex-cli`, `gemini-cli` etc.
**How to avoid:** Maintain an explicit mapping between scoreboard model key and MCP server name when joining data.

### Pitfall 5: available_models array too long for table display
**What goes wrong:** Some agents expose 10+ model names; truncates table.
**How to avoid:** Display first 3 models + "..." if more than 3. Or wrap to next line. Decision for implementation.

### Pitfall 6: Calling identity sequentially (R3.2 requirement for quorum, but mcp-status is read-only)
**What goes wrong:** mcp-status is NOT a quorum command — it does not trigger quorum. But identity calls should still be sequential (not sibling) to avoid MCP parallelism issues.
**How to avoid:** Call each identity tool in sequence. Note in command frontmatter: this command is read-only/observation only and NOT in quorum_commands.

## Code Examples

### Reading scoreboard and computing UNAVAIL counts (inline Bash)
```bash
node -e "
const fs=require('fs');
const p='.planning/quorum-scoreboard.json';
if(!fs.existsSync(p)){console.log('{}');process.exit(0);}
const d=JSON.parse(fs.readFileSync(p));
const counts={};
for(const r of d.rounds||[]){
  for(const [m,v] of Object.entries(r.votes||{})){
    if(v==='UNAVAIL') counts[m]=(counts[m]||0)+1;
  }
}
console.log(JSON.stringify(counts));
"
```

### Scoreboard team.agents snapshot (fallback identity source)
```javascript
// team.agents[model] = { type: "codex-cli", model: "codex" }
// Use when live identity call fails
const snapshot = scoreboard.team?.agents?.[modelKey] || null;
```

### MCP server name → scoreboard model key mapping
```
codex-cli      → codex
gemini-cli     → gemini
opencode       → opencode
copilot-cli    → copilot
claude-deepseek → deepseek
claude-minimax  → minimax
claude-qwen-coder → qwen-coder
claude-kimi    → kimi
claude-llama4  → llama4
```

## Plan Decomposition Recommendation

Phase 26 fits in **1 plan**:

**Plan 26-01**: `mcp-status.md` command — call identity on all configured agents, read UNAVAIL from scoreboard, render table (OBS-01, OBS-02, OBS-03, OBS-04)

All 4 requirements (OBS-01..04) are satisfied by one command file. No gsd-tools changes needed. No new workflow file needed. Install both source `commands/qgsd/mcp-status.md` and the installed `~/.claude/commands/qgsd/mcp-status.md`.

## Open Questions

1. **available_models display truncation**
   - What we know: Some agents have 4+ models in available_models list
   - What's unclear: Should table truncate at 3 with "..." or show all (wrapping row)?
   - Recommendation: Truncate at 3 + "..." for table readability; full list available via identity call directly

2. **claude-mcp-server instances have no scoreboard model key for kimi/llama4 in older scoreboards**
   - What we know: VALID_MODELS in update-scoreboard includes kimi, llama4 — so new rounds will track them
   - What's unclear: Older scoreboards may not have kimi/llama4 UNAVAIL votes at all
   - Recommendation: Default to 0 UNAVAIL if key missing — don't show error

## Sources

### Primary (HIGH confidence)
- `/Users/jonathanborduas/code/QGSD/bin/update-scoreboard.cjs` — scoreboard schema, UNAVAIL vote, team.agents structure, VALID_MODELS list
- `/Users/jonathanborduas/code/QGSD/hooks/config-loader.js` — required_models schema, two-layer config structure
- `/Users/jonathanborduas/code/QGSD/commands/qgsd/quorum.md` — command frontmatter pattern, MCP tool prefix conventions
- `/Users/jonathanborduas/code/claude-mcp-server/src/tools/simple-tools.ts` — identity tool 5-field response schema
- `~/.claude.json mcpServers` — actual installed MCP server names and entry points
- `~/.claude/qgsd.json` — production required_models configuration

### Secondary (MEDIUM confidence)
- Live scoreboard at `.planning/quorum-scoreboard.json` — confirmed UNAVAIL counts: codex=56, gemini=34, opencode=4, copilot=0 out of 61 rounds

## Metadata

**Confidence breakdown:**
- Data sources / scoreboard schema: HIGH — read from live code and live data
- Command implementation pattern: HIGH — same pattern used by 20+ existing commands
- Health state derivation: HIGH — straightforward UNAVAIL count from rounds array
- available_models display: MEDIUM — truncation strategy is a design choice

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (stable domain — scoreboard schema unlikely to change)

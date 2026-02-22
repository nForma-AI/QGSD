---
phase: 32
status: passed
verified: 2026-02-22
verifier: claude-sonnet-4-6
---

# Verification: Phase 32 — Wizard Scaffold

**Phase Goal:** Users can run `/qgsd:mcp-setup` and reach a working wizard — first-run linear onboarding for new installs, a live-status agent menu for re-runs, and a confirm+apply+restart flow that writes changes to `~/.claude.json`

**Requirements:** WIZ-01, WIZ-02, WIZ-03, WIZ-04, WIZ-05

---

## Verification Results

### WIZ-01: User can run `/qgsd:mcp-setup` to start the MCP configuration wizard

Status: PASS

Evidence:
- `commands/qgsd/mcp-setup.md` exists (551 lines)
- Frontmatter: `name: qgsd:mcp-setup` — registered as slash command
- `~/.claude/commands/qgsd/mcp-setup.md` installed and identical to source (SYNC OK)
- Command is accessible to Claude Code from both source and installed path

### WIZ-02: First run (no configured agents) presents a guided linear onboarding flow step by step

Status: PASS

Evidence:
- First-run detection: reads `~/.claude.json`, filters entries with command+args, routes on `isFirstRun === true` (5 occurrences in file)
- Welcome banner: `QGSD ► MCP SETUP — FIRST RUN`
- Numbered agent template list with 5 options (deepseek/minimax/qwen-coder/llama4/kimi) + Skip
- Key collection: AskUserQuestion flow, keytar storage via `bin/secrets.cjs`, keytar-unavailable fallback with Keychain Unavailable confirmation and audit log
- Add-another loop: after each agent, offers "Add another agent" or "Finish setup"
- Batch-write with timestamped backup: `cp ~/.claude.json ~/.claude.json.backup-$(date +%Y-%m-%d-%H%M%S)`
- Sequential mcp-restart per configured agent

### WIZ-03: Re-run shows the current agent roster as a navigable menu

Status: PASS

Evidence:
- Re-run path: when `isFirstRun === false`, command displays `QGSD ► MCP SETUP — AGENT ROSTER`
- Reads `mcpServers` from `~/.claude.json` and builds numbered agents array
- AskUserQuestion renders numbered options: "1 — {agent-name}" per agent
- Offers "Add new agent (Phase 35)" option and "Exit"
- Selecting an agent opens the Agent Sub-Menu

### WIZ-04: Each agent in the menu shows current model, provider, and key status (present/missing)

Status: PASS

Evidence:
- Roster script reads: `env.CLAUDE_DEFAULT_MODEL`, `env.ANTHROPIC_BASE_URL`, keytar `ANTHROPIC_API_KEY_<AGENT_UPPER>`
- Key status values: `key stored` (keytar hit), `key in env` (env block set, no keytar), `no key` (neither)
- Table rendered with columns: #, Agent, Model, Provider, Key
- Agent detail sub-menu banner shows: Model / Provider / Key per agent

### WIZ-05: User confirms before changes are applied; wizard restarts affected agents after apply

Status: PASS

Evidence:
- First-run: explicit AskUserQuestion "Apply changes to ~/.claude.json and restart configured agents?" before any write
- Re-run confirm+apply+restart flow: same confirm gate, then backup → write → sync keytar → sequential `/qgsd:mcp-restart` per agent → confirmation
- Two occurrences of backup command (`cp ~/.claude.json ~/.claude.json.backup-...`)
- `syncToClaudeJson(SERVICE)` called after write
- Restart failure handled gracefully: config left in written state, manual retry instructions shown

---

## Must-Have Truth Verification

| Truth | Status |
|---|---|
| commands/qgsd/mcp-setup.md exists with frontmatter name: qgsd:mcp-setup | PASS |
| ~/.claude/commands/qgsd/mcp-setup.md identical to source | PASS (SYNC OK) |
| Command reads ~/.claude.json and branches on mcpServers entry count | PASS |
| First-run flow displays QGSD welcome banner and agent template list | PASS |
| Missing/corrupt ~/.claude.json handled gracefully (try/catch) | PASS |
| Keytar failure fallback with explicit user confirmation | PASS |
| Re-run section lists agents with model/provider/key-status columns | PASS |
| Sub-menu shows 3 options: set key, swap provider, remove | PASS |
| Confirm+apply+restart: backup created, ~/.claude.json written, mcp-restart invoked | PASS |
| REQUIREMENTS.md WIZ-01–05 traceability shows Phase 32 | PASS (5 rows) |
| STATE.md updated with Phase 32 execution status | PASS |

---

## Artifact Verification

| Artifact | Requirement | Result |
|---|---|---|
| commands/qgsd/mcp-setup.md (min 80 lines, contains qgsd:mcp-setup) | WIZ-01 | PASS (551 lines) |
| commands/qgsd/mcp-setup.md (contains "first-run") | WIZ-02 | PASS (12 occurrences) |
| commands/qgsd/mcp-setup.md (contains "Re-run Agent Menu") | WIZ-03 | PASS |
| .planning/REQUIREMENTS.md (contains "WIZ-01 \| Phase 32") | WIZ-01–05 | PASS |

---

## Phase Goal Assessment

PASS — The phase goal is met:
- `/qgsd:mcp-setup` exists as an executable slash command (WIZ-01)
- First-run linear onboarding is fully specified: banner → template selection → key collection → confirm → batch-write → restart → summary (WIZ-02)
- Re-run shows live agent roster with model/provider/key-status (WIZ-03, WIZ-04)
- Confirm+apply+restart flow is implemented with backup guard (WIZ-05)

Phase 33 (API Key Management), Phase 34 (Provider Swap), and Phase 35 (Agent Roster) will fill in the sub-menu stubs. Those are explicitly scoped to future phases and the stubs correctly communicate this to the user.

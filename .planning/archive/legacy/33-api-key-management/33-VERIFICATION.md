---
phase: 33
name: API Key Management
status: passed
verified: 2026-02-22
verifier: qgsd-verifier
---

# Phase 33 Verification — API Key Management

## Goal

Users can set or update the API key for any agent entirely through the wizard — the key is stored in keytar, written to `~/.claude.json` on confirm, and the agent is automatically restarted.

## Must-Have Verification

### KEY-01 — "(key stored)" hint when key already exists

**Status: VERIFIED**

- `mcp-setup.md` Step A runs a keytar check before prompting: calls `bin/secrets.cjs get()` with `ANTHROPIC_API_KEY_{AGENT_UPPER}` account name.
- If `hasKey: true, method: 'keytar'`: Step B displays `"API key already stored in system keychain (key stored). Enter a new key to overwrite it, or skip."` — the actual key value is never shown.
- Sub-menu option label updated to `"1 — Set / update API key"` (Phase 33 suffix removed).
- Evidence: `grep -c "key stored" commands/qgsd/mcp-setup.md` = 6 matches; `grep "Phase 33"` = 0 matches.

### KEY-02 — Key stored via bin/secrets.cjs; never in log or plain-text file

**Status: VERIFIED**

- Step D uses `bin/secrets.cjs set(SERVICE, keyName, apiKey)` with key passed exclusively via `AGENT_NAME` and `API_KEY` environment variables — never interpolated into the script body or any displayed text.
- Fallback path (keytar unavailable): AskUserQuestion confirmation + audit log to `~/.claude/debug/mcp-setup-audit.log` records only the agent name and fact of env_block storage — not the key value.
- Evidence: `AGENT_NAME="{agent-name}" API_KEY="{user-entered-key}"` pattern confirmed at lines 521 and 593; no plaintext key value in any display step.

### KEY-03 — ~/.claude.json patched with new key value + syncToClaudeJson called

**Status: VERIFIED**

- Step E patches `claudeJson.mcpServers[agentName].env.ANTHROPIC_API_KEY = apiKey` via inline node (key passed via env var `API_KEY`, not interpolated).
- `syncToClaudeJson(SERVICE)` called immediately after the patch to propagate all keytar secrets to all env blocks.
- Evidence: `grep -c "ANTHROPIC_API_KEY" mcp-setup.md` = 10 (lines 589, etc.); `grep -c "syncToClaudeJson"` = 7 (lines 292, 293, 599, 600, 688).

### KEY-04 — /qgsd:mcp-restart auto-invoked after key write

**Status: VERIFIED**

- Step E item 4: `Invoke /qgsd:mcp-restart {agent-name} (sequential). If restart fails, leave config written and display restart-failure warning.`
- User does not need to manually restart; restart happens as part of the "Apply and restart" confirm flow.
- Evidence: `grep -c "mcp-restart" mcp-setup.md` = 9 matches; specific invocation at line 604 in the Option 1 flow.

## Artifact Verification

| Artifact | Path | Contains | Status |
|----------|------|----------|--------|
| Source wizard | `commands/qgsd/mcp-setup.md` | "key stored" hint, full flow | VERIFIED |
| Installed copy | `~/.claude/commands/qgsd/mcp-setup.md` | identical to source | VERIFIED |
| No stub | both copies | 0 "Phase 33" stub matches | VERIFIED |

## Key Links Verification

| Link | Pattern | Found |
|------|---------|-------|
| mcp-setup Option 1 → secrets.cjs get() | `require.*secrets\.cjs.*get` | YES (lines 458, 360) |
| mcp-setup confirm → secrets.cjs set() | `require.*secrets\.cjs.*set` | YES (lines 119, 509) |
| mcp-setup confirm → ANTHROPIC_API_KEY patch | `ANTHROPIC_API_KEY` | YES (line 589) |
| mcp-setup confirm → mcp-restart | `mcp-restart` | YES (line 604) |

## Numeric Checks

| Check | Expected | Actual | Pass |
|-------|----------|--------|------|
| `grep -c "key stored"` | >= 1 | 6 | YES |
| `grep "Phase 33"` | 0 | 0 | YES |
| `grep -c "syncToClaudeJson"` | >= 2 | 7 | YES |
| `grep -c "mcp-restart"` | >= 3 | 9 | YES |
| `grep -c "ANTHROPIC_API_KEY"` | >= 3 | 10 | YES |
| `wc -l` | >= 600 | 721 | YES |
| `diff source installed` | empty | empty | YES |

## Conclusion

**Status: PASSED**

All KEY-01..KEY-04 requirements satisfied. The mcp-setup.md wizard fully implements the secure API key management flow for Agent Sub-Menu Option 1. The Phase 33 stub has been completely replaced. Source and installed copies are byte-identical. No key value appears in any display step or log output.

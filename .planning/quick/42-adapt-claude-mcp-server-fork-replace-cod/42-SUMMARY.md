---
phase: quick-42
plan: 01
subsystem: claude-mcp-server
tags: [mcp, claude-cli, refactor, fork-adaptation]
dependency_graph:
  requires: []
  provides: [claude-mcp-server binary, ClaudeToolHandler, ClaudeMcpServer]
  affects: []
tech_stack:
  added: []
  patterns: [claude -p prompt --output-format json, --resume session-id, session_id from JSON stdout]
key_files:
  created: []
  modified:
    - /Users/jonathanborduas/code/claude-mcp-server/src/types.ts
    - /Users/jonathanborduas/code/claude-mcp-server/src/tools/handlers.ts
    - /Users/jonathanborduas/code/claude-mcp-server/src/tools/definitions.ts
    - /Users/jonathanborduas/code/claude-mcp-server/src/session/storage.ts
    - /Users/jonathanborduas/code/claude-mcp-server/src/index.ts
    - /Users/jonathanborduas/code/claude-mcp-server/src/server.ts
    - /Users/jonathanborduas/code/claude-mcp-server/src/utils/command.ts
    - /Users/jonathanborduas/code/claude-mcp-server/src/__tests__/index.test.ts
    - /Users/jonathanborduas/code/claude-mcp-server/src/__tests__/resume-functionality.test.ts
    - /Users/jonathanborduas/code/claude-mcp-server/src/__tests__/default-model.test.ts
    - /Users/jonathanborduas/code/claude-mcp-server/src/__tests__/mcp-stdio.test.ts
    - /Users/jonathanborduas/code/claude-mcp-server/src/__tests__/context-building.test.ts
    - /Users/jonathanborduas/code/claude-mcp-server/src/__tests__/edge-cases.test.ts
    - /Users/jonathanborduas/code/claude-mcp-server/src/__tests__/error-scenarios.test.ts
    - /Users/jonathanborduas/code/claude-mcp-server/src/__tests__/model-selection.test.ts
    - /Users/jonathanborduas/code/claude-mcp-server/package.json
decisions:
  - "Claude CLI invocation: claude -p prompt --model model --output-format json (defaults to json for session_id extraction)"
  - "Session resume: --resume flag with claudeSessionId extracted from JSON stdout session_id field"
  - "routerBaseUrl overrides ANTHROPIC_BASE_URL env var per-call"
  - "ReviewToolHandler: prompt-embedded review context instead of codex review subcommand"
  - "SandboxMode enum removed; reasoningEffort/sandbox/fullAuto/callbackUri removed from schema"
metrics:
  duration: 388s
  completed: 2026-02-22
  tasks: 5
  files: 16
---

# Quick Task 42: Adapt claude-mcp-server Fork — Replace Codex with Claude CLI Summary

**One-liner:** Complete Codex-to-Claude CLI migration: TOOLS.CLAUDE constant, ClaudeToolHandler invoking `claude -p` with JSON output parsing, session resume via `--resume`, routerBaseUrl env override, and all 8 test files updated.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Rewrite types.ts — Claude constants and schemas | e3c161e | src/types.ts |
| 2 | Rewrite handlers.ts and storage.ts | 893a303 | src/tools/handlers.ts, src/session/storage.ts |
| 3 | Rewrite definitions.ts and package.json | cf2aa11 | src/tools/definitions.ts, package.json |
| 4 | Update server.ts, index.ts, utils/command.ts | 88e2f1e | src/server.ts, src/index.ts, src/utils/command.ts |
| 5 | Update all 8 test files | 4c05844 | src/__tests__/*.test.ts |

## What Was Built

Replaced all Codex CLI references with Claude Code CLI across the `claude-mcp-server` fork:

**types.ts:**
- `TOOLS.CODEX` → `TOOLS.CLAUDE = 'claude'`
- Removed `DEFAULT_CODEX_MODEL`, `CODEX_DEFAULT_MODEL_ENV_VAR`, `AVAILABLE_CODEX_MODELS`, `SandboxMode`
- Added `DEFAULT_CLAUDE_MODEL = 'claude-sonnet-4-6'`, `CLAUDE_DEFAULT_MODEL_ENV_VAR`, `AVAILABLE_CLAUDE_MODELS`
- Rewrote `CodexToolSchema` → `ClaudeToolSchema`: removed `reasoningEffort/sandbox/fullAuto/callbackUri`, added `allowedTools/dangerouslySkipPermissions/outputFormat/maxTurns/routerBaseUrl`

**handlers.ts:**
- `CodexToolHandler` → `ClaudeToolHandler`
- CLI invocation: `claude -p prompt --model model --output-format json` (default json for session_id extraction)
- Resume mode: `claude -p prompt --resume claudeSessionId --model model --output-format json`
- Session ID: extracted from `JSON.parse(result.stdout).session_id` (not stderr regex)
- `routerBaseUrl` → `{ ANTHROPIC_BASE_URL: routerBaseUrl }` env override
- `ReviewToolHandler`: builds review prompt from context params, invokes `claude -p reviewPrompt --output-format json`
- `HelpToolHandler`: invokes `claude --help`

**storage.ts:**
- `codexConversationId` → `claudeSessionId` in `SessionData`
- `setCodexConversationId/getCodexConversationId` → `setClaudeSessionId/getClaudeSessionId`

**definitions.ts:**
- Tool name: `TOOLS.CLAUDE`, description: `'Execute Claude Code CLI in non-interactive mode for AI assistance'`
- New params: `allowedTools`, `dangerouslySkipPermissions`, `outputFormat`, `maxTurns`, `routerBaseUrl`
- `outputSchema`: only `sessionId` (removed `threadId`)

**server.ts / index.ts:**
- `CodexMcpServer` → `ClaudeMcpServer`
- `SERVER_CONFIG.name`: `'codex-mcp-server'` → `'claude-mcp-server'`

**package.json:**
- `name`: `claude-mcp-server`, `bin`: `claude-mcp-server`, updated description and keywords

**Test files (8 files):**
- All `CodexToolHandler` → `ClaudeToolHandler`, `CodexMcpServer` → `ClaudeMcpServer`
- `TOOLS.CODEX` → `TOOLS.CLAUDE` throughout
- Mock responses: `stdout: JSON.stringify({ result: '...', session_id: '...' })`
- `executeCommand` matchers: `claude -p prompt --model claude-sonnet-4-6 --output-format json`
- `setCodexConversationId/getCodexConversationId` → Claude equivalents
- Removed `threadId`, `callbackUri`, `reasoningEffort`, `sandbox`, `fullAuto` assertions
- `mcp-stdio.test.ts`: stub renamed to `claude`, outputs JSON format
- `model-selection.test.ts`: `AVAILABLE_CLAUDE_MODELS`, `CLAUDE_DEFAULT_MODEL`

## Verification Results

```
tsc --noEmit: PASSED (zero errors)
grep -ri 'codex' src/: No matches
package name: claude-mcp-server
bin entry: claude-mcp-server
npm run build: PASSED
```

## Deviations from Plan

**1. [Rule 2 - Enhancement] Updated stray codex comment in executeCommandStreaming JSDoc**
- **Found during:** Task 4
- **Issue:** JSDoc comment "because tools like codex write their primary output to stderr" still referenced codex
- **Fix:** Updated to "because some CLI tools write their primary output to stderr"
- **Files modified:** src/utils/command.ts

**2. [Rule 1 - Cleanup] Replaced 'existing-codex-session-id' test data string**
- **Found during:** Task 5 verification
- **Issue:** grep found 'codex' in test data string value in resume-functionality.test.ts
- **Fix:** Changed to 'existing-claude-session-id'
- **Files modified:** src/__tests__/resume-functionality.test.ts

## Self-Check: PASSED

Files verified:
- /Users/jonathanborduas/code/claude-mcp-server/src/types.ts — FOUND
- /Users/jonathanborduas/code/claude-mcp-server/src/tools/handlers.ts — FOUND
- /Users/jonathanborduas/code/claude-mcp-server/src/session/storage.ts — FOUND
- /Users/jonathanborduas/code/claude-mcp-server/src/tools/definitions.ts — FOUND
- /Users/jonathanborduas/code/claude-mcp-server/src/server.ts — FOUND
- /Users/jonathanborduas/code/claude-mcp-server/src/index.ts — FOUND

Commits verified: e3c161e, 893a303, cf2aa11, 88e2f1e, 4c05844 — all present in claude-mcp-server repo.

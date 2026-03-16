---
phase: quick-310
plan: 01
type: execute
date_completed: 2026-03-16
duration: "15min"
task_count: 2
files_created: 0
files_modified: 2
commits: 1
---

# Quick 310 Summary: Dynamic MCP Dispatch Guard

Replace hardcoded slot families with dynamic discovery from bin/providers.json.

## Objective

The nf-mcp-dispatch-guard hook previously derived known quorum slot families from the static SLOT_TOOL_SUFFIX map in config-loader.js (8 hardcoded family names). When users add new provider types via /nf:mcp-setup, the guard silently let direct MCP calls through because the new family was unknown, violating R3.2 enforcement.

This quick task replaces that hardcoded dependency with dynamic discovery from bin/providers.json, ensuring the guard blocks ALL configured quorum slots regardless of when they were added.

## Changes

### Task 1: Replace hardcoded KNOWN_FAMILIES with dynamic discovery

**File:** hooks/nf-mcp-dispatch-guard.js

- Removed import of SLOT_TOOL_SUFFIX from config-loader
- Added `loadKnownFamilies()` function that:
  - Reads bin/providers.json from project root
  - Extracts `.providers[].name` entries (e.g. "codex-1", "gemini-2", "claude-4")
  - Strips trailing `-N` to derive family names (e.g. "codex", "gemini", "claude")
  - Returns a Set of unique family strings
  - Fails open with stderr warning if file missing or malformed
- Changed KNOWN_FAMILIES initialization from static to dynamic: `const KNOWN_FAMILIES = loadKnownFamilies();`
- Added `fs` and `path` requires at top
- Updated module.exports to include loadKnownFamilies for testing
- No changes to config-loader.js, as required (SLOT_TOOL_SUFFIX stays there for other consumers)

**Verification:**
- All 5 expected families discovered: codex, gemini, opencode, copilot, claude
- SLOT_TOOL_SUFFIX not imported: confirmed via grep
- providers.json read on module load: confirmed via grep

### Task 2: Update tests and sync dist

**File:** hooks/nf-mcp-dispatch-guard.test.js

- Updated TC14 comment to clarify "unknown MCP server" means not in providers.json
- Added TC18: Validates KNOWN_FAMILIES contains all 5 expected families from providers.json
- Added TC19: Validates KNOWN_FAMILIES does NOT contain numbered slots (only base families), and tests that `-N` stripping derives correct families

**Distribution:**
- Synced hooks/nf-mcp-dispatch-guard.js to hooks/dist/nf-mcp-dispatch-guard.js
- Ran `node bin/install.js --claude --global` to install globally
- Verified diff: no differences between source and dist

**Test Results:**
```
19 passed, 0 failed
```
All tests pass including:
- TC1-TC17: Existing tests (unchanged behavior contract)
- TC18: KNOWN_FAMILIES contains expected families
- TC19: KNOWN_FAMILIES correctly derives families by stripping -N suffix

## Success Criteria

- [x] Guard blocks direct MCP calls for all providers in bin/providers.json (codex, gemini, opencode, copilot, claude families)
- [x] Guard passes through admin tools (ping, health_check, deep_health_check, identity, help)
- [x] Guard passes through unknown MCP servers (not in providers.json)
- [x] Guard fails open if providers.json is missing/malformed
- [x] config-loader.js completely untouched (SLOT_TOOL_SUFFIX still present with same 8 entries)
- [x] All 19 tests pass (17 existing + 2 new)
- [x] Dist copy synced and installed

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] hooks/nf-mcp-dispatch-guard.js modified: dynamic discovery, fs/path imports, loadKnownFamilies exported
- [x] hooks/nf-mcp-dispatch-guard.test.js updated: TC14 comment, TC18 and TC19 added
- [x] hooks/dist/nf-mcp-dispatch-guard.js synced (no diff)
- [x] bin/install.js --claude --global executed
- [x] All 19 tests pass
- [x] SLOT_TOOL_SUFFIX not imported in guard (verified via grep)
- [x] providers.json referenced in guard (verified via grep: 6 occurrences)
- [x] config-loader.js unchanged (SLOT_TOOL_SUFFIX still exports 9 keys)

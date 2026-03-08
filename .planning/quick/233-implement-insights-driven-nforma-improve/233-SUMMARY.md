---
phase: quick-233
plan: 01
subsystem: hooks
tags: [safety, dispatch-guard, post-edit-verify, executor-hardening]
dependency_graph:
  requires: [config-loader, install.js]
  provides: [nf-mcp-dispatch-guard, post-edit-verify, git-guard-additionalContext, executor-preflight]
  affects: [nf-destructive-git-guard, nf-post-edit-format, nf-executor agent spec]
tech_stack:
  patterns: [PreToolUse additionalContext injection, optional post-edit verify pipeline, fail-open guard hooks]
key_files:
  created:
    - hooks/nf-mcp-dispatch-guard.js
  modified:
    - hooks/nf-destructive-git-guard.js
    - hooks/nf-post-edit-format.js
    - hooks/config-loader.js
    - agents/nf-executor.md
    - bin/install.js
decisions:
  - Use additionalContext (not stderr) for nForma-active git safety warnings so Claude sees them
  - MCP dispatch guard warns only on known quorum slot families, allowlists ping/health_check
  - Post-edit verify is disabled by default, uses warn-only fail mode
  - Executor pre-flight uses test -f with immediate STOP on missing plan file
metrics:
  duration: 4m
  completed: 2026-03-08
---

# Quick 233: Insights-Driven nForma Improvements Summary

Four safety improvements from session insights analysis: git stash additionalContext warning, MCP dispatch guard hook, post-edit verify pipeline, executor PLAN.md pre-flight check.

## What Was Done

### Task 1: Hook Upgrades + New MCP Dispatch Guard (9ee8571b)

**1a. nf-destructive-git-guard.js upgrade:**
- Added `fs` and `path` imports
- Replaced stderr-only warning with conditional: checks `.planning/current-activity.json` existence
- When nForma active: emits stdout JSON with `additionalContext` so Claude sees the warning
- When non-nForma: keeps original stderr-only behavior unchanged
- Maintained fail-open pattern (exit 0 in all paths)

**1b. nf-mcp-dispatch-guard.js (NEW):**
- PreToolUse hook following exact structure pattern of nf-destructive-git-guard
- Parses `mcp__<slot>__<suffix>` tool names via regex
- Builds known family set from SLOT_TOOL_SUFFIX keys in config-loader
- Allowlists `ping` and `health_check` suffixes (diagnostic tools)
- For quorum-related MCP calls: emits additionalContext warning citing R3.2 dispatch requirement
- Includes profile guard, input validation, fail-open try/catch

**1c. config-loader.js updates:**
- Added `nf-mcp-dispatch-guard` to `standard` and `strict` profile Sets
- Added priority entry: `'nf-mcp-dispatch-guard': 50` (Normal)
- Added 5 flat config keys for post-edit verify: `post_edit_verify_enabled`, `post_edit_verify_command`, `post_edit_verify_timeout_ms`, `post_edit_verify_file_patterns`, `post_edit_verify_fail_mode`

**1d. nf-post-edit-format.js verify extension:**
- Restructured flow: no-formatter case no longer exits early (sets `formatterFound = false` flag)
- Collects context messages in array, emits combined additionalContext at end
- Verify step: checks `post_edit_verify_enabled`, `post_edit_verify_command`, file pattern filter
- Runs verify command via spawnSync with shell and configurable timeout
- On verify failure: appends warning to additionalContext (warn mode only)
- On verify success: appends "[post-edit-verify] Passed"

### Task 2: Executor Spec + Install Sync (31c5ba8e)

**2a. agents/nf-executor.md hardening:**
- Added `preflight_plan_check` step with `priority="critical"` before `load_project_state`
- Uses `test -f "${PLAN_FILE}"` with immediate error + exit on missing plan

**2b. bin/install.js registration:**
- Added install block for nf-mcp-dispatch-guard (PreToolUse, timeout 10s)
- Added uninstall block to filter out nf-mcp-dispatch-guard entries

**2c. Dist sync + global install:**
- Copied all 4 modified hooks to hooks/dist/
- Ran `node bin/install.js --claude --global` successfully
- Verified hook registered in ~/.claude/settings.json

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- All 4 hooks pass `node -c` syntax check
- config-loader.HOOK_PROFILE_MAP.standard has nf-mcp-dispatch-guard: true
- config-loader.DEFAULT_HOOK_PRIORITIES['nf-mcp-dispatch-guard']: 50
- config-loader.DEFAULT_CONFIG.post_edit_verify_enabled: false
- MCP dispatch guard warns on `mcp__codex-1__review`: confirmed
- MCP dispatch guard silent on `mcp__codex-1__ping`: confirmed
- Git guard emits additionalContext when current-activity.json exists: confirmed
- Executor spec contains PLAN_FILE pre-flight check: confirmed
- Install.js registers nf-mcp-dispatch-guard in settings.json: confirmed

## Self-Check: PASSED

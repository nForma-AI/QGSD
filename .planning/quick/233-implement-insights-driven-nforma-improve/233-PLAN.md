---
phase: quick-233
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - hooks/nf-destructive-git-guard.js
  - hooks/nf-mcp-dispatch-guard.js
  - hooks/nf-post-edit-format.js
  - hooks/config-loader.js
  - agents/nf-executor.md
  - bin/install.js
autonomous: true
requirements: [INSIGHT-01, INSIGHT-02, INSIGHT-03, INSIGHT-04]

must_haves:
  truths:
    - "Claude receives additionalContext warning when running destructive git ops with uncommitted changes during nForma workflow"
    - "Claude receives additionalContext warning when making direct mcp__<slot>__<tool> calls instead of Task dispatch"
    - "Post-edit verify config keys exist in DEFAULT_CONFIG and verify step runs when enabled"
    - "Executor agent spec requires PLAN.md existence pre-flight check"
  artifacts:
    - path: "hooks/nf-destructive-git-guard.js"
      provides: "Upgraded stdout JSON warning for nForma contexts"
      contains: "additionalContext"
    - path: "hooks/nf-mcp-dispatch-guard.js"
      provides: "Raw MCP call interception with R3.2 guidance"
      contains: "mcp__"
    - path: "hooks/nf-post-edit-format.js"
      provides: "Optional post-edit verify command execution"
      contains: "post_edit_verify"
    - path: "hooks/config-loader.js"
      provides: "MCP dispatch guard in profiles and priorities; verify config keys"
      contains: "nf-mcp-dispatch-guard"
    - path: "agents/nf-executor.md"
      provides: "PLAN.md pre-flight check requirement"
      contains: "PLAN_FILE"
  key_links:
    - from: "hooks/nf-destructive-git-guard.js"
      to: ".planning/current-activity.json"
      via: "fs.existsSync check"
      pattern: "current-activity\\.json"
    - from: "hooks/nf-mcp-dispatch-guard.js"
      to: "hooks/config-loader.js"
      via: "require('./config-loader')"
      pattern: "SLOT_TOOL_SUFFIX"
    - from: "hooks/config-loader.js"
      to: "hooks/nf-mcp-dispatch-guard.js"
      via: "HOOK_PROFILE_MAP and DEFAULT_HOOK_PRIORITIES entries"
      pattern: "nf-mcp-dispatch-guard"
    - from: "bin/install.js"
      to: "hooks/nf-mcp-dispatch-guard.js"
      via: "PreToolUse hook registration"
      pattern: "nf-mcp-dispatch-guard"
---

<objective>
Implement four insights-driven nForma improvements: upgrade git stash safety to surface warnings via additionalContext, create MCP dispatch guard hook for raw call interception, extend post-edit hook with optional verify command, and harden executor agent spec with PLAN.md pre-flight check.

Purpose: Close safety gaps identified by session insights analysis -- Claude currently misses stderr-only warnings, can bypass quorum dispatch, and has no post-edit verification option.
Output: Modified hooks, new guard hook, updated config-loader, updated executor spec, install sync.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@hooks/nf-destructive-git-guard.js
@hooks/nf-post-edit-format.js
@hooks/config-loader.js
@agents/nf-executor.md
@bin/install.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Upgrade git stash safety + create MCP dispatch guard + extend post-edit verify</name>
  <files>
    hooks/nf-destructive-git-guard.js
    hooks/nf-mcp-dispatch-guard.js
    hooks/nf-post-edit-format.js
    hooks/config-loader.js
  </files>
  <action>
**1a. Upgrade nf-destructive-git-guard.js (lines 113-118):**
- Replace the stderr-only warning block with a conditional check:
  - Check if `.planning/current-activity.json` exists (using `fs.existsSync(path.join(gitRoot, '.planning', 'current-activity.json'))`)
  - If YES (nForma active): emit stdout JSON with `additionalContext` warning via `process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: '[nf-safety] WARNING: ...' } }))` — keep the same warning text about committing first
  - If NO (non-nForma): keep existing stderr-only behavior unchanged
- Add `const fs = require('fs');` and `const path = require('path');` at top (fs is not currently imported)
- Keep exit(0) in all paths (fail-open, warn-only)

**1b. Create hooks/nf-mcp-dispatch-guard.js (NEW PreToolUse hook):**
- Follow exact structure of nf-destructive-git-guard.js: shebang, 'use strict', stdin buffering, JSON parse, validateHookInput, loadConfig/shouldRunHook profile guard, try/catch fail-open
- Import `{ loadConfig, shouldRunHook, validateHookInput, SLOT_TOOL_SUFFIX }` from `./config-loader`
- Build a Set of valid MCP slot prefixes from SLOT_TOOL_SUFFIX keys: for each family key, generate patterns `mcp__${family}__` and `mcp__${family}-\\d+__` (numbered slots). Actually, simpler: extract tool_name, check if it matches regex `/^mcp__[a-z]+-?\d*__/` — then parse out the slot name and suffix
- Allowlist suffixes: `ping`, `health_check` — if tool suffix matches either, exit(0) silently
- For non-allowlisted MCP tool calls: extract the slot name from `mcp__<slot>__<suffix>`, verify the family (slot minus trailing -N) exists in SLOT_TOOL_SUFFIX keys
- If match found: emit stdout JSON with additionalContext warning: `"[nf-dispatch] WARNING: Direct MCP tool call detected (${toolName}). Per R3.2, use Task(subagent_type='nf-quorum-slot-worker') for quorum dispatch. Direct mcp__ calls bypass quorum enforcement and slot correlation. Allowlisted exceptions: ping, health_check."`
- If the tool_name doesn't match mcp__ pattern at all: exit(0) silently (not an MCP call)
- Export nothing (standalone hook)

**1c. Update config-loader.js:**
- Add `'nf-mcp-dispatch-guard'` to `standard` and `strict` Sets in HOOK_PROFILE_MAP
- Add `'nf-mcp-dispatch-guard': 50` (Normal priority) to DEFAULT_HOOK_PRIORITIES
- Add flat config keys to DEFAULT_CONFIG for post-edit verify:
  - `post_edit_verify_enabled: false`
  - `post_edit_verify_command: ""`
  - `post_edit_verify_timeout_ms: 15000`
  - `post_edit_verify_file_patterns: []`
  - `post_edit_verify_fail_mode: "warn"`

**1d. Extend nf-post-edit-format.js with optional verify step:**
- After the existing formatting block (after the formatter success/failure handling, before the final process.exit(0)):
  - Read config (already loaded as `config` variable)
  - Check `config.post_edit_verify_enabled === true` — if false, skip verify entirely
  - Check `config.post_edit_verify_command` is a non-empty string — if empty, skip
  - If `config.post_edit_verify_file_patterns` is a non-empty array, test the filePath against each regex pattern; if none match, skip. If array is empty, use existing JS_TS_RE as default
  - Run the verify command via `spawnSync(config.post_edit_verify_command, [], { shell: true, encoding: 'utf8', cwd, timeout: config.post_edit_verify_timeout_ms || 15000 })`
  - If verify fails (non-zero exit or error): emit additionalContext warning (NOT block). If `config.post_edit_verify_fail_mode` is "warn" (only valid mode), append to any existing additionalContext or create new stdout JSON output
  - If verify succeeds: optionally append "[post-edit-verify] Passed" to additionalContext
  - IMPORTANT: The verify step must run even if no formatter was found (the current code exits early at line 69 when no formatter exists). Restructure: instead of `process.exit(0)` at line 69, set a flag `formatterFound = false` and continue to the verify step. Only exit early if BOTH formatter is missing AND verify is disabled
  </action>
  <verify>
    - `node -c hooks/nf-destructive-git-guard.js` passes (syntax check)
    - `node -c hooks/nf-mcp-dispatch-guard.js` passes
    - `node -c hooks/nf-post-edit-format.js` passes
    - `node -c hooks/config-loader.js` passes
    - `node -e "const c = require('./hooks/config-loader'); console.log(c.HOOK_PROFILE_MAP.standard.has('nf-mcp-dispatch-guard'))"` prints `true`
    - `node -e "const c = require('./hooks/config-loader'); console.log(c.DEFAULT_HOOK_PRIORITIES['nf-mcp-dispatch-guard'])"` prints `50`
    - `node -e "const c = require('./hooks/config-loader'); console.log(c.DEFAULT_CONFIG.post_edit_verify_enabled)"` prints `false`
    - `grep 'current-activity' hooks/nf-destructive-git-guard.js` returns match
    - `grep 'SLOT_TOOL_SUFFIX' hooks/nf-mcp-dispatch-guard.js` returns match
    - `grep 'post_edit_verify' hooks/nf-post-edit-format.js` returns match
  </verify>
  <done>
    - nf-destructive-git-guard.js emits stdout JSON additionalContext when `.planning/current-activity.json` exists, stderr-only otherwise
    - nf-mcp-dispatch-guard.js warns on direct mcp__ tool calls (except ping/health_check) via additionalContext
    - nf-post-edit-format.js runs optional verify command when post_edit_verify_enabled is true in config
    - config-loader.js includes nf-mcp-dispatch-guard in standard/strict profiles with Normal priority, and has post_edit_verify_* keys in DEFAULT_CONFIG
  </done>
</task>

<task type="auto">
  <name>Task 2: Executor spec hardening + install sync</name>
  <files>
    agents/nf-executor.md
    bin/install.js
    hooks/dist/nf-destructive-git-guard.js
    hooks/dist/nf-mcp-dispatch-guard.js
    hooks/dist/nf-post-edit-format.js
    hooks/dist/config-loader.js
  </files>
  <action>
**2a. Harden agents/nf-executor.md:**
- In the `<execution_flow>` section, find the first step (load_project_state or equivalent)
- Add a new step BEFORE it (or as the first action within it) — a pre-flight PLAN.md existence check:
  ```
  **Pre-flight: Verify PLAN.md exists**
  Before executing any plan, verify the plan file exists and is readable:
  ```bash
  test -f "${PLAN_FILE}" || { echo "ERROR: Plan file ${PLAN_FILE} not found. Cannot execute."; exit 1; }
  ```
  If the plan file does not exist, STOP immediately and report the error. Do not attempt to reconstruct or infer the plan.
  ```
- Keep the change minimal — insert the pre-flight block, do not rewrite surrounding content

**2b. Register nf-mcp-dispatch-guard.js in bin/install.js:**
- Find the PreToolUse hook registration section (near line 2012-2020 where nf-destructive-git-guard is registered)
- Add a similar block right after it for nf-mcp-dispatch-guard:
  ```javascript
  // Register nForma MCP dispatch guard hook (PreToolUse — warn on direct MCP calls)
  const hasMcpDispatchGuardHook = settings.hooks.PreToolUse.some(entry =>
    entry.hooks && entry.hooks.some(h => h.command && h.command.includes('nf-mcp-dispatch-guard'))
  );
  if (!hasMcpDispatchGuardHook) {
    settings.hooks.PreToolUse.push({
      hooks: [{ type: 'command', command: buildHookCommand(targetDir, 'nf-mcp-dispatch-guard.js'), timeout: 10 }]
    });
    console.log(`  ${green}+${reset} Configured nForma MCP dispatch guard hook (PreToolUse)`);
  }
  ```
- Also add uninstall cleanup in the uninstall section (near line 1236-1246) — filter out nf-mcp-dispatch-guard entries from PreToolUse
- Add `'nf-mcp-dispatch-guard': 50` to the HOOK_PRIORITY_MAP in install.js (if one exists there — check the install.js priority map near line 34)

**2c. Sync hooks to dist and run install:**
- Copy all modified hook files to hooks/dist/:
  ```bash
  cp hooks/nf-destructive-git-guard.js hooks/dist/
  cp hooks/nf-mcp-dispatch-guard.js hooks/dist/
  cp hooks/nf-post-edit-format.js hooks/dist/
  cp hooks/config-loader.js hooks/dist/
  ```
- Run `node bin/install.js --claude --global` to install hooks to ~/.claude/hooks/
  </action>
  <verify>
    - `grep 'nf-mcp-dispatch-guard' bin/install.js` returns matches (registration + uninstall)
    - `grep 'PLAN_FILE' agents/nf-executor.md` returns match (pre-flight check)
    - `diff hooks/nf-mcp-dispatch-guard.js hooks/dist/nf-mcp-dispatch-guard.js` shows no diff
    - `diff hooks/config-loader.js hooks/dist/config-loader.js` shows no diff
    - `node bin/install.js --claude --global` exits 0
    - `grep 'nf-mcp-dispatch-guard' ~/.claude/settings.json` returns match (hook registered)
  </verify>
  <done>
    - Executor agent spec requires PLAN.md pre-flight check before any execution
    - nf-mcp-dispatch-guard.js registered in install.js (install + uninstall paths)
    - All modified hooks synced to hooks/dist/ and installed globally
    - `node bin/install.js --claude --global` succeeds with new hook registered
  </done>
</task>

</tasks>

<verification>
- All four improvements implemented per quorum consensus
- All hooks pass syntax check: `for f in hooks/nf-destructive-git-guard.js hooks/nf-mcp-dispatch-guard.js hooks/nf-post-edit-format.js hooks/config-loader.js; do node -c "$f"; done`
- New hook registered in install.js and installed globally
- Executor spec includes pre-flight check
- Fail-open maintained in all hook paths (no exit(1), no "block" decisions)
</verification>

<success_criteria>
- `echo '{"tool_name":"Bash","tool_input":{"command":"git stash"},"cwd":"/Users/jonathanborduas/code/QGSD"}' | node hooks/nf-destructive-git-guard.js` produces stdout JSON with additionalContext when .planning/current-activity.json exists
- `echo '{"tool_name":"mcp__codex-1__review"}' | node hooks/nf-mcp-dispatch-guard.js` produces stdout JSON warning about R3.2
- `echo '{"tool_name":"mcp__codex-1__ping"}' | node hooks/nf-mcp-dispatch-guard.js` produces no output (allowlisted)
- config-loader has nf-mcp-dispatch-guard in standard profile and post_edit_verify keys in DEFAULT_CONFIG
- Executor agent spec mentions PLAN.md pre-flight check
</success_criteria>

<output>
After completion, create `.planning/quick/233-implement-insights-driven-nforma-improve/233-SUMMARY.md`
</output>

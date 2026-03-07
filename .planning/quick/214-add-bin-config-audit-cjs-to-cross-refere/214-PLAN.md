---
phase: quick-214
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/config-audit.cjs
  - bin/config-audit.test.cjs
  - commands/nf/solve.md
  - hooks/nf-prompt.test.js
autonomous: true
formal_artifacts: none
requirements: [QUICK-214]

must_haves:
  truths:
    - "bin/config-audit.cjs reads providers.json and nf.json, cross-references entries, and outputs JSON with warnings and missing arrays"
    - "config-audit detects when agent_config is empty and all slots default to auth_type=api, defeating T1 tiered fallback"
    - "solve Step 0 runs config-audit alongside legacy migration and logs warnings to stderr"
    - "TC-PROMPT-FALLBACK-EMPTY-AGENTCONFIG test proves the simple failover rule is used (no FALLBACK-01) when agent_config is empty"
  artifacts:
    - path: "bin/config-audit.cjs"
      provides: "Config cross-reference audit script"
      contains: "providers.json"
    - path: "commands/nf/solve.md"
      provides: "Solve workflow with config-audit in Step 0"
      contains: "config-audit"
    - path: "hooks/nf-prompt.test.js"
      provides: "Regression test for empty agent_config fallback path"
      contains: "TC-PROMPT-FALLBACK-EMPTY-AGENTCONFIG"
  key_links:
    - from: "commands/nf/solve.md"
      to: "bin/config-audit.cjs"
      via: "node invocation in Step 0"
      pattern: "config-audit"
    - from: "bin/config-audit.cjs"
      to: "bin/providers.json"
      via: "require or readFileSync"
      pattern: "providers\\.json"
    - from: "bin/config-audit.cjs"
      to: "hooks/config-loader.js"
      via: "require config-loader for loadConfig"
      pattern: "config-loader"
  consumers:
    - artifact: "bin/config-audit.cjs"
      consumed_by: "commands/nf/solve.md"
      integration: "node invocation in Step 0 alongside legacy migration"
      verify_pattern: "config-audit"
---

<objective>
Add bin/config-audit.cjs to cross-reference providers.json against nf.json agent_config, wire it into solve Step 0, and add regression test TC-PROMPT-FALLBACK-EMPTY-AGENTCONFIG.

Purpose: Prevent silent feature inertness where FALLBACK-01 tiered quorum fallback is permanently defeated because agent_config is empty (all slots default to auth_type='api', making T1 always empty).

Output: config-audit script, solve workflow update, regression test
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@bin/providers.json
@hooks/config-loader.js
@hooks/nf-prompt.js
@hooks/nf-prompt.test.js
@commands/nf/solve.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create bin/config-audit.cjs and its unit test</name>
  <files>bin/config-audit.cjs, bin/config-audit.test.cjs</files>
  <action>
Create bin/config-audit.cjs as a CommonJS script with 'use strict' at top.

The script:
1. Reads bin/providers.json (resolve relative to __dirname) to get the full slot list (providers[].name)
2. Loads config via require('../hooks/config-loader').loadConfig() to get the merged nf.json config
3. Accepts optional --project-root=PATH arg (passed to loadConfig) and --json flag for machine output
4. Cross-references providers against config.agent_config:
   - For each provider slot name, check if agent_config has an entry
   - If agent_config is empty or missing entries, flag as "missing" with the slot name
   - Detect the "all-default" anti-pattern: if ALL active slots have auth_type defaulting to 'api' (either explicitly or by absence), emit a warning: "All slots default to auth_type=api — T1 tiered fallback (FALLBACK-01) will be permanently empty. Set auth_type='sub' for subscription-tier providers (codex-1, gemini-1, opencode-1, copilot-1) in ~/.claude/nf.json agent_config."
   - Check quorum_active: if quorum_active is non-empty, only audit those slots. If empty, audit all providers.json slots.
5. Output JSON to stdout: { warnings: string[], missing: string[] }
6. Exit 0 always (fail-open). Wrap everything in try/catch, on error write to stderr and output { warnings: [], missing: [], error: message }

Also create bin/config-audit.test.cjs using vitest (import { describe, it, expect } from 'vitest'):
- Test 1: empty agent_config produces "all-default" warning and lists all slots as missing
- Test 2: properly configured agent_config with sub/api mix produces no "all-default" warning
- Test 3: partial agent_config (some slots missing) lists missing ones but no "all-default" warning if at least one is sub
- Test 4: --json flag produces valid JSON output
- For tests, use spawnSync to invoke the script with controlled env (set NF_CLAUDE_JSON or create temp dirs with .claude/nf.json)
  </action>
  <verify>
Run `node bin/config-audit.cjs --json` and verify it outputs valid JSON with warnings/missing arrays.
Run `npx vitest run bin/config-audit.test.cjs` and verify all tests pass.
  </verify>
  <done>
bin/config-audit.cjs exists, reads providers.json and nf.json, detects the empty-agent_config anti-pattern, outputs structured JSON. Unit tests pass.
  </done>
</task>

<task type="auto">
  <name>Task 2: Wire config-audit into solve Step 0 and add FALLBACK regression test</name>
  <files>commands/nf/solve.md, hooks/nf-prompt.test.js</files>
  <action>
**Part A — Wire into solve Step 0:**

Edit commands/nf/solve.md to add a config audit sub-step after the legacy migration in Step 0. Insert BEFORE the "## Step 1" heading. Add this section:

```
### Step 0b: Config Audit

Run the config audit script to detect silent misconfigurations:

\`\`\`bash
AUDIT=$(node ~/.claude/nf-bin/config-audit.cjs --json --project-root=$(pwd) 2>/dev/null)
\`\`\`

If `~/.claude/nf-bin/config-audit.cjs` does not exist, fall back to `bin/config-audit.cjs` (CWD-relative).
If neither exists, skip this step silently.

Parse the JSON output:
- If `warnings` array is non-empty: log each warning to stderr as `"Step 0b: CONFIG WARNING: {warning}"`. These are non-blocking but visible in the solve output.
- If `missing` array is non-empty: log `"Step 0b: {missing.length} provider slots have no agent_config entry"`.

**Important:** This step is fail-open. Config audit failure must never block the diagnostic sweep.
```

**Part B — Add TC-PROMPT-FALLBACK-EMPTY-AGENTCONFIG regression test:**

Add a new test to hooks/nf-prompt.test.js after the existing TC-PROMPT-FALLBACK-T2-EXCLUDES-PRIMARIES test. The test verifies the empty-agent_config path:

```javascript
// TC-PROMPT-FALLBACK-EMPTY-AGENTCONFIG: when agent_config is {} (empty), all slots
// default to auth_type='api'. This means t1Unused (sub-CLI slots) is always empty,
// so the simple failover rule is used instead of FALLBACK-01 tiered sequence.
// The test verifies: (a) no FALLBACK-01 label appears, (b) the simple failover rule
// IS present, (c) T2 slot names are still enumerable in the output.
test('TC-PROMPT-FALLBACK-EMPTY-AGENTCONFIG: empty agent_config → no T1, simple failover rule', () => {
  // Create temp dir with git repo and nf.json that has empty agent_config
  // Set quorum_active to known slots but leave agent_config: {}
  // Run the hook with a quorum-triggering command
  // Assert: no 'FALLBACK-01' in additionalContext
  // Assert: 'Failover rule' appears (the simple skip rule)
  // Assert: dispatched slot names appear in Task(...) lines
});
```

Use the same pattern as TC-PROMPT-FALLBACK-T1-PRIORITY:
- Create tempDir with git init
- Write .claude/nf.json with quorum_active: ['codex-1', 'gemini-1', 'opencode-1', 'copilot-1'] and agent_config: {}
- Run hook with prompt: '/qgsd:plan-phase'
- Parse JSON output → hookSpecificOutput.additionalContext
- Assert ctx does NOT include 'FALLBACK-01' (since all slots are api, t1Unused is empty)
- Assert ctx includes 'Failover rule' (the simple rule from line 607)
- Assert dispatched slot Task() lines exist with at least some of the slot names
  </action>
  <verify>
Run `grep 'config-audit' commands/nf/solve.md` to confirm wiring.
Run `npx vitest run hooks/nf-prompt.test.js -t 'EMPTY-AGENTCONFIG'` and verify the new test passes.
Run full test suite `npm test` to confirm no regressions.
  </verify>
  <done>
solve.md Step 0 runs config-audit alongside legacy migration. TC-PROMPT-FALLBACK-EMPTY-AGENTCONFIG test passes, proving that empty agent_config produces the simple failover rule (no FALLBACK-01). Full test suite passes.
  </done>
</task>

</tasks>

<verification>
1. `node bin/config-audit.cjs --json` outputs valid JSON with warnings/missing arrays
2. `grep 'config-audit' commands/nf/solve.md` returns match in Step 0
3. `npx vitest run bin/config-audit.test.cjs` — all unit tests pass
4. `npx vitest run hooks/nf-prompt.test.js -t 'FALLBACK'` — all FALLBACK tests pass including the new one
5. `npm test` — no regressions in full suite
</verification>

<success_criteria>
- bin/config-audit.cjs detects the empty-agent_config anti-pattern and outputs structured warnings
- solve Step 0 invokes config-audit fail-open alongside legacy migration
- TC-PROMPT-FALLBACK-EMPTY-AGENTCONFIG proves the simple failover rule is active when agent_config is empty
- Full test suite passes with no regressions
</success_criteria>

<output>
After completion, create `.planning/quick/214-add-bin-config-audit-cjs-to-cross-refere/214-SUMMARY.md`
</output>

---
phase: quick-120
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/manage-agents-core.cjs
  - bin/manage-agents-blessed.cjs
  - bin/manage-agents.test.cjs
  - bin/manage-agents-blessed.test.cjs
  - bin/manage-agents.cjs
autonomous: true
requirements: [QUICK-120]

must_haves:
  truths:
    - "bin/manage-agents-core.cjs exists and exports readClaudeJson, writeClaudeJson, getGlobalMcpServers, and _pure block"
    - "bin/manage-agents-blessed.cjs requires manage-agents-core.cjs (not manage-agents.cjs)"
    - "bin/manage-agents.cjs is deleted"
    - "node --test bin/manage-agents.test.cjs passes against manage-agents-core.cjs"
    - "node --test bin/manage-agents-blessed.test.cjs passes against manage-agents-core.cjs"
  artifacts:
    - path: "bin/manage-agents-core.cjs"
      provides: "Pure functions and shared helpers for blessed TUI"
      exports: ["readClaudeJson", "writeClaudeJson", "getGlobalMcpServers", "_pure"]
    - path: "bin/manage-agents-blessed.cjs"
      provides: "Blessed TUI — updated import"
      contains: "require('./manage-agents-core.cjs')"
  key_links:
    - from: "bin/manage-agents-blessed.cjs"
      to: "bin/manage-agents-core.cjs"
      via: "require"
      pattern: "require\\('./manage-agents-core\\.cjs'\\)"
    - from: "bin/manage-agents.test.cjs"
      to: "bin/manage-agents-core.cjs"
      via: "require"
      pattern: "require\\('./manage-agents-core\\.cjs'\\)"
---

<objective>
Extract the shared logic layer out of the monolithic manage-agents.cjs into a new manage-agents-core.cjs, update the blessed TUI and test files to point at core, and delete the old file.

Purpose: Separate pure/shared functions from the inquirer interactive CLI so the blessed TUI has a clean, dependency-injected core without dragging in the full interactive layer.
Output: bin/manage-agents-core.cjs, updated blessed + tests, manage-agents.cjs deleted.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create bin/manage-agents-core.cjs</name>
  <files>bin/manage-agents-core.cjs</files>
  <action>
Create a new file bin/manage-agents-core.cjs by extracting everything from manage-agents.cjs that does NOT require inquirer. This is the shared logic layer for the blessed TUI.

**What to include (copy verbatim from manage-agents.cjs):**

1. All stdlib requires: fs, path, os, https, http, child_process
2. The external requires: `const { resolveCli } = require('./resolve-cli.cjs')` and `const { updateAgents, getUpdateStatuses } = require('./update-agents.cjs')`
3. All path constants (lines 14-18): CLAUDE_JSON_PATH, CLAUDE_JSON_TMP, QGSD_JSON_PATH, CCR_CONFIG_PATH, UPDATE_LOG_PATH
4. PROVIDER_PRESETS constant (lines 22-27)
5. Core helper functions (lines 32-50): readClaudeJson, writeClaudeJson, getGlobalMcpServers
6. Network helpers (lines 53-344): fetchProviderModels, probeProviderUrl, classifyProbeResult, writeKeyStatus, formatTimestamp, buildDashboardLines, detectUpgrade, maskKey, shortProvider
7. Providers JSON helpers (lines 1584-1601): PROVIDERS_JSON_PATH, PROVIDERS_JSON_TMP, readProvidersJson, writeProvidersJson
8. CCR_KEY_NAMES constant (lines 1882-1887)
9. probeAllSlots (lines 1294-1319)
10. runAutoUpdateCheck (lines 1413-1484)
11. liveDashboard (lines 1485-1582)
12. All _pure functions (lines 2181-2768): deriveKeytarAccount, buildKeyStatus, buildAgentChoiceLabel, applyKeyUpdate, applyCcrProviderUpdate, readQgsdJson, writeQgsdJson, writeUpdatePolicy, slotToFamily, getWlDisplay, readCcrConfigSafe, getCcrProviderForSlot, getKeyInvalidBadge, findPresetForUrl, buildCloneEntry, POLICY_MENU_CHOICES, buildPolicyChoices, buildUpdateLogEntry, UPDATE_LOG_DEFAULT_MAX_AGE_MS, parseUpdateLogErrors, buildBackupPath, buildRedactedEnv, buildExportData, validateImportSchema

**Do NOT include:**
- require('inquirer') — stays in manage-agents.cjs interactive layer only
- buildPresetChoices() — uses inquirer.Separator(), remove from _pure export and do NOT include in core (it is not used by blessed, which has its own PROVIDER_PRESETS)
- All interactive async functions: mainMenu, listAgents, addAgent, editAgent, removeAgent, reorderAgents, checkAgentHealth, batchRotateKeys, tuneTimeouts, setUpdatePolicy, addSubprocessProvider, editSubprocessProvider, manageCcrProviders, cloneSlot, performExport, performImport, probeWithRetryOrCancel, backupClaudeJson (this function is only used by performImport, not by blessed)

**Exports at bottom of file:**

```javascript
module.exports = { readClaudeJson, writeClaudeJson, getGlobalMcpServers };

module.exports._pure = {
  deriveKeytarAccount,
  maskKey,
  buildKeyStatus,
  buildAgentChoiceLabel,
  applyKeyUpdate,
  applyCcrProviderUpdate,
  readQgsdJson,
  writeQgsdJson,
  slotToFamily,
  getWlDisplay,
  readCcrConfigSafe,
  getCcrProviderForSlot,
  getKeyInvalidBadge,
  findPresetForUrl,
  buildCloneEntry,
  classifyProbeResult,
  writeKeyStatus,
  formatTimestamp,
  buildDashboardLines,
  buildTimeoutChoices,
  applyTimeoutUpdate,
  buildPolicyChoices,
  buildUpdateLogEntry,
  parseUpdateLogErrors,
  probeAllSlots,
  liveDashboard,
  runAutoUpdateCheck,
  buildBackupPath,
  buildRedactedEnv,
  buildExportData,
  validateImportSchema,
  readProvidersJson,
  writeProvidersJson,
  writeUpdatePolicy,
  detectUpgrade,
  shortProvider,
  fetchProviderModels,
  probeProviderUrl,
  maskKey,
};
```

Add `'use strict';` at the top. No shebang line (it is a module, not a CLI entrypoint).
  </action>
  <verify>node -e "const m = require('./bin/manage-agents-core.cjs'); console.log(Object.keys(m._pure).join(', '))"</verify>
  <done>Command prints the list of pure function names without errors</done>
</task>

<task type="auto">
  <name>Task 2: Update imports in blessed, both test files; delete manage-agents.cjs</name>
  <files>
    bin/manage-agents-blessed.cjs
    bin/manage-agents.test.cjs
    bin/manage-agents-blessed.test.cjs
    bin/manage-agents.cjs
  </files>
  <action>
**1. bin/manage-agents-blessed.cjs** — change one line:
- Line 11: `const core = require('./manage-agents.cjs');` → `const core = require('./manage-agents-core.cjs');`
No other changes needed — the rest of the file still works because core exports the same shape.

**2. bin/manage-agents.test.cjs** — change two lines:
- Line 4: `const { _pure } = require('./manage-agents.cjs');` → `const { _pure } = require('./manage-agents-core.cjs');`
- Line 1063: `const { runAutoUpdateCheck } = require('./manage-agents.cjs')._pure;` → `const { runAutoUpdateCheck } = require('./manage-agents-core.cjs')._pure;`
- Also remove the test for `buildPresetChoices` — search for the test block that calls `buildPresetChoices` and delete it, since that function is not in core (it requires inquirer.Separator and is no longer exported). Remove the destructuring of `buildPresetChoices` from the require line at the top as well.

**3. bin/manage-agents-blessed.test.cjs** — change three occurrences:
- Line 49: `_pure: require('./manage-agents.cjs')._pure,` → `_pure: require('./manage-agents-core.cjs')._pure,`
- Line 64: `const CORE_PATH = require.resolve('./manage-agents.cjs');` → `const CORE_PATH = require.resolve('./manage-agents-core.cjs');`
- Line 243: `const { readQgsdJson, writeQgsdJson } = require('./manage-agents.cjs')._pure;` → `const { readQgsdJson, writeQgsdJson } = require('./manage-agents-core.cjs')._pure;`

**4. Delete bin/manage-agents.cjs:**
`fs.unlinkSync` or shell: `rm bin/manage-agents.cjs`
Run via Bash: `rm /Users/jonathanborduas/code/QGSD/bin/manage-agents.cjs`
  </action>
  <verify>
1. node --test bin/manage-agents.test.cjs
2. node --test bin/manage-agents-blessed.test.cjs
3. ls bin/manage-agents.cjs 2>&amp;1 | grep "No such"
  </verify>
  <done>
Both test suites pass with 0 failures. manage-agents.cjs does not exist on disk.
  </done>
</task>

<task type="auto">
  <name>Task 3: Run full test suite and commit</name>
  <files></files>
  <action>
Run the full test suite to confirm nothing is broken:

```
cd /Users/jonathanborduas/code/QGSD && npm test
```

If any tests fail, diagnose and fix (most likely: a stale require path or a missing export in core).

Then commit:
```
git add bin/manage-agents-core.cjs bin/manage-agents-blessed.cjs bin/manage-agents.test.cjs bin/manage-agents-blessed.test.cjs
git rm bin/manage-agents.cjs
git commit -m "refactor: extract _pure functions from manage-agents.cjs into manage-agents-core.cjs"
```
  </action>
  <verify>npm test exits 0</verify>
  <done>npm test passes. git log shows the refactor commit. bin/manage-agents.cjs absent from working tree.</done>
</task>

</tasks>

<verification>
- node --test bin/manage-agents.test.cjs passes (all _pure tests run against core)
- node --test bin/manage-agents-blessed.test.cjs passes (blessed resolves core correctly)
- npm test exits 0 (no regressions across full suite)
- bin/manage-agents.cjs does not exist
- bin/manage-agents-core.cjs exports same _pure shape as manage-agents.cjs did (minus buildPresetChoices)
</verification>

<success_criteria>
manage-agents-core.cjs is the single source of truth for shared pure functions and file helpers. The blessed TUI requires core directly. manage-agents.cjs is deleted. All tests pass.
</success_criteria>

<output>
After completion, create .planning/quick/120-extract-pure-functions-from-manage-agent/120-SUMMARY.md
</output>

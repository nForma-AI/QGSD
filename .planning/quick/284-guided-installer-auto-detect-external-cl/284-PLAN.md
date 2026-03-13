---
phase: quick-284
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/install.js
  - test/install-guided-providers.test.cjs
autonomous: true
formal_artifacts: none
must_haves:
  truths:
    - "CCR slots (claude-1..6) are always installed regardless of mode"
    - "External CLIs are auto-detected via resolveCli and reported with checkmarks"
    - "Interactive users are prompted to choose which detected CLIs to enable"
    - "Non-interactive installs default to CCR-only with a summary of skipped detections"
    - "--all-providers flag restores old behavior (all 12 slots)"
    - "Dual-subscription slots are only offered when their primary is selected"
  artifacts:
    - path: "bin/install.js"
      provides: "Guided provider selection in installer"
      contains: "classifyProviders"
    - path: "test/install-guided-providers.test.cjs"
      provides: "Unit tests for classification and detection"
      contains: "classifyProviders"
  key_links:
    - from: "bin/install.js"
      to: "bin/resolve-cli.cjs"
      via: "require('./resolve-cli.cjs')"
      pattern: "resolveCli"
    - from: "bin/install.js:ensureMcpSlotsFromProviders"
      to: "selectedProviderSlots"
      via: "filter loop skip"
      pattern: "selectedProviderSlots"
---

<objective>
Transform `bin/install.js` from blindly registering all 12 MCP provider slots to a guided
experience that auto-detects installed external CLIs, always ships CCR (claude-1..6) slots,
and lets users opt-in to external providers interactively.

Purpose: New users running `npx @nforma.ai/nforma@staging` currently get 12 broken MCP entries
for CLIs they don't have. This wastes quorum budget on dead slots and confuses onboarding.

Output: Updated installer with provider tiers, CLI detection, interactive prompt, non-interactive
fallback, and `--all-providers` escape hatch. Plus unit tests for the new logic.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@bin/install.js
@bin/resolve-cli.cjs
@bin/providers.json
</context>

<tasks>

<task type="auto">
  <name>Task 1a: Add classifyProviders, detectExternalClis, and CLI_INSTALL_HINTS to install.js</name>
  <files>bin/install.js</files>
  <action>
Add the following new functions and constants to `bin/install.js`:

**1. Flag parsing (near line 59, with other flag parsing):**
```js
const hasAllProviders = args.includes('--all-providers');
```

**2. Module-level filter variable (near line 62, after selectedRuntimes):**
```js
let selectedProviderSlots = null; // null = all (backward compat), array = filtered
```

**3. Install hints constant (near top, after color definitions):**
```js
const CLI_INSTALL_HINTS = {
  codex:    'npm i -g @openai/codex',
  gemini:   'npm i -g @google/gemini-cli',
  opencode: 'npm i -g opencode',
  copilot:  'npm i -g @githubnext/github-copilot-cli',
};
```

**4. Classification + detection functions (before `ensureMcpSlotsFromProviders`, ~line 240):**

`classifyProviders(providers)` — Iterate providers array. Classify each:
- If `path.basename(p.cli || '') === 'ccr'` => ccr tier
- Else if `p.name.endsWith('-2')` => dualSubscription tier. Record `parent: p.name.replace(/-2$/, '-1')` and `bareCli` (see below).
- Else => externalPrimary tier. Record `bareCli` (see below).

**CRITICAL bareCli derivation:** Use `path.basename(p.cli || '') || p.mainTool` — cli-path-first, NOT mainTool-first. Reason: copilot-1 has `mainTool: "ask"` (a subcommand) but `cli: "/opt/homebrew/bin/copilot"` (the actual binary). Using mainTool first would resolve to "ask" which is wrong. The cli field contains the actual binary path; basename it to get "copilot", "codex", "gemini", "opencode". Only fall back to mainTool when cli is empty/missing.

Return `{ ccr, externalPrimary, dualSubscription }`.

`detectExternalClis(externalPrimary)` — Import `resolveCli` from `./resolve-cli.cjs`. Map each provider: call `resolveCli(p.bareCli)`. If result !== p.bareCli, `found: true, resolvedPath: result`. Otherwise `found: false, resolvedPath: null`. Return enriched array (spread original provider props + found/resolvedPath).

**5. Export both functions** from the module.exports block (line 2889-2891) for testing:
```js
module.exports = { validateHookPaths, fileHash, generateManifest, saveLocalPatches, reportLocalPatches, PATCHES_DIR_NAME, MANIFEST_NAME, classifyProviders, detectExternalClis };
```
  </action>
  <verify>
Run `node -e "const m = require('./bin/install.js'); console.log(typeof m.classifyProviders, typeof m.detectExternalClis)"` from repo root — should print "function function".

Verify bareCli correctness: `node -e "const m = require('./bin/install.js'); const p = require('./bin/providers.json').providers; const c = m.classifyProviders(p); const cop = c.externalPrimary.find(x => x.name === 'copilot-1'); console.log(cop.bareCli)"` — MUST print "copilot" (not "ask").
  </verify>
  <done>
    - classifyProviders correctly buckets providers into ccr/externalPrimary/dualSubscription
    - bareCli for copilot-1 is "copilot" (from cli field), not "ask" (from mainTool)
    - detectExternalClis returns found/notFound for each external CLI via resolveCli
    - Both functions are exported for testing
  </done>
</task>

<task type="auto">
  <name>Task 1b: Wire promptProviders and filtering into install flow</name>
  <files>bin/install.js</files>
  <action>
Wire the new functions into the installer flow. This task modifies two areas: `ensureMcpSlotsFromProviders` and the bottom-of-file entry point logic.

**1. Modify `ensureMcpSlotsFromProviders()` (line 295):**

Add filter at the top of the provider loop:
```js
for (const provider of providers) {
  const providerName = provider.name;
  if (selectedProviderSlots && !selectedProviderSlots.includes(providerName)) {
    continue;
  }
  // ... existing logic unchanged
}
```

**2. Create `promptProviders(callback)` function (near line 2610, after `promptRuntime`):**

This function handles the interactive provider selection flow. Steps:
- Read providers.json, call `classifyProviders()` then `detectExternalClis()` on externalPrimary.
- Print header: "Quorum agent setup:" then "Claude slots (claude-1..6) are installed by default."
- Print detection results table: for each external primary, show `checkmark name — resolvedPath` or `cross name — not found (hint from CLI_INSTALL_HINTS)`.
- Collect CCR slot names into `selected` array (always included).
- If zero detected CLIs: print "No external CLIs detected. Installing Claude slots only." Set `selectedProviderSlots = selected`, call `callback()`, return.
- If detected CLIs exist, prompt with readline:
  ```
  Enable detected CLIs as quorum agents?
  1) Yes, enable all detected (list)  [default]
  2) Let me choose
  3) Skip -- Claude slots only
  ```
- Choice 1 (or empty/Enter): add all detected primary slot names to `selected`.
- Choice 2: for each detected CLI, prompt `Enable <name>? [Y/n]:` — add to selected if yes.
- Choice 3: no external slots added.
- For each selected primary, check if it has a dual-subscription sibling (from dualSubscription array where `parent === primaryName`). If found AND primary is selected, prompt `Enable <name>-2 (dual-subscription slot)? [y/N]:` — add if yes.
- Set `selectedProviderSlots = selected`, call `callback()`.

Use readline.createInterface pattern matching existing `promptRuntime` (with close guard for cancelled input).

**3. Wire into main install flow (lines 2851-2886) — single coherent pattern:**

The `--all-providers` escape hatch uses ONE early-exit: right after flag parsing (near line 62), the default `selectedProviderSlots = null` already means "all providers". The key is ensuring the filtered-array paths below do NOT run when `hasAllProviders` is true.

**Branch: `selectedRuntimes.length > 0` (line 2867):**
- Sub-branch `hasGlobal || hasLocal` (non-interactive, line 2870-2871): This is the `node bin/install.js --claude --global` path. BEFORE calling `installAllRuntimes`, add provider detection:
  ```js
  if (!hasAllProviders && selectedRuntimes.includes('claude')) {
    const provs = require('./providers.json').providers;
    const classified = classifyProviders(provs);
    // CCR-only: collect CCR slot names
    selectedProviderSlots = classified.ccr.map(p => p.name);
    // In non-interactive flag mode, print a one-line summary of what was detected but skipped
    const detected = detectExternalClis(classified.externalPrimary);
    const foundNames = detected.filter(d => d.found).map(d => d.name);
    if (foundNames.length > 0) {
      console.log(`  ${yellow}Detected CLIs not enabled: ${foundNames.join(', ')}. Use --all-providers to include them.${reset}`);
    }
  }
  installAllRuntimes(selectedRuntimes, hasGlobal, false);
  ```
- Sub-branch `!hasGlobal && !hasLocal` (interactive, line 2868-2869): Chain through promptProviders when claude is selected:
  ```js
  if (!hasAllProviders && selectedRuntimes.includes('claude')) {
    promptProviders(() => { promptLocation(selectedRuntimes); });
  } else {
    promptLocation(selectedRuntimes);
  }
  ```

**Branch: fully interactive else (line 2876-2886):**
- Non-interactive (!process.stdin.isTTY, line 2878): Add CCR-only filtering before installAllRuntimes:
  ```js
  if (!hasAllProviders) {
    const provs = require('./providers.json').providers;
    const classified = classifyProviders(provs);
    selectedProviderSlots = classified.ccr.map(p => p.name);
    const detected = detectExternalClis(classified.externalPrimary);
    const foundNames = detected.filter(d => d.found).map(d => d.name);
    if (foundNames.length > 0) {
      console.log(`  Detected: ${foundNames.join(', ')}. Run with --all-providers to include.`);
    }
  }
  installAllRuntimes(['claude'], true, false);
  ```
- Interactive (line 2881-2884): Chain promptProviders into the promptRuntime callback:
  ```js
  promptRuntime((runtimes) => {
    if (!hasAllProviders && runtimes.includes('claude')) {
      promptProviders(() => { promptLocation(runtimes); });
    } else {
      promptLocation(runtimes);
    }
  });
  ```

**Important:** Do NOT change the `install()` function itself or its hook/file installation logic. Only `ensureMcpSlotsFromProviders()` gets the filter. The rest of install (hooks, workflows, config) remains unchanged.
  </action>
  <verify>
Run `grep -c 'selectedProviderSlots' bin/install.js` — should be >= 7 (declaration, ensureMcpSlots filter, CCR-only setter in flag branch, CCR-only setter in non-TTY branch, promptProviders setter, and usage sites).

Run `grep 'all-providers' bin/install.js` — should match flag parsing line and at least 3 guard checks (`!hasAllProviders`).

Run `grep 'promptProviders' bin/install.js` — should show function definition and at least 2 call sites.

Verify the filter in ensureMcpSlots: `grep -A3 'selectedProviderSlots.*includes' bin/install.js` — should show the continue statement.
  </verify>
  <done>
    - ensureMcpSlotsFromProviders respects selectedProviderSlots filter
    - Flag-based path (--claude --global) runs CCR-only detection + filtering, not all 12 slots
    - Interactive flow chains promptProviders before promptLocation
    - Non-interactive flow defaults to CCR-only with detection summary
    - --all-providers bypasses all filtering via consistent !hasAllProviders guards
  </done>
</task>

<task type="auto">
  <name>Task 2: Add unit tests for provider classification, detection, and filtering</name>
  <files>test/install-guided-providers.test.cjs</files>
  <action>
Create `test/install-guided-providers.test.cjs` using the project's test pattern (Node assert + describe/it via node:test).

**Test classifyProviders:**
- Feed it the full providers.json array. Assert:
  - `ccr` array has 6 items (claude-1..6), all with cli basename "ccr"
  - `externalPrimary` has 4 items: codex-1, gemini-1, opencode-1, copilot-1
  - `dualSubscription` has 2 items: codex-2, gemini-2
  - Each dualSubscription entry has correct `parent` (codex-1, gemini-1)
  - **CRITICAL:** copilot-1 bareCli is "copilot" (NOT "ask"). This validates the cli-path-first derivation.
  - codex-1 bareCli is "codex", gemini-1 is "gemini", opencode-1 is "opencode"

**Test detectExternalClis:**
- Test with real resolveCli since it's safe (just does which/fs checks). Call detectExternalClis on the externalPrimary output from classifyProviders.
- Assert each result has `found` (boolean) and `resolvedPath` (string or null).
- Assert that if `found === true`, `resolvedPath` is not equal to `bareCli` (it's a full path).
- Assert that if `found === false`, `resolvedPath` is null.

**Test selectedProviderSlots filter logic (unit-level):**
- Simulate what ensureMcpSlotsFromProviders does: given a providers array and selectedProviderSlots = ['claude-1', 'claude-2', 'codex-1'], verify only those 3 would pass the filter (filter logic test, not full ensureMcpSlots call).
- Test that `selectedProviderSlots = null` (default) passes ALL providers through.

**Test bareCli edge case — copilot mainTool vs cli:**
- Dedicated test: construct a minimal provider object `{ name: 'copilot-1', mainTool: 'ask', cli: '/opt/homebrew/bin/copilot' }` and run classifyProviders on `[provider]`. Assert bareCli is "copilot".
- Construct a provider with empty cli: `{ name: 'test-1', mainTool: 'mytool', cli: '' }`. Assert bareCli falls back to "mytool".

**Test --all-providers flag parsing:**
- Verify that `['--all-providers'].includes('--all-providers')` is true (sanity). Can also grep the source to confirm the flag is parsed.

Run with: `node --test test/install-guided-providers.test.cjs`
  </action>
  <verify>
`node --test test/install-guided-providers.test.cjs` — all tests pass, zero failures.
  </verify>
  <done>
    - classifyProviders correctly buckets all 12 providers into 3 tiers
    - bareCli for copilot-1 is "copilot" (regression test for the mainTool/cli priority bug)
    - detectExternalClis enriches providers with found/resolvedPath
    - Filter logic correctly includes/excludes based on selectedProviderSlots
    - All tests green
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Guided installer with CLI auto-detection and interactive provider selection</what-built>
  <how-to-verify>
    1. Interactive test: Run `node bin/install.js` in a TTY terminal
       - Should show ASCII banner, then runtime prompt
       - After selecting Claude (1), should show "Quorum agent setup" with detection results
       - Detected CLIs should show green checkmarks with paths
       - Missing CLIs should show red crosses with install hints
       - Prompt should offer 3 choices (all detected / choose / skip)
       - After selection, should proceed to location prompt as normal

    2. Flag-based non-interactive test: Run `node bin/install.js --claude --global`
       - Should install CCR slots only (not all 12)
       - Should print one-line summary of detected-but-skipped CLIs if any found
       - Verify ~/.claude.json mcpServers has claude-1..6 but NOT codex/gemini/etc (unless --all-providers)

    3. Pipe non-interactive test: Run `echo | node bin/install.js`
       - Should default to Claude Code global install with CCR-only slots
       - Should print detection summary

    4. All-providers test: Run `node bin/install.js --claude --global --all-providers`
       - Should install all 12 slots (old behavior, no prompt, no filtering)

    5. Verify no regression: Check ~/.claude.json mcpServers — CCR slots should always be present
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<verification>
- `node --test test/install-guided-providers.test.cjs` passes
- `grep 'classifyProviders' bin/install.js` shows function definition and usage
- `grep 'selectedProviderSlots' bin/install.js` shows declaration, filter, and setters
- `grep 'all-providers' bin/install.js` shows flag parsing and guard checks
- `grep 'resolveCli' bin/install.js` shows import from resolve-cli.cjs
- copilot-1 bareCli resolves to "copilot" (not "ask") — verified by test
- Flag-based install (--claude --global) runs CCR-only filtering, not all 12 slots
- Interactive install flow shows detection table and 3-choice prompt
- Non-interactive install defaults to CCR-only
</verification>

<success_criteria>
- New users get only working MCP slots (CCR always, external only if CLI is installed and user opts in)
- Power users can use --all-providers to get old behavior
- Flag-based installs (--claude --global) correctly filter to CCR-only, not all 12
- copilot-1 is detected via "copilot" binary, not "ask" subcommand
- Existing installs are not broken (ensureMcpSlotsFromProviders skip logic only adds, never removes)
- Unit tests cover classification, detection, filter logic, and the copilot bareCli edge case
</success_criteria>

<output>
After completion, create `.planning/quick/284-guided-installer-auto-detect-external-cl/284-SUMMARY.md`
</output>

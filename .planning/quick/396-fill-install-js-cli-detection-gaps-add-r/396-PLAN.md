---
phase: quick-396
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/install.js
  - bin/providers.json
autonomous: true
requirements: [QUICK-396]
formal_artifacts:
  - module: installer
    invariants_checked:
      - OverridesPreserved
    notes: >
      --rescan calls ensureMcpSlotsFromProviders() which is additive-only (never modifies
      existing mcpServers entries). This satisfies OverridesPreserved: once project overrides
      are set they cannot be cleared by rescan. Confirmed: ensureMcpSlotsFromProviders() skips
      slots that already exist (line 533: hasOwnProperty check before adding).
  - module: recruiting
    invariants_checked:
      - FullRecruitment
    notes: >
      Auto-including CCR slots when binary found ensures quorum slot count can reach MaxSize
      (previously CCR slots were deferred, reducing available responsive slots). Liveness
      unaffected: WF guarantees on TrySubSlot still hold for newly-included CCR slots.
  - module: prefilter
    invariants_checked:
      - PreFilterTerminates
    notes: >
      Prefilter termination depends on slot responsiveness, not on how slots are enrolled.
      No impact from this change.

must_haves:
  truths:
    - "Running `node bin/install.js --rescan` detects currently-installed CLIs, adds any missing MCP slots to ~/.claude.json, and exits without full reinstall"
    - "When CCR binary is found during promptProviders, all ccr-* slots are auto-included in selectedProviderSlots without requiring individual per-slot prompting"
    - "providers.json has no hardcoded absolute paths in `cli` fields — all entries use null or bare names, with dynamic resolution via resolveCli at runtime"
    - "--rescan output clearly shows added vs already-present slots (diff output)"
    - "--rescan respects installer idempotency: calling it twice produces no additional changes on the second run"
  artifacts:
    - path: "bin/install.js"
      provides: "--rescan flag handler and updated promptProviders CCR auto-include logic"
      contains: "hasRescan"
    - path: "bin/providers.json"
      provides: "providers registry with null cli fields"
      contains: "\"cli\": null"
  key_links:
    - from: "bin/install.js --rescan handler"
      to: "ensureMcpSlotsFromProviders()"
      via: "direct call with selectedProviderSlots pre-populated from detection"
      pattern: "hasRescan"
    - from: "promptProviders()"
      to: "detectCcrCli()"
      via: "if ccrStatus.found, auto-push all ccr-slot names"
      pattern: "ccrStatus\\.found"
    - from: "classifyProviders()"
      to: "providers.json cli field"
      via: "path.basename(p.cli || '') — works correctly with null"
      pattern: "path\\.basename"
---

<objective>
Fill three install.js CLI detection gaps:
1. Add `--rescan` flag that re-runs CLI detection post-install and syncs missing MCP slots to ~/.claude.json without a full reinstall.
2. Auto-include CCR slots in `promptProviders` when the ccr binary is found, instead of deferring to /nf:mcp-setup.
3. Strip hardcoded absolute CLI paths from providers.json so path resolution is always dynamic via resolveCli.

Purpose: Users who install CLIs after nForma install currently have no lightweight re-sync path. CCR users must manually run /nf:mcp-setup even when ccr is already installed. Hardcoded paths in providers.json break on non-Homebrew systems.
Output: Updated bin/install.js with --rescan flag + CCR auto-include; updated bin/providers.json with null cli fields.
</objective>

<execution_context>
@./.claude/nf/workflows/execute-plan.md
@./.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/quick/396-fill-install-js-cli-detection-gaps-add-r/scope-contract.json
@bin/resolve-cli.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Strip hardcoded cli paths from providers.json</name>
  <files>bin/providers.json</files>
  <action>
    Set the `cli` field to `null` for every provider entry that currently has a hardcoded absolute path. This affects:
    - codex-1: `"/opt/homebrew/bin/codex"` → `null`
    - gemini-1: `"/opt/homebrew/bin/gemini"` → `null`
    - opencode-1: `"/opt/homebrew/bin/opencode"` → `null`
    - copilot-1: `"/opt/homebrew/bin/copilot"` → `null`
    - ccr-1 through ccr-6: `"/opt/homebrew/bin/ccr"` → `null`
    - claude-1: `"/Users/jonathanborduas/.local/bin/claude"` → `null` (user-specific path, must not be hardcoded in repo)

    Do NOT remove the `cli` key from the JSON object — set the value to `null` so consumers
    that call `p.cli || ''` or `path.basename(p.cli || '')` continue to work correctly.

    The `mainTool` field (bare binary name like "codex", "gemini", "ccr") is what `resolveCli`
    uses at runtime in detectExternalClis and detectCcrCli — no code change needed for resolution.

    Verify `classifyProviders` still works: it uses `path.basename(p.cli || '')` → with null,
    `p.cli || ''` returns `''`, then `path.basename('')` returns `''`, so `bareCli` falls back to
    `|| p.mainTool`. This is correct behavior.
  </action>
  <verify>
    node -e "const p = require('./bin/providers.json'); const bad = p.providers.filter(x => x.cli && x.cli.startsWith('/')); console.log(bad.length === 0 ? 'OK: no hardcoded paths' : 'FAIL: ' + bad.map(x=>x.name+':'+x.cli).join(', '))"
  </verify>
  <done>All provider entries in providers.json have `"cli": null`. No hardcoded absolute paths remain. The node verification command prints "OK: no hardcoded paths".</done>
</task>

<task type="auto">
  <name>Task 2: Auto-include CCR slots in promptProviders + add --rescan flag</name>
  <files>bin/install.js</files>
  <action>
    ### Part A — CCR auto-include in promptProviders()

    In `promptProviders()` (around line 3417), after computing `detected` and `classified`,
    add auto-include logic for CCR slots:

    1. Call `detectCcrCli()` (already defined at line 463) to check if ccr binary is found.
    2. Identify CCR-type entries in `externalPrimary` by checking `p.bareCli === 'ccr'` OR
       `p.display_type === 'claude-code-router'`. These are the ccr-* slots.
    3. If `ccrStatus.found`:
       - Push all CCR slot names to `selected` automatically (do NOT show them in the
         per-CLI prompt since they're a single binary serving multiple presets)
       - Print a green checkmark line: `  ✓ ccr binary found — auto-including N CCR slots (ccr-1..ccr-N)`
    4. Remove the existing `classified.ccr` block at lines 3437-3444 (the block that prints
       "Install/enable ccr..." message) — it's now superseded. If ccr is NOT found, print
       the warning about installing ccr instead.

    The `detected` array passed to the "Enable detected CLIs" prompt should EXCLUDE ccr-*
    entries (filter them out before building `foundClis`) so they don't appear as individual
    options — they're handled as a batch.

    ### Part B — --rescan flag

    1. Add flag declaration near the other flags (~line 88-95):
       ```js
       const hasRescan = args.includes('--rescan');
       ```

    2. Add a `--rescan` handler block BEFORE the "Main logic" section (after the `hasFormal`
       and `hasMigrateSlots` blocks, around line 3808). Pattern matches `hasResetBreaker` etc:

       ```js
       // RESCAN-01: --rescan re-detects installed CLIs and syncs missing MCP slots to ~/.claude.json
       if (hasRescan) {
         console.log(`\n  ${cyan}Rescanning for CLI providers...${reset}\n`);
         const provs = require('./providers.json').providers;
         const classified = classifyProviders(provs);

         // Detect external primaries
         const detected = detectExternalClis(classified.externalPrimary);
         const foundNames = detected.filter(d => d.found).map(d => d.name);

         // Detect CCR separately: if ccr binary found, include all ccr-* slots
         const ccrStatus = detectCcrCli();
         const ccrNames = ccrStatus.found ? classified.externalPrimary
           .filter(p => p.bareCli === 'ccr' || p.display_type === 'claude-code-router')
           .map(p => p.name) : [];

         // Note: ccr-* entries are in externalPrimary (type: 'subprocess'), not classified.ccr
         // Filter them out of foundNames to avoid double-counting
         const nonCcrFoundNames = foundNames.filter(n => !ccrNames.includes(n));

         selectedProviderSlots = [...nonCcrFoundNames, ...ccrNames];

         if (selectedProviderSlots.length === 0) {
           console.log(`  ${yellow}No external CLIs detected. Install CLIs first, then run --rescan.${reset}\n`);
           process.exit(0);
         }

         // Print detection summary
         for (const d of detected) {
           const isCcr = ccrNames.some(n => n === d.name) ||
             d.bareCli === 'ccr' || d.display_type === 'claude-code-router';
           if (isCcr) continue; // CCR slots printed as a group below
           if (d.found) {
             console.log(`  ${green}✓${reset} ${d.name} — ${d.resolvedPath}`);
           }
         }
         if (ccrStatus.found && ccrNames.length > 0) {
           console.log(`  ${green}✓${reset} ccr binary found (${ccrStatus.resolvedPath}) — ${ccrNames.length} CCR slots`);
         }
         console.log('');

         // Sync missing slots to ~/.claude.json
         ensureMcpSlotsFromProviders();

         process.exit(0);
       }
       ```

    ### Idempotency note (formal constraint)
    `ensureMcpSlotsFromProviders()` already guards with `hasOwnProperty` before adding
    entries — calling --rescan twice is safe. Do NOT add a `--dry-run` variant in this task
    (out of scope).

    ### Do NOT change
    - Function signatures of classifyProviders, detectExternalClis, detectCcrCli, ensureMcpSlotsFromProviders
    - unified-mcp-server.mjs
    - Any test files
  </action>
  <verify>
    # 1. Verify --rescan flag is parseable and exits cleanly when no CLIs present
    # (Use a temp providers.json with no found CLIs)
    node bin/install.js --rescan 2>&1 | head -5

    # 2. Verify hasRescan is declared
    grep -n 'hasRescan' bin/install.js

    # 3. Verify promptProviders now calls detectCcrCli
    grep -n 'ccrStatus' bin/install.js | head -10

    # 4. Verify no syntax errors
    node --check bin/install.js && echo "Syntax OK"
  </verify>
  <done>
    - `node --check bin/install.js` passes (no syntax errors)
    - `grep hasRescan bin/install.js` returns the flag declaration and handler block
    - `grep ccrStatus bin/install.js` shows ccrStatus used in promptProviders
    - `node bin/install.js --rescan` runs without crashing (may print "No external CLIs detected" on systems without the CLIs, but does not throw)
  </done>
</task>

</tasks>

<verification>
1. `node --check bin/install.js` — no syntax errors
2. `node -e "const p = require('./bin/providers.json'); const bad = p.providers.filter(x => x.cli && x.cli.startsWith('/')); console.log(bad.length === 0 ? 'PASS' : 'FAIL')"` — prints PASS
3. `grep -c 'hasRescan' bin/install.js` — returns >= 2 (declaration + usage)
4. `grep -c 'ccrStatus.found' bin/install.js` — returns >= 2 (promptProviders + rescan handler)
5. `node bin/install.js --rescan` — executes without uncaught exception
</verification>

<success_criteria>
- No hardcoded absolute paths remain in providers.json `cli` fields
- `--rescan` flag exists in install.js, re-detects CLIs, calls ensureMcpSlotsFromProviders, prints a slot diff, exits 0
- `promptProviders` auto-includes all ccr-* slots when detectCcrCli().found is true, without interactive per-slot prompting
- install.js passes `node --check` (no syntax errors)
- Calling `--rescan` twice produces "already exists (skipped)" output for previously-added slots (idempotent)
</success_criteria>

<output>
After completion, create `.planning/quick/396-fill-install-js-cli-detection-gaps-add-r/396-SUMMARY.md`
</output>

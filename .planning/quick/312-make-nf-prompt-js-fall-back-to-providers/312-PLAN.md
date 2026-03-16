---
phase: quick-312
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - hooks/nf-prompt.js
  - hooks/dist/nf-prompt.js
  - test/model-dedup.test.cjs
autonomous: true
requirements: [QUICK-312]
formal_artifacts: none

must_haves:
  truths:
    - "Dual-subscription slots (codex-1/codex-2, gemini-1/gemini-2) with the same model are deduplicated even when agent_config is empty"
    - "deduplicateByModel falls back to providers.json model field when agentCfg lacks a slot entry"
    - "Existing behavior preserved when agent_config IS populated (agent_config takes precedence over providers.json)"
    - "Fail-open on missing providers.json: slots with truly unknown models are still kept as unique (no false dedup)"
  artifacts:
    - path: "hooks/nf-prompt.js"
      provides: "deduplicateByModel with providers.json fallback"
      contains: "findProviders"
    - path: "test/model-dedup.test.cjs"
      provides: "Tests covering empty agentCfg fallback to providers.json"
      min_lines: 240
  key_links:
    - from: "hooks/nf-prompt.js deduplicateByModel"
      to: "hooks/nf-prompt.js findProviders"
      via: "fallback model lookup when agentCfg[slot] is missing"
      pattern: "findProviders|providers"
    - from: "hooks/nf-prompt.js deduplicateByModel"
      to: "bin/providers.json"
      via: "findProviders reads .providers[].model keyed by .providers[].name"
      pattern: "providers\\.json"
---

<objective>
Fix deduplicateByModel in nf-prompt.js to fall back to bin/providers.json when agent_config is empty or lacks a slot's model info. Currently, when agent_config is {} (the default), every slot resolves to 'unknown' and unknown models are never deduplicated. This means dual-subscription slots like codex-1/codex-2 (both gpt-5.4) dispatch simultaneously instead of one being demoted to fallback.

Purpose: Ensure quorum model diversity by deduplicating same-model slots even without explicit agent_config entries.
Output: Updated deduplicateByModel with providers.json fallback, updated tests, synced dist copy.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@hooks/nf-prompt.js
@bin/providers.json
@test/model-dedup.test.cjs
@hooks/config-loader.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add providers.json fallback to deduplicateByModel</name>
  <files>hooks/nf-prompt.js</files>
  <action>
Modify the `deduplicateByModel` function (line ~295) to accept an optional third parameter `providersList` and use it as fallback when `agentCfg` lacks model info for a slot.

1. Change the function signature to: `function deduplicateByModel(orderedSlots, agentCfg, providersList)`

2. Inside the function, build a providers lookup map at the top (before the loop):
   ```
   const providersMap = new Map();
   if (Array.isArray(providersList)) {
     for (const p of providersList) {
       if (p.name && p.model) providersMap.set(p.name, p.model);
     }
   }
   ```

3. Change the model resolution line (currently line 301):
   FROM: `const model = (agentCfg[slot.slot]?.model || 'unknown');`
   TO:   `const model = (agentCfg[slot.slot]?.model || providersMap.get(slot.slot) || 'unknown');`

   This way: agent_config takes precedence, then providers.json, then 'unknown' as last resort.

4. At the call site (line ~646), pass the providers list:
   - The `findProviders()` function already exists in nf-prompt.js (line ~155) and returns the `.providers` array.
   - Before the dedup call, add: `const providersList = findProviders();`
   - Change: `const dedupResult = deduplicateByModel(cappedSlots, agentCfg);`
   - To:     `const dedupResult = deduplicateByModel(cappedSlots, agentCfg, providersList);`

   Note: findProviders() is already called elsewhere in the same function for slot availability. To avoid a second disk read, check if `providers` (the variable from the existing `const providers = findProviders();` call around line ~470) is in scope at the dedup call site. If it is, reuse it: `deduplicateByModel(cappedSlots, agentCfg, providers)`. If not (different scope), call findProviders() again — it's a module-load-time cached read, so it's cheap.

Key constraints:
- Do NOT change the 'unknown' model bypass logic (lines 302-305). Slots with truly unknown models (not in agentCfg AND not in providers.json) must still be kept as unique.
- Do NOT modify findProviders() itself.
- The third parameter is optional — existing callers passing only 2 args still work (providersMap will be empty, same as current behavior).
  </action>
  <verify>
Run existing tests to confirm no regression: `node test/model-dedup.test.cjs`
All 10 tests must pass (they use explicit mockCfg so the fallback path is not exercised yet — pure regression check).

Also verify the change compiles: `node -e "require('./hooks/nf-prompt.js'); console.log('OK')"`
  </verify>
  <done>
deduplicateByModel resolves models via: agentCfg -> providers.json -> 'unknown'. The function signature accepts an optional providersList parameter. The call site passes the providers array from findProviders(). Existing tests pass unchanged.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add tests for providers.json fallback and sync dist</name>
  <files>test/model-dedup.test.cjs, hooks/dist/nf-prompt.js</files>
  <action>
Add new test cases to test/model-dedup.test.cjs that exercise the providers.json fallback path:

1. **Test 11: Empty agentCfg with providersList deduplicates same-model slots**
   - Pass `agentCfg = {}` (empty — simulates the default config)
   - Pass `providersList` matching bin/providers.json structure: `[{name:'codex-1', model:'gpt-5.4'}, {name:'codex-2', model:'gpt-5.4'}, {name:'gemini-1', model:'gemini-3-pro-preview'}]`
   - Slots: codex-1, codex-2, gemini-1
   - Assert: unique = [codex-1, gemini-1], duplicates = [codex-2]
   - This is THE core bug fix test.

2. **Test 12: agentCfg takes precedence over providersList**
   - agentCfg has codex-1 with model 'custom-model-x' (different from providers.json 'gpt-5.4')
   - providersList has codex-1 with 'gpt-5.4' and codex-2 with 'gpt-5.4'
   - Slots: codex-1, codex-2
   - Assert: unique = [codex-1, codex-2] (different models now — custom-model-x vs gpt-5.4), duplicates = []
   - Proves agentCfg overrides providers.json.

3. **Test 13: No providersList (undefined) — backward compatible**
   - agentCfg = {}, providersList = undefined
   - Slots: codex-1, codex-2
   - Assert: unique = [codex-1, codex-2] (both 'unknown', never deduped), duplicates = []
   - Proves backward compatibility when third param is omitted.

4. **Test 14: Mixed — some slots in agentCfg, others fall back to providersList**
   - agentCfg has gemini-1 with model info, but NOT codex-1 or codex-2
   - providersList has codex-1 and codex-2 both with 'gpt-5.4'
   - Slots: codex-1, codex-2, gemini-1
   - Assert: unique = [codex-1, gemini-1], duplicates = [codex-2]

After tests pass, sync dist copy and install:
```
cp hooks/nf-prompt.js hooks/dist/nf-prompt.js
node bin/install.js --claude --global
```
  </action>
  <verify>
Run: `node test/model-dedup.test.cjs`
All 14 tests must pass (10 existing + 4 new), 0 failures.

Verify dist is synced: `diff hooks/nf-prompt.js hooks/dist/nf-prompt.js` should show no differences.
  </verify>
  <done>
4 new tests validate: (1) empty agentCfg falls back to providers.json for dedup, (2) agentCfg takes precedence, (3) backward compat when providersList is undefined, (4) mixed agentCfg + providers fallback. Dist copy synced and installed.
  </done>
</task>

</tasks>

<verification>
1. `node test/model-dedup.test.cjs` -- 14/14 pass
2. `node -e "require('./hooks/nf-prompt.js'); console.log('OK')"` -- loads without error
3. `diff hooks/nf-prompt.js hooks/dist/nf-prompt.js` -- no diff
4. `grep 'providersMap\|providersList' hooks/nf-prompt.js` -- confirms fallback plumbing exists
</verification>

<success_criteria>
- deduplicateByModel deduplicates codex-1/codex-2 (same model) when agent_config is empty, using providers.json as fallback
- agent_config model entries take precedence over providers.json when present
- Backward compatible: omitting providersList parameter preserves old behavior
- All 14 tests pass
- Dist copy synced and installed globally
</success_criteria>

<output>
After completion, create `.planning/quick/312-make-nf-prompt-js-fall-back-to-providers/312-SUMMARY.md`
</output>

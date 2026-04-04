---
phase: quick-374
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/quorum-preflight.cjs
  - test/quorum-preflight-probe.test.cjs
  - core/references/quorum-dispatch.md
autonomous: true
requirements: [INTENT-01]
formal_artifacts: none

must_haves:
  truths:
    - "Available slots returned by quorum-preflight --all are ordered with CLI/CCR slots before HTTP API slots"
    - "HTTP API slots (type=http) are only dispatched when CLI/CCR slots cannot fill the quorum requirement"
    - "Preflight output includes primary_slots and backup_slots arrays for transparency"
    - "Existing quorum dispatch behavior is unchanged when enough CLI/CCR slots are available"
  artifacts:
    - path: "bin/quorum-preflight.cjs"
      provides: "Tiered slot ordering in available_slots output"
      contains: "type.*http"
    - path: "test/quorum-preflight-probe.test.cjs"
      provides: "Test verifying tiered ordering"
      contains: "primary_slots"
    - path: "core/references/quorum-dispatch.md"
      provides: "Documentation of tiered slot ordering"
      contains: "backup-only"
  key_links:
    - from: "bin/quorum-preflight.cjs"
      to: "bin/providers.json"
      via: "findProviders() reads type field"
      pattern: "p\\.type"
    - from: "core/references/quorum-dispatch.md"
      to: "bin/quorum-preflight.cjs"
      via: "Section 3 references preflight tiered ordering"
      pattern: "available_slots.*ordered"
---

<objective>
Make HTTP API slots (api-1 through api-6) backup-only in quorum dispatch by sorting available_slots in quorum-preflight.cjs so CLI/CCR slots always come before HTTP slots.

Purpose: HTTP API slots lack file access and are pay-per-use. They should only be dispatched when all CLI-based slots (codex, gemini, opencode, copilot, claude, ccr families) are exhausted or unavailable. Since workflows pick the first N slots from available_slots, sorting is sufficient.
Output: Modified preflight script with tiered ordering, updated tests, updated dispatch docs.
</objective>

<execution_context>
@./.claude/nf/workflows/execute-plan.md
@./.claude/nf/templates/summary.md
</execution_context>

<context>
@bin/quorum-preflight.cjs
@bin/providers.json
@core/references/quorum-dispatch.md
@test/quorum-preflight-probe.test.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add tiered slot ordering to quorum-preflight.cjs</name>
  <files>bin/quorum-preflight.cjs</files>
  <action>
In the `--all` mode block of `main()` (around line 491-507), after building the `available_slots` and `unavailable_slots` arrays, add tiered ordering logic:

1. After the for-loop that populates `output.available_slots` (line 506), add a sort step that partitions available_slots into two tiers:
   - **Primary tier**: slots where the provider entry has `type !== "http"` (subprocess and ccr types)
   - **Backup tier**: slots where the provider entry has `type === "http"`
   
2. Build a name-to-type lookup from `activeProviders` (or `providers` if no active filter). For each provider, map `p.name -> p.type`.

3. Sort `output.available_slots` using a comparator:
   ```javascript
   const typeMap = new Map(activeProviders.map(p => [p.name, p.type]));
   output.available_slots.sort((a, b) => {
     const aIsBackup = typeMap.get(a) === 'http' ? 1 : 0;
     const bIsBackup = typeMap.get(b) === 'http' ? 1 : 0;
     return aIsBackup - bIsBackup;
   });
   ```

4. Add two new output fields for transparency (after the sort):
   ```javascript
   output.primary_slots = output.available_slots.filter(s => typeMap.get(s) !== 'http');
   output.backup_slots = output.available_slots.filter(s => typeMap.get(s) === 'http');
   ```

5. Emit a stderr log when backup slots exist:
   ```javascript
   if (output.backup_slots.length > 0) {
     process.stderr.write(`[preflight] Tiered ordering: ${output.primary_slots.length} primary (CLI/CCR) + ${output.backup_slots.length} backup (HTTP API)\n`);
   }
   ```

The `activeProviders` variable already exists at line 469. Use it for the typeMap. Place the typeMap construction right after the for-loop that builds available/unavailable (after line 507), before the JSON output.

IMPORTANT: Do NOT modify any other logic (health probing, service start, team building). Only add sorting and the two new fields to the output object.
  </action>
  <verify>
Run: `node bin/quorum-preflight.cjs --all --no-probe 2>/dev/null | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log('has primary_slots:', 'primary_slots' in d); console.log('has backup_slots:', 'backup_slots' in d);"`
Expected: both fields present (though empty without probe, since available_slots only populated with probe).

Run with probe: `node bin/quorum-preflight.cjs --all 2>/dev/null | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); const a=d.available_slots||[]; const httpIdx=a.findIndex(s=>s.startsWith('api-')); const cliIdx=a.findLastIndex(s=>!s.startsWith('api-')); console.log('ordered correctly:', httpIdx===-1 || cliIdx < httpIdx || cliIdx===-1); console.log('primary:', d.primary_slots?.length, 'backup:', d.backup_slots?.length);"`
Expected: ordered correctly: true, primary and backup counts shown.
  </verify>
  <done>
available_slots array in preflight output is sorted with CLI/CCR slots first and HTTP API slots last. primary_slots and backup_slots fields are present in the output JSON.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add test for tiered ordering and update dispatch docs</name>
  <files>test/quorum-preflight-probe.test.cjs, core/references/quorum-dispatch.md</files>
  <action>
**Test (test/quorum-preflight-probe.test.cjs):**

Add a new test case after the existing tests (before the closing `});` of the describe block):

```javascript
// -- Test 8: Tiered ordering — CLI/CCR slots before HTTP API slots --
it('available_slots are ordered with CLI/CCR primary before HTTP backup', () => {
  const raw = runPreflight(['--all']);
  const data = JSON.parse(raw);

  // primary_slots and backup_slots must be present
  assert.ok(Array.isArray(data.primary_slots), 'primary_slots should be an array');
  assert.ok(Array.isArray(data.backup_slots), 'backup_slots should be an array');

  // All primary slots should appear before all backup slots in available_slots
  const available = data.available_slots || [];
  if (data.primary_slots.length > 0 && data.backup_slots.length > 0) {
    const lastPrimaryIdx = Math.max(...data.primary_slots.map(s => available.indexOf(s)));
    const firstBackupIdx = Math.min(...data.backup_slots.map(s => available.indexOf(s)).filter(i => i !== -1));
    assert.ok(lastPrimaryIdx < firstBackupIdx,
      `Last primary slot (idx ${lastPrimaryIdx}) should come before first backup slot (idx ${firstBackupIdx})`);
  }

  // backup_slots should only contain api-* type slots
  for (const s of data.backup_slots) {
    assert.ok(s.startsWith('api-'), `backup slot "${s}" should be an api-* slot`);
  }

  // primary + backup should equal available
  const combined = [...data.primary_slots, ...data.backup_slots].sort();
  const sorted_available = [...available].sort();
  assert.deepStrictEqual(combined, sorted_available,
    'primary_slots + backup_slots should equal available_slots');
});
```

Also add a test for the --no-probe case to ensure the new fields are present (even if empty):

```javascript
// -- Test 9: --no-probe still includes primary_slots and backup_slots fields --
it('--all --no-probe includes primary_slots and backup_slots (empty arrays)', () => {
  const raw = runPreflight(['--all', '--no-probe']);
  const data = JSON.parse(raw);
  // Without probe, available_slots is absent, so primary/backup should also be absent
  // (they are only computed when probe runs and available_slots exists)
  // This test just verifies no crash
  assert.strictEqual(typeof data.team, 'object', 'team should be present');
});
```

Wait -- actually, the --no-probe path does NOT populate available_slots at all (the PROBE block is skipped). So primary_slots and backup_slots will also be absent. Adjust test 9 to just verify no crash and that the standard keys are still correct. Do NOT add primary_slots/backup_slots assertions for --no-probe.

**Documentation (core/references/quorum-dispatch.md):**

In Section 3 "Adaptive Fan-Out", after the `Build DISPATCH_LIST` comment block (around line 91-93), add a new paragraph:

```markdown
**Tiered Slot Ordering (TIER-01):** The preflight `available_slots` array is pre-sorted with CLI/CCR slots (subprocess and ccr types) first and HTTP API slots last. Since `$DISPATCH_LIST` picks the first `(FAN_OUT_COUNT - 1)` entries, HTTP API slots are backup-only — they are never dispatched when sufficient CLI/CCR slots are available. The preflight output also includes `primary_slots` (CLI/CCR) and `backup_slots` (HTTP API) arrays for diagnostic transparency.
```

Also update the FAN-06 display block (around line 107-119) to reference the tiered ordering:

Change the `Fallback order:` line to:
```
 Fallback order (tiered):
   T1 (flat-rate CLI/CCR): ${primary slots not in dispatch list, or "none"}
   T2 (pay-per-use HTTP API, backup-only): ${backup_slots, or "none"}
```
  </action>
  <verify>
Run test: `node --test test/quorum-preflight-probe.test.cjs`
Expected: All tests pass (including the new tiered ordering test).

Check docs: `grep -c 'TIER-01' core/references/quorum-dispatch.md` should return 1.
Check docs: `grep -c 'backup-only' core/references/quorum-dispatch.md` should return >= 1.
  </verify>
  <done>
Test validates tiered ordering of available_slots with CLI/CCR before HTTP. Documentation in quorum-dispatch.md Section 3 explains the tiered ordering behavior and references TIER-01.
  </done>
</task>

<task type="auto">
  <name>Task 3: Sync installed copy and run full test suite</name>
  <files>~/.claude/nf-bin/quorum-preflight.cjs</files>
  <action>
1. Copy the modified preflight script to the installed location:
   ```bash
   cp bin/quorum-preflight.cjs ~/.claude/nf-bin/quorum-preflight.cjs
   ```

2. Run the full test suite to ensure no regressions:
   ```bash
   node --test test/quorum-preflight-probe.test.cjs
   ```

3. Run a live preflight probe to verify the ordering works end-to-end:
   ```bash
   node bin/quorum-preflight.cjs --all 2>&1
   ```
   Verify that the JSON output has primary_slots and backup_slots, and that all api-* entries appear after non-api entries in available_slots.

4. Do NOT modify any other files. Do NOT run `node bin/install.js` (quorum-preflight.cjs is not a hook file -- it's a bin/ script that install.js copies directly).

Note: The installed copy at ~/.claude/nf-bin/ is what the quorum workflows actually invoke. The repo copy at bin/ is the source of truth. Both must match.
  </action>
  <verify>
Run: `diff bin/quorum-preflight.cjs ~/.claude/nf-bin/quorum-preflight.cjs`
Expected: No differences (files are identical).

Run: `node --test test/quorum-preflight-probe.test.cjs 2>&1 | tail -5`
Expected: All tests pass.
  </verify>
  <done>
Installed copy at ~/.claude/nf-bin/quorum-preflight.cjs matches the repo source. All tests pass. Live preflight output shows tiered ordering.
  </done>
</task>

</tasks>

<verification>
1. `node bin/quorum-preflight.cjs --all 2>/dev/null | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); const a=d.available_slots; const p=d.primary_slots; const b=d.backup_slots; console.log(JSON.stringify({available:a?.length,primary:p?.length,backup:b?.length}));"` -- shows slot counts
2. `node --test test/quorum-preflight-probe.test.cjs` -- all tests pass
3. `diff bin/quorum-preflight.cjs ~/.claude/nf-bin/quorum-preflight.cjs` -- no diff
4. `grep 'TIER-01' core/references/quorum-dispatch.md` -- documentation present
</verification>

<success_criteria>
- HTTP API slots (api-1..api-6) appear AFTER all CLI/CCR slots in available_slots
- primary_slots and backup_slots fields present in preflight JSON output
- All existing tests pass plus new tiered ordering test
- Installed copy synced
- quorum-dispatch.md documents the tiered ordering behavior
</success_criteria>

<output>
After completion, create `.planning/quick/374-make-api-slots-backup-only-dispatch-to-a/374-SUMMARY.md`
</output>

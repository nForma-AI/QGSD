---
phase: quick-231
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - core/bin/gsd-tools.cjs
autonomous: true
formal_artifacts: none
must_haves:
  truths:
    - "Health checker W007 does not fire for archived milestone phases"
    - "Health checker W006 still correctly detects phases in ROADMAP missing from disk (including archived)"
    - "Health checker W007 still correctly detects non-archived disk phases missing from ROADMAP"
  artifacts:
    - path: "core/bin/gsd-tools.cjs"
      provides: "Fixed W007 check that skips archived phase IDs"
      contains: "archivedPhaseIds"
  key_links:
    - from: "core/bin/gsd-tools.cjs"
      to: "~/.claude/nf/bin/gsd-tools.cjs"
      via: "cp sync after edit"
      pattern: "cp core/bin/gsd-tools.cjs"
---

<objective>
Fix W007 false positives in health checker where archived milestone phase directories trigger "Phase X exists on disk but not in ROADMAP.md" warnings.

Purpose: The cmdValidateHealth Check 8 adds archived phases to `diskPhases` (correct for W006) but then W007 iterates ALL diskPhases including archived ones, creating 167+ false positive warnings.
Output: Patched gsd-tools.cjs with archivedPhaseIds exclusion set for W007 loop.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@core/bin/gsd-tools.cjs (lines 3984-4049 — Check 8 W006/W007 section)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add archivedPhaseIds set and exclude from W007 check</name>
  <files>core/bin/gsd-tools.cjs</files>
  <action>
In `cmdValidateHealth`, Check 8 section (around line 3995), make these changes:

1. After `const diskPhases = new Set();` (line 3995), add: `const archivedPhaseIds = new Set();`

2. In the archived phases loop (lines 4008-4012), after adding to `diskPhases`, ALSO add the same ID to `archivedPhaseIds`:
   ```
   if (dm) {
     diskPhases.add(dm[1]);
     archivedPhaseIds.add(dm[1]);
   }
   ```

3. In the legacy archive loop (lines 4017-4021), same treatment — also add to `archivedPhaseIds`:
   ```
   if (dm) {
     diskPhases.add(dm[1]);
     archivedPhaseIds.add(dm[1]);
   }
   ```

4. In the W007 loop (lines 4039-4048), add an early-continue to skip archived phase IDs:
   ```
   for (const p of diskPhases) {
     if (archivedPhaseIds.has(p)) continue;  // <-- ADD THIS LINE
     const normalized = normalizePhaseName(p);
     // ... rest unchanged
   }
   ```

This preserves W006 behavior (archived phases stay in diskPhases so ROADMAP entries match) while preventing W007 from flagging archived phases.
  </action>
  <verify>
Run the health check and confirm zero W007 warnings for archived phases:
```
node core/bin/gsd-tools.cjs health .
```
Grep output for W007 — should show 0 archived phase warnings. If any W007 remains, it should only be for genuinely orphaned current phases.

Also verify W006 still works: phases listed in ROADMAP that exist only in archive should NOT trigger W006.
  </verify>
  <done>W007 false positives eliminated. Health check produces no spurious warnings for archived milestone phases. W006 continues to work correctly for archived phases.</done>
</task>

<task type="auto">
  <name>Task 2: Sync to installed location</name>
  <files>core/bin/gsd-tools.cjs</files>
  <action>
Copy the fixed file to the installed location:
```
cp core/bin/gsd-tools.cjs ~/.claude/nf/bin/gsd-tools.cjs
```

Then re-run health check from the installed copy to confirm it works from the actual runtime path:
```
node ~/.claude/nf/bin/gsd-tools.cjs health .
```
  </action>
  <verify>
Run `node ~/.claude/nf/bin/gsd-tools.cjs health .` and confirm:
1. No W007 false positives for archived phases
2. Output parses as valid JSON with no W007 entries for archived phase IDs
  </verify>
  <done>Installed copy at ~/.claude/nf/bin/gsd-tools.cjs is synced and produces correct health check results.</done>
</task>

</tasks>

<verification>
- `node core/bin/gsd-tools.cjs health . 2>/dev/null | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); const w7=d.issues.filter(i=>i.code==='W007'); console.log('W007 count:', w7.length); w7.forEach(w=>console.log(' -',w.message))"` — should show 0 or only genuinely orphaned phases
- `grep -n 'archivedPhaseIds' core/bin/gsd-tools.cjs` — confirms the fix is present
</verification>

<success_criteria>
- Health check W007 count drops from 167+ to 0 (or near-zero for genuinely orphaned phases only)
- W006 continues to function correctly for archived phases
- Both repo source and installed copy are in sync
</success_criteria>

<output>
After completion, create `.planning/quick/231-fix-health-checker-w007-false-positives-/231-SUMMARY.md`
</output>

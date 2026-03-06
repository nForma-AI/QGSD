---
phase: quick-194
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - core/bin/gsd-tools.cjs
  - core/bin/gsd-tools.test.cjs
autonomous: true
formal_artifacts: none
must_haves:
  truths:
    - "phase-complete returns is_last_phase=false when ROADMAP.md has a higher-numbered phase even if no directory exists on disk"
    - "phase-complete returns is_last_phase=true only when ROADMAP.md has no higher-numbered phases (negative test confirms no false positive)"
    - "phase-complete populates next_phase and next_phase_name from roadmap when disk directory is absent"
    - "Existing disk-based detection still works when directories DO exist"
    - "Versioned phases like v0.28-01 vs v0.28-02 are compared segment-by-segment, not via parseFloat (which treats both as 0.28)"
  artifacts:
    - path: "core/bin/gsd-tools.cjs"
      provides: "ROADMAP.md fallback in cmdPhaseComplete next-phase detection"
      contains: "phasePattern"
    - path: "core/bin/gsd-tools.test.cjs"
      provides: "Test for roadmap-only next phase detection"
      contains: "roadmap has next phase but no directory"
  key_links:
    - from: "core/bin/gsd-tools.cjs cmdPhaseComplete"
      to: "ROADMAP.md phase headings"
      via: "phasePattern regex fallback after disk scan"
      pattern: "phasePattern.*exec"
---

<objective>
Fix gsd-tools.cjs phase-complete command to detect the next phase from ROADMAP.md when no phase directory exists on disk yet.

Purpose: The transition workflow reads is_last_phase to decide between Route A (auto-advance) and Route B (milestone complete). Currently, unplanned phases without directories on disk cause false is_last_phase=true, breaking the auto-advance chain.

Output: Patched cmdPhaseComplete with ROADMAP.md fallback + regression tests.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@core/bin/gsd-tools.cjs (lines 3380-3549 — cmdPhaseComplete function)
@core/bin/gsd-tools.test.cjs (lines 1626-1709 — existing phase complete tests)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add ROADMAP.md fallback to cmdPhaseComplete next-phase detection</name>
  <files>core/bin/gsd-tools.cjs</files>
  <action>
In cmdPhaseComplete (line 3466-3489), after the existing try/catch block that scans disk directories (line 3489), add a ROADMAP.md fallback that runs ONLY when isLastPhase is still true (meaning disk scan found nothing).

Insert after line 3489 (the closing of the catch block):

```javascript
// Segment-aware version comparator: splits on '-' and compares sub-segments as numbers.
// parseFloat('0.28-01') === parseFloat('0.28-02') === 0.28, so parseFloat is WRONG
// for versioned phases like v0.28-01 vs v0.28-02. This helper compares [0.28, 1] vs [0.28, 2].
function comparePhaseVersions(a, b) {
  const sa = String(a).replace(/^v/i, '').split('-').map(Number);
  const sb = String(b).replace(/^v/i, '').split('-').map(Number);
  const len = Math.max(sa.length, sb.length);
  for (let i = 0; i < len; i++) {
    const va = sa[i] || 0;
    const vb = sb[i] || 0;
    if (va !== vb) return va - vb;
  }
  return 0;
}

// Fallback: check ROADMAP.md for phases not yet on disk
if (isLastPhase && fs.existsSync(roadmapPath)) {
  const roadmapContent = fs.readFileSync(roadmapPath, 'utf-8');
  const phasePattern = /#{2,4}\s*Phase\s+(v\d+\.\d+-\d+(?:\.\d+)?|\d+(?:\.\d+)?)\s*:\s*([^\n]+)/gi;
  let pm;
  while ((pm = phasePattern.exec(roadmapContent)) !== null) {
    if (comparePhaseVersions(pm[1], phaseNum) > 0) {
      nextPhaseNum = pm[1];
      nextPhaseName = pm[2].replace(/\(INSERTED\)/i, '').trim().replace(/\s+/g, '-').toLowerCase();
      isLastPhase = false;
      break;
    }
  }
}
```

Key details:
- Uses a segment-aware `comparePhaseVersions` helper instead of `parseFloat`. This is CRITICAL because `parseFloat('0.28-01')` and `parseFloat('0.28-02')` both yield `0.28`, making them appear equal. The helper strips the `v` prefix, splits on `-`, and compares each segment as an integer (e.g., `[0.28, 1]` vs `[0.28, 2]`).
- Note: the existing disk-scan code at line 3474 also uses `parseFloat` but gets away with it because directory names use normalized prefixes that don't collide. The ROADMAP fallback cannot rely on this — it must handle arbitrary versioned phase strings.
- Reuse the EXACT same phasePattern regex from cmdRoadmapAnalyze (line 2695) to ensure consistency
- roadmapPath is already declared at line 3386
- The nextPhaseName transform (lowercase, hyphens) matches the convention used for directory names
- Only runs when disk scan found no next phase, so existing behavior is preserved when directories exist
  </action>
  <verify>Run: node --test core/bin/gsd-tools.test.cjs --test-name-pattern "phase complete" 2>&1 | tail -20 — all existing phase-complete tests must still pass.</verify>
  <done>cmdPhaseComplete falls back to ROADMAP.md parsing when no next-phase directory exists on disk. Existing tests pass unchanged.</done>
</task>

<task type="auto">
  <name>Task 2: Add regression tests for roadmap-only next phase detection</name>
  <files>core/bin/gsd-tools.test.cjs</files>
  <action>
Add two new tests inside the existing describe('phase complete command') block, after the "detects last phase in milestone" test at line 1709.

Test A — simple integer phases, no disk directory for next phase:
- ROADMAP.md with Phase 1 + Phase 2 headings (both with Goal/Plans sections)
- STATE.md with current phase = 01
- Phase 1 directory with PLAN + SUMMARY files
- NO Phase 2 directory
- Run phase complete 1
- Assert: output.is_last_phase === false, output.next_phase === '2', output.next_phase_name is truthy
- Assert: STATE.md contains 'Ready to plan' and does NOT contain 'Milestone complete'

Test B — versioned phase numbers (the v0.28-XX style):
- ROADMAP.md with Phase v0.28-01 + Phase v0.28-02 headings
- STATE.md with current phase = v0.28-01
- Phase v0.28-01 directory with PLAN + SUMMARY
- NO Phase v0.28-02 directory
- Run phase complete v0.28-01
- Assert: output.is_last_phase === false, output.next_phase === 'v0.28-02' (exact value, not just truthy — validates the segment-aware comparator correctly distinguishes v0.28-01 from v0.28-02 despite parseFloat treating both as 0.28)

Test C — negative test, true last phase with roadmap fallback path:
- ROADMAP.md with ONLY Phase 1 heading (no Phase 2)
- STATE.md with current phase = 01
- Phase 1 directory with PLAN + SUMMARY
- NO other phase directories
- Run phase complete 1
- Assert: output.is_last_phase === true (confirms the ROADMAP fallback code runs but does NOT produce a false positive — it correctly leaves is_last_phase=true when there really is no next phase)
- Assert: STATE.md contains 'Milestone complete'

All three tests follow the exact pattern of existing tests at lines 1637-1709 (same tmpDir setup, same runGsdTools call, same JSON.parse of output).
  </action>
  <verify>Run: node --test core/bin/gsd-tools.test.cjs --test-name-pattern "phase complete" 2>&1 — all phase-complete tests pass including the three new ones (A, B, C). Verify new test names appear in output.</verify>
  <done>Three new tests exist and pass: (A) simple integer phase numbers with roadmap fallback, (B) versioned v0.28-XX phase numbers with exact next_phase assertion, (C) negative test confirming is_last_phase=true when roadmap has no higher phase.</done>
</task>

</tasks>

<verification>
1. node --test core/bin/gsd-tools.test.cjs --test-name-pattern "phase complete" — all phase-complete tests pass
2. node --test core/bin/gsd-tools.test.cjs 2>&1 | tail -5 — full test suite shows no regressions
3. Manual check: the new code block only executes when isLastPhase is still true after disk scan, preserving backward compatibility
</verification>

<success_criteria>
- is_last_phase=false when ROADMAP.md has a higher phase but no disk directory exists
- is_last_phase=true only when ROADMAP.md has no higher phases
- All existing tests pass unchanged
- Three new regression tests cover integer phases, versioned phase numbers (with exact value assertion), and a negative "true last phase" scenario
</success_criteria>

<output>
After completion, create .planning/quick/194-fix-gsd-tools-cjs-phase-complete-to-dete/194-SUMMARY.md
</output>

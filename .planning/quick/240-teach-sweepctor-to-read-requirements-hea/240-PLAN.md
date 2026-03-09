---
phase: quick-240
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/nf-solve.cjs
  - bin/sweep-reverse.test.cjs
autonomous: true
formal_artifacts: none
requirements: [TRACE-05]

must_haves:
  truths:
    - "sweepCtoR counts a source file as traced when it has a Requirements: header comment with valid IDs"
    - "sweepCtoR still counts files as traced via the existing filename-based check"
    - "Files with Requirements: headers containing IDs not in the envelope remain untraced"
    - "Existing tests still pass after the change"
  artifacts:
    - path: "bin/nf-solve.cjs"
      provides: "Header-comment parsing fallback in sweepCtoR"
      contains: "Requirements:"
    - path: "bin/sweep-reverse.test.cjs"
      provides: "Tests for header-comment tracing"
      contains: "Requirements:"
  key_links:
    - from: "bin/nf-solve.cjs sweepCtoR()"
      to: ".planning/formal/requirements.json"
      via: "ID lookup against parsed header IDs"
      pattern: "Requirements:"
---

<objective>
Teach sweepCtoR() to read `Requirements:` header comments from source files as a fallback tracing mechanism, eliminating false-positive "untraced" reports for files that self-declare their requirement links.

Purpose: Many source files in bin/ and hooks/ already declare `// Requirements: GATE-01, GATE-02` in their header comments. Currently sweepCtoR only checks if the requirements envelope text mentions the filename. This misses self-declared links, inflating the untraced count.

Output: Updated sweepCtoR with header-comment parsing + new tests confirming the behavior.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@bin/nf-solve.cjs (lines 1534-1632 — sweepCtoR function)
@bin/sweep-reverse.test.cjs
@bin/formalization-candidates.cjs (lines 1-20 — example Requirements: header)
@.planning/formal/requirements.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add header-comment parsing fallback to sweepCtoR</name>
  <files>bin/nf-solve.cjs</files>
  <action>
In sweepCtoR() (around line 1617-1621), modify the else branch so that before pushing to `untraced`, it attempts to read the first 30 lines of the source file and parse a `Requirements:` header comment.

Specific changes inside the `for (const file of sourceFiles)` loop, replacing the current else block at line 1619-1621:

```
} else {
  // Fallback: check if file self-declares requirement IDs in header comment
  let headerTraced = false;
  try {
    const absFile = path.join(ROOT, file);
    const head = fs.readFileSync(absFile, 'utf8').slice(0, 3000); // ~30 lines
    const match = head.match(/(?:\/\/|\/?\*)\s*Requirements:\s*(.+)/);
    if (match) {
      const declaredIds = match[1].split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
      const reqIdSet = new Set(requirements.map(r => r.id));
      headerTraced = declaredIds.some(id => reqIdSet.has(id));
    }
  } catch (e) {
    // fail-open: file unreadable, treat as untraced
  }
  if (headerTraced) {
    traced++;
  } else {
    untraced.push({ file });
  }
}
```

Performance note: The `reqIdSet` Set construction happens inside the loop which is suboptimal. Hoist it above the loop — create `const reqIdSet = new Set(requirements.map(r => r.id));` right after the `allReqText` construction (around line 1566), then reference it inside the loop. This avoids rebuilding the Set for every untraced file.

The regex `(?:\/\/|\/?\*)\s*Requirements:\s*(.+)` handles:
- `// Requirements: X, Y` (single-line comment)
- `* Requirements: X, Y` (JSDoc/block comment line)
- `/* Requirements: X, Y` (block comment opening)

IMPORTANT: Keep the existing filename-based check at line 1617 as the primary path. The header parsing is only a fallback when filename matching fails.
  </action>
  <verify>
Run existing tests to confirm no regression:
```
node --test bin/sweep-reverse.test.cjs
```

Then run a quick smoke test to confirm sweepCtoR still returns valid shape:
```
node -e "const {sweepCtoR}=require('./bin/nf-solve.cjs'); const r=sweepCtoR(); console.log('traced:', r.detail.traced, 'untraced:', r.residual, 'total:', r.detail.total_modules)"
```

Verify that formalization-candidates.cjs (which has `Requirements: GATE-01, GATE-02, GATE-03, GATE-04`) is no longer in the untraced list:
```
node -e "const {sweepCtoR}=require('./bin/nf-solve.cjs'); const r=sweepCtoR(); const found=r.detail.untraced_modules.find(m=>m.file.includes('formalization-candidates')); console.log('formalization-candidates untraced?', !!found)"
```
Expected: `false`
  </verify>
  <done>sweepCtoR reads Requirements: header comments as a fallback, correctly tracing files like formalization-candidates.cjs that self-declare requirement links. Existing filename-based tracing still works. All existing tests pass.</done>
</task>

<task type="auto">
  <name>Task 2: Add tests for header-comment tracing in sweepCtoR</name>
  <files>bin/sweep-reverse.test.cjs</files>
  <action>
Add new test cases to the `sweepCtoR` describe block in bin/sweep-reverse.test.cjs:

1. **Test: "traces files with Requirements: header comment"**
   - Call sweepCtoR() on the live project
   - Verify that `bin/formalization-candidates.cjs` (which has `// Requirements: GATE-01, GATE-02, GATE-03, GATE-04`) does NOT appear in untraced_modules
   - This is an integration test against the real codebase

2. **Test: "header-traced files contribute to traced count"**
   - Call sweepCtoR() and verify traced count is > 0
   - Get the list of files with Requirements: headers by scanning bin/*.cjs for the pattern
   - Verify none of those files appear in untraced_modules (integration test)

3. **Test: "traced + untraced still equals total_modules"**
   - This invariant should already be tested, but add an explicit assertion post-header-parsing to confirm the math still holds

Place these tests after the existing "excludes test files from scan" test (around line 63).
  </action>
  <verify>
Run the full test file:
```
node --test bin/sweep-reverse.test.cjs
```
All tests must pass including the new ones.
  </verify>
  <done>New tests confirm that files with valid Requirements: header comments are traced by sweepCtoR, and that the traced+untraced=total invariant holds after the change.</done>
</task>

</tasks>

<verification>
1. `node --test bin/sweep-reverse.test.cjs` — all tests pass (existing + new)
2. `node -e "const {sweepCtoR}=require('./bin/nf-solve.cjs'); const r=sweepCtoR(); console.log(JSON.stringify(r.detail, null, 2))"` — traced count increased, formalization-candidates.cjs not in untraced list
3. `node -e "const {computeResidual}=require('./bin/nf-solve.cjs'); const r=computeResidual(); console.log('c_to_r residual:', r.c_to_r.residual)"` — residual decreased compared to before
</verification>

<success_criteria>
- sweepCtoR correctly parses Requirements: headers from source files
- Files with valid requirement IDs in headers are counted as traced
- formalization-candidates.cjs (and similar files) no longer appear as untraced
- All existing and new tests pass
- No performance regression (Set-based ID lookup is O(1))
</success_criteria>

<output>
After completion, create `.planning/quick/240-teach-sweepctor-to-read-requirements-hea/240-SUMMARY.md`
</output>

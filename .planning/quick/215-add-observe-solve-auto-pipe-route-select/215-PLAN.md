---
phase: quick-215
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/observe-solve-pipe.cjs
  - bin/observe-solve-pipe.test.cjs
  - commands/nf/observe.md
  - commands/nf/solve.md
autonomous: true
requirements: [QUICK-215]
formal_artifacts: none

must_haves:
  truths:
    - "User can type 'solve 1,3,5' in observe step 7 to route specific issues to solve"
    - "Selected observe issues are written to a targets manifest JSON file"
    - "nf:solve reads the targets manifest and scopes remediation context to those issues"
    - "Existing 'solve' (all internal) route still works unchanged"
  artifacts:
    - path: "bin/observe-solve-pipe.cjs"
      provides: "Bridge that converts selected observe issues to a solve targets manifest"
      exports: ["buildTargetsManifest", "writeTargetsManifest"]
    - path: "bin/observe-solve-pipe.test.cjs"
      provides: "Tests for the pipe bridge"
      min_lines: 40
  key_links:
    - from: "commands/nf/observe.md"
      to: "bin/observe-solve-pipe.cjs"
      via: "step 7 'solve N,M,...' route calls buildTargetsManifest"
      pattern: "observe-solve-pipe"
    - from: "commands/nf/solve.md"
      to: ".planning/observe-targets.json"
      via: "step 0c reads targets manifest when --targets flag present"
      pattern: "observe-targets"
  consumers:
    - artifact: "bin/observe-solve-pipe.cjs"
      consumed_by: "commands/nf/observe.md"
      integration: "step 7 require() call for buildTargetsManifest"
      verify_pattern: "observe-solve-pipe"
---

<objective>
Add an observe-to-solve auto-pipe that lets users select specific observed issues (by number) and route them into nf:solve as scoped remediation targets.

Purpose: Currently observe step 7 only offers "solve" (all internal issues) or single-issue routing. Users need to cherry-pick multiple issues and send them as a focused remediation batch to solve, so solve can prioritize those specific gaps instead of running a full blind sweep.

Output: bin/observe-solve-pipe.cjs bridge module, updated observe.md step 7 with "solve N,M,..." syntax, updated solve.md with --targets manifest consumption.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@commands/nf/observe.md
@commands/nf/solve.md
@bin/observe-handlers.cjs
@bin/observe-render.cjs
@bin/observe-debt-writer.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create observe-solve-pipe bridge module and tests</name>
  <files>bin/observe-solve-pipe.cjs, bin/observe-solve-pipe.test.cjs</files>
  <action>
Create `bin/observe-solve-pipe.cjs` as a CommonJS module with `'use strict'` at top.

**Exports:**

1. `buildTargetsManifest(selectedIssues, options)` — Takes an array of observe issue objects (standard schema from handlers) and returns a targets manifest object:
   ```javascript
   {
     version: 1,
     created_at: ISO timestamp,
     source: 'observe',
     targets: selectedIssues.map(issue => ({
       id: issue.id,
       title: issue.title,
       severity: issue.severity,
       source_type: issue.source_type,
       issue_type: issue.issue_type,
       _route: issue._route || null,
       formal_ref: issue.formal_parameter_key || issue.formal_ref || null,
       fingerprint: issue.fingerprint || null
     }))
   }
   ```

2. `writeTargetsManifest(manifest, outputPath)` — Writes the manifest JSON to disk. Default outputPath: `.planning/observe-targets.json`. Returns `{ path, count }`.

3. `readTargetsManifest(inputPath)` — Reads and validates a targets manifest. Returns the manifest object or null if file missing/invalid.

4. `parseIssueSelection(input, maxIndex)` — Parses user input like "solve 1,3,5" or "solve 1-3,7" into an array of zero-based indices. Supports:
   - Comma-separated: "solve 1,3,5" -> [0, 2, 4]
   - Ranges: "solve 1-3" -> [0, 1, 2]
   - Mixed: "solve 1-3,7,9" -> [0, 1, 2, 6, 8]
   - Deduplicates and sorts ascending
   - Filters out indices >= maxIndex
   - Returns empty array if no valid indices

Create `bin/observe-solve-pipe.test.cjs` using vitest:
- Test `parseIssueSelection` with comma, range, mixed, out-of-bounds, empty inputs
- Test `buildTargetsManifest` produces correct schema with version, targets array
- Test `writeTargetsManifest` + `readTargetsManifest` round-trip (use tmp dir)
- Test `readTargetsManifest` returns null for missing file
  </action>
  <verify>Run `npx vitest run bin/observe-solve-pipe.test.cjs` — all tests pass</verify>
  <done>observe-solve-pipe.cjs exports 4 functions, all tests green</done>
</task>

<task type="auto">
  <name>Task 2: Update observe.md step 7 and solve.md to support targets pipe</name>
  <files>commands/nf/observe.md, commands/nf/solve.md</files>
  <action>
**Update `commands/nf/observe.md` step 7:**

Add a new input pattern after the existing "solve" pattern. The updated prompt should read:
```
Enter issue # to work on, "ack N" to acknowledge, "solve" for all internal issues, "solve N,M,..." to route selected issues, "all" for full details, or press Enter to skip:
```

Add a new conditional block for "solve N,M,...":

**If user enters "solve" followed by numbers (e.g., "solve 1,3,5" or "solve 1-3,7"):**
- Import `parseIssueSelection`, `buildTargetsManifest`, `writeTargetsManifest` from `bin/observe-solve-pipe.cjs`
- Call `parseIssueSelection(userInput, allIssues.length)` to get selected indices
- If no valid indices, display: `"No valid issue numbers in selection. Try again."`
- Map indices to the actual issue objects from the rendered issues list (the same numbered list shown in the ISSUES table)
- Call `buildTargetsManifest(selectedIssues)` then `writeTargetsManifest(manifest)`
- Display:
  ```
  Piping {N} issue(s) to /nf:solve as targets:
    - #{idx}: {title}
    ...
  Targets written to .planning/observe-targets.json
  ```
- Invoke `/nf:solve --targets=.planning/observe-targets.json`

Keep the existing "solve" (bare, no numbers) behavior unchanged — it still routes ALL internal issues.

**Update `commands/nf/solve.md`:**

Add a new Step 0c after Step 0b (Config Audit), before Step 1:

```markdown
### Step 0c: Load Observe Targets (optional)

If `--targets=<path>` flag was passed:

1. Read the targets manifest:
   ```javascript
   const { readTargetsManifest } = require('./bin/observe-solve-pipe.cjs');
   const targets = readTargetsManifest(targetsPath);
   ```

2. If targets is null or empty, log: `"Step 0c: No valid targets manifest at {path} — falling back to full sweep"` and proceed normally.

3. If targets is valid, log:
   ```
   Step 0c: Loaded {targets.targets.length} observe target(s) — scoping remediation
   ```

4. Store targets in solve context. During Step 3 remediation dispatch, when targets are loaded:
   - Include target titles and severity in the remediation context string passed to sub-skills
   - Add a "Prioritized from /nf:observe" note to the solve output header
   - The targets do NOT restrict which layer transitions are checked (full sweep still runs), but they add focused context so remediation sub-skills know which specific issues the user wants addressed

This is fail-open: if the targets file is missing or malformed, solve proceeds with its normal full sweep.
```

Also add `--targets=<path>` to the argument-hint in the solve.md frontmatter.
  </action>
  <verify>
Verify observe.md contains "solve N,M,..." documentation: `grep 'solve N,M' commands/nf/observe.md`
Verify solve.md contains Step 0c and --targets flag: `grep 'Step 0c' commands/nf/solve.md && grep 'targets' commands/nf/solve.md`
  </verify>
  <done>observe step 7 documents "solve N,M,..." selection syntax; solve.md documents --targets manifest consumption at Step 0c; both skills reference bin/observe-solve-pipe.cjs</done>
</task>

</tasks>

<verification>
1. `npx vitest run bin/observe-solve-pipe.test.cjs` — all tests pass
2. `grep 'observe-solve-pipe' commands/nf/observe.md` — returns match (wiring)
3. `grep 'observe-solve-pipe' commands/nf/solve.md` — returns match (wiring)
4. `grep 'Step 0c' commands/nf/solve.md` — returns match
5. `grep 'solve N,M' commands/nf/observe.md` — returns match
6. `node -e "const m = require('./bin/observe-solve-pipe.cjs'); console.log(Object.keys(m))"` — prints all 4 exports
</verification>

<success_criteria>
- observe-solve-pipe.cjs exists with parseIssueSelection, buildTargetsManifest, writeTargetsManifest, readTargetsManifest
- All tests pass
- observe.md step 7 supports "solve N,M,..." syntax routing selected issues through the pipe
- solve.md accepts --targets flag and documents Step 0c manifest loading
- Existing "solve" (all internal) and single-issue routing remain unchanged
</success_criteria>

<output>
After completion, create `.planning/quick/215-add-observe-solve-auto-pipe-route-select/215-SUMMARY.md`
</output>

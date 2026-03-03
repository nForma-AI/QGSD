---
phase: quick-138
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/gsd-tools.cjs
  - qgsd-core/workflows/progress.md
  - qgsd-core/workflows/resume-project.md
autonomous: true
formal_artifacts: none
requirements: [QUICK-138]

must_haves:
  truths:
    - "gsd-tools.cjs formal-summary subcommand returns JSON with total, complete, pending, covered-by-model, and uncovered requirement counts"
    - "qgsd:progress workflow displays a Formal Coverage section after the Active Debug Sessions section"
    - "qgsd:resume-work workflow displays a Formal Coverage line inside the status box"
    - "Formal Coverage section shows correct counts derived from requirements.json status field and model-registry.json requirement arrays"
    - "Uncovered requirements prompt routes to /qgsd:close-formal-gaps"
    - "Pending requirements prompt routes to /qgsd:new-milestone"
    - "When .formal/requirements.json is missing, formal-summary returns a graceful empty result (not a crash)"
  artifacts:
    - path: "bin/gsd-tools.cjs"
      provides: "formal-summary subcommand"
      contains: "formal-summary"
    - path: "qgsd-core/workflows/progress.md"
      provides: "Formal Coverage section in progress report"
      contains: "Formal Coverage"
    - path: "qgsd-core/workflows/resume-project.md"
      provides: "Formal coverage line in resume status box"
      contains: "formal-summary"
  key_links:
    - from: "qgsd-core/workflows/progress.md"
      to: "bin/gsd-tools.cjs"
      via: "gsd-tools.cjs formal-summary CLI call"
      pattern: "gsd-tools\\.cjs formal-summary"
    - from: "qgsd-core/workflows/resume-project.md"
      to: "bin/gsd-tools.cjs"
      via: "gsd-tools.cjs formal-summary CLI call"
      pattern: "gsd-tools\\.cjs formal-summary"
    - from: "bin/gsd-tools.cjs"
      to: ".formal/requirements.json"
      via: "JSON file read for status counts"
      pattern: "requirements\\.json"
    - from: "bin/gsd-tools.cjs"
      to: ".formal/model-registry.json"
      via: "JSON file read for model coverage"
      pattern: "model-registry\\.json"
---

<objective>
Add a `formal-summary` subcommand to gsd-tools.cjs that computes lightweight formal coverage stats, then add a "Formal Coverage" section to both `qgsd:progress` and `qgsd:resume-work` workflows that calls this subcommand and displays the results.

Purpose: Surface formal verification coverage in the two main status workflows so the user always sees pending requirements, model coverage gaps, and clear routing to `/qgsd:close-formal-gaps` or `/qgsd:new-milestone` to address them.
Output: Updated gsd-tools.cjs with new subcommand, updated progress.md and resume-project.md workflows with Formal Coverage sections.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.formal/requirements.json
@.formal/model-registry.json
@bin/gsd-tools.cjs
@qgsd-core/workflows/progress.md
@qgsd-core/workflows/resume-project.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add formal-summary subcommand to gsd-tools.cjs</name>
  <files>bin/gsd-tools.cjs</files>
  <action>
Add a new `formal-summary` case to the main command switch in `bin/gsd-tools.cjs` (in the QGSD repo source, NOT the installed copy at `~/.claude/qgsd/bin/`). This is a lightweight subcommand that reads two JSON files and computes coverage stats.

**Implementation:**

1. Add a new function `cmdFormalSummary(cwd, raw)` near the other `cmd*` functions. The function should:

   a. Read `.formal/requirements.json` from `cwd`. If missing, output a JSON result with all zeros and `available: false`, then return. Do NOT crash.

   b. Parse the `requirements` array. Count by `status` field:
      - `complete_count`: requirements where `status === "Complete"`
      - `pending_count`: requirements where `status === "Pending"`
      - `total`: total requirements array length

   c. Read `.formal/model-registry.json` from `cwd`. If missing, set model coverage to 0 and uncovered to all requirement IDs.

   d. From model-registry, collect ALL requirement IDs from ALL `models[*].requirements` arrays (flatten + deduplicate into a Set). Skip entries where `requirements` is missing, empty, or not an array.

   e. Compute:
      - `covered_by_model`: size of the deduplicated requirement ID set from model-registry
      - `coverage_pct`: `Math.round((covered_by_model / total) * 100)` (handle divide-by-zero)
      - `uncovered_ids`: requirement IDs from requirements.json that are NOT in the model-registry set (filter `requirements.map(r => r.id)` against the set)
      - `uncovered_count`: length of uncovered_ids
      - `pending_ids`: requirement IDs where status is "Pending"

   f. Output JSON to stdout:
   ```json
   {
     "available": true,
     "total": 205,
     "complete_count": 189,
     "pending_count": 16,
     "covered_by_model": 148,
     "coverage_pct": 72,
     "uncovered_count": 57,
     "uncovered_ids": ["REQ-01", "REQ-02", ...],
     "pending_ids": ["REQ-X", ...]
   }
   ```

2. Add the case to the main switch statement, placing it near the existing `case 'requirements':` block:
   ```javascript
   case 'formal-summary': {
     cmdFormalSummary(cwd, raw);
     break;
   }
   ```

3. Use `path.join(cwd, '.formal', 'requirements.json')` and `path.join(cwd, '.formal', 'model-registry.json')` for file paths — do NOT hardcode absolute paths.

4. Use `fs.existsSync` + `fs.readFileSync` with try/catch. On any parse error, write a warning to stderr and return the `available: false` fallback. Follow the fail-open pattern used throughout gsd-tools.

5. Do NOT import or call `generate-traceability-matrix.cjs` — this subcommand must be lightweight (reads 2 JSON files, no spawning).

**IMPORTANT:** Edit the SOURCE file at `bin/gsd-tools.cjs` in the QGSD repo. The installed copy at `~/.claude/qgsd/bin/gsd-tools.cjs` will be synced by the installer later. Do NOT edit the installed copy directly.
  </action>
  <verify>
1. `node bin/gsd-tools.cjs formal-summary 2>/dev/null | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(d.available === true && d.total > 0 ? 'PASS' : 'FAIL: ' + JSON.stringify(d))"` — must print PASS
2. `node bin/gsd-tools.cjs formal-summary 2>/dev/null | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(d.complete_count + d.pending_count === d.total ? 'PASS: counts match' : 'FAIL: counts mismatch')"` — must print PASS
3. `node bin/gsd-tools.cjs formal-summary 2>/dev/null | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(d.covered_by_model > 0 && d.coverage_pct > 0 ? 'PASS: coverage computed' : 'FAIL')"` — must print PASS
4. `npm test 2>&1 | tail -5` — all existing tests still pass
  </verify>
  <done>gsd-tools.cjs has a `formal-summary` subcommand that reads requirements.json and model-registry.json, computes complete/pending/covered/uncovered counts, and outputs a JSON summary. Returns `available: false` gracefully when files are missing. All existing tests pass.</done>
</task>

<task type="auto">
  <name>Task 2: Add Formal Coverage section to progress.md and resume-project.md workflows</name>
  <files>qgsd-core/workflows/progress.md, qgsd-core/workflows/resume-project.md</files>
  <action>
**qgsd-core/workflows/progress.md** — Add a Formal Coverage section to the report step:

1. In `<step name="report">` (around line 86-130), add a new bash command to gather formal coverage data, placed AFTER the progress bar fetch:

```bash
# Get formal coverage summary
FORMAL=$(node ~/.claude/qgsd/bin/gsd-tools.cjs formal-summary 2>/dev/null)
```

2. Add a new section in the report template, placed AFTER the "Active Debug Sessions" section (after line 124) and BEFORE "What's Next" (line 127). The section should be conditionally displayed — only show it when formal data is available:

```
## Formal Coverage
(Only show this section if FORMAL.available is true)
Requirements: {complete_count} Complete / {pending_count} Pending (of {total})
Model coverage: {coverage_pct}% ({covered_by_model}/{total} requirements linked to formal models)
{If uncovered_count > 0:} {uncovered_count} uncovered — /qgsd:close-formal-gaps to address
{If pending_count > 0:} {pending_count} pending — /qgsd:new-milestone to plan future work
```

3. The section must use `jq` or inline node to parse the FORMAL JSON:
```bash
# Parse formal coverage
FORMAL_AVAIL=$(echo "$FORMAL" | node -e "try{const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));console.log(d.available?'true':'false')}catch{console.log('false')}")
```

Or simply instruct the Claude executor to parse `$FORMAL` JSON inline (since the workflow is a prompt, not a script — the executing Claude reads the JSON output and formats it).

**qgsd-core/workflows/resume-project.md** — Add formal coverage to the status box:

1. In `<step name="present_status">` (around line 132-193), add a bash command to fetch formal data, placed after the existing init/load steps:

```bash
# Get formal coverage summary
FORMAL=$(node ~/.claude/qgsd/bin/gsd-tools.cjs formal-summary 2>/dev/null)
```

2. Add a formal coverage line inside the status box (the ASCII box between lines 136-146). Insert it AFTER the "Progress" line (after line 145) and BEFORE the closing box border:

```
║  Formal: {complete_count}/{total} reqs complete, {coverage_pct}% model coverage  ║
```

3. Add an optional expanded section AFTER the status box (after line 146) that shows when there are uncovered or pending requirements:

```
[If FORMAL.available is true AND (uncovered_count > 0 OR pending_count > 0):]
Formal gaps:
    - {uncovered_count} requirements without formal model coverage
    - {pending_count} requirements still pending
    Actions: /qgsd:close-formal-gaps | /qgsd:new-milestone
```

**IMPORTANT for both files:**
- These workflow files are PROMPTS, not scripts. The Claude executor reads them as instructions. The `$FORMAL` variable is fetched via bash, then the executor formats the output. Use clear conditional language ("Only show if...") so the executor knows when to include/exclude sections.
- Do NOT change any existing sections — only ADD the new formal coverage sections.
- The gsd-tools path in the workflow must use `~/.claude/qgsd/bin/gsd-tools.cjs` (installed location), NOT the repo-relative `bin/gsd-tools.cjs`, because workflows execute from any project directory.
- Both files live in `qgsd-core/workflows/` (the source). The installer syncs them to `~/.claude/qgsd/workflows/`.
  </action>
  <verify>
1. `grep -c "Formal Coverage" qgsd-core/workflows/progress.md` — must be >= 1
2. `grep -c "formal-summary" qgsd-core/workflows/progress.md` — must be >= 1
3. `grep -c "formal-summary" qgsd-core/workflows/resume-project.md` — must be >= 1
4. `grep -c "close-formal-gaps" qgsd-core/workflows/progress.md` — must be >= 1
5. `grep -c "new-milestone" qgsd-core/workflows/progress.md` — must be >= 1
6. `grep "Active Debug Sessions" qgsd-core/workflows/progress.md` — the existing section is still present (no accidental deletion)
7. `grep "PROJECT STATUS" qgsd-core/workflows/resume-project.md` — the existing status box header is still present
  </verify>
  <done>progress.md has a "Formal Coverage" section after "Active Debug Sessions" showing complete/pending counts, model coverage %, and routing to /qgsd:close-formal-gaps and /qgsd:new-milestone. resume-project.md has a formal coverage line in the status box and an expanded gaps section below it. Both call `gsd-tools.cjs formal-summary` and conditionally display results.</done>
</task>

<task type="auto">
  <name>Task 3: Sync gsd-tools.cjs to installed location and run installer</name>
  <files>bin/gsd-tools.cjs</files>
  <action>
After Tasks 1 and 2 are complete, sync the updated files to their installed locations:

1. Copy the updated gsd-tools.cjs to the installed location:
```bash
cp bin/gsd-tools.cjs ~/.claude/qgsd/bin/gsd-tools.cjs
```

2. Run the installer to sync workflow files:
```bash
node bin/install.js --claude --global
```

This propagates:
- `bin/gsd-tools.cjs` -> `~/.claude/qgsd/bin/gsd-tools.cjs` (already done by cp above, but installer may also handle this)
- `qgsd-core/workflows/progress.md` -> `~/.claude/qgsd/workflows/progress.md`
- `qgsd-core/workflows/resume-project.md` -> `~/.claude/qgsd/workflows/resume-project.md`

3. Verify the installed copies have the new content:
```bash
grep "formal-summary" ~/.claude/qgsd/bin/gsd-tools.cjs
grep "Formal Coverage" ~/.claude/qgsd/workflows/progress.md
grep "formal-summary" ~/.claude/qgsd/workflows/resume-project.md
```

4. Run the formal-summary command from the installed location to confirm it works end-to-end:
```bash
node ~/.claude/qgsd/bin/gsd-tools.cjs formal-summary
```

This should output the JSON summary with real data from `.formal/requirements.json` and `.formal/model-registry.json`.
  </action>
  <verify>
1. `node ~/.claude/qgsd/bin/gsd-tools.cjs formal-summary 2>/dev/null | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));console.log(d.available?'PASS':'FAIL')"` — must print PASS
2. `grep "Formal Coverage" ~/.claude/qgsd/workflows/progress.md | wc -l` — must be >= 1
3. `grep "formal-summary" ~/.claude/qgsd/workflows/resume-project.md | wc -l` — must be >= 1
4. `npm test 2>&1 | tail -5` — all tests still pass
  </verify>
  <done>gsd-tools.cjs is synced to installed location. Workflow files are synced via installer. The formal-summary subcommand works from the installed path. All tests pass.</done>
</task>

</tasks>

<verification>
Final comprehensive check after all tasks:
1. `node bin/gsd-tools.cjs formal-summary` — outputs valid JSON with correct counts
2. `node ~/.claude/qgsd/bin/gsd-tools.cjs formal-summary` — installed copy also works
3. `grep "Formal Coverage" qgsd-core/workflows/progress.md` — section present in source
4. `grep "formal-summary" qgsd-core/workflows/resume-project.md` — command reference present in source
5. `grep "Formal Coverage" ~/.claude/qgsd/workflows/progress.md` — section present in installed copy
6. `grep "formal-summary" ~/.claude/qgsd/workflows/resume-project.md` — command reference present in installed copy
7. `npm test 2>&1 | tail -5` — all tests pass
8. `diff qgsd-core/workflows/progress.md ~/.claude/qgsd/workflows/progress.md` — source and installed match (or installer transforms are expected)
</verification>

<success_criteria>
- `gsd-tools.cjs formal-summary` returns JSON with total, complete_count, pending_count, covered_by_model, coverage_pct, uncovered_count, uncovered_ids, pending_ids
- progress.md displays Formal Coverage section with complete/pending counts, model coverage %, and routing links
- resume-project.md displays formal coverage line in status box with expanded gaps section
- Missing .formal/ files result in graceful `available: false` response, not crashes
- All existing tests continue to pass
- Installed copies are synced
</success_criteria>

<output>
After completion, create `.planning/quick/138-add-formal-coverage-section-to-progress-/138-SUMMARY.md`
</output>

---
phase: quick-252
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/solve-focus-filter.cjs
  - bin/solve-focus-filter.test.cjs
  - bin/nf-solve.cjs
  - commands/nf/solve.md
  - commands/nf/solve-diagnose.md
  - commands/nf/solve-report.md
autonomous: true
formal_artifacts: none

must_haves:
  truths:
    - "Running nf:solve with --focus='quorum' scopes diagnostic output to only quorum-related requirement gaps"
    - "Running nf:solve without --focus behaves identically to current behavior (no regression)"
    - "The focus phrase is forwarded from solve.md orchestrator through to all sub-skills and bin/nf-solve.cjs"
    - "The report output includes a (focused: <phrase>) header when focus is active"
  artifacts:
    - path: "bin/solve-focus-filter.cjs"
      provides: "Focus filter module — tokenizes phrase, matches against requirements.json + category-groups.json"
      exports: ["filterRequirementsByFocus"]
    - path: "bin/solve-focus-filter.test.cjs"
      provides: "Unit tests for focus filter matching logic"
      min_lines: 40
  key_links:
    - from: "bin/nf-solve.cjs"
      to: "bin/solve-focus-filter.cjs"
      via: "require() and CLI --focus flag parsing"
      pattern: "require.*solve-focus-filter"
    - from: "commands/nf/solve.md"
      to: "bin/nf-solve.cjs"
      via: "--focus flag forwarding in Agent prompt and CLI args"
      pattern: "--focus"
    - from: "bin/solve-focus-filter.cjs"
      to: ".planning/formal/requirements.json"
      via: "fs.readFileSync to load requirements for filtering"
      pattern: "requirements\\.json"
    - from: "bin/solve-focus-filter.cjs"
      to: ".planning/formal/category-groups.json"
      via: "fs.readFileSync to load category group mapping"
      pattern: "category-groups\\.json"
---

<objective>
Add a `--focus="<phrase>"` filter to `nf:solve` that scopes all diagnostic sweeps and reporting to requirements matching the focus topic. The focus phrase is parsed from skill args, used to filter requirements.json entries by keyword/category match, and forwarded through all sub-skills.

Purpose: Allow targeted solver runs (e.g., `nf:solve the quorum state machine`) that only surface gaps relevant to a specific topic, reducing noise and enabling focused remediation sessions.

Output: New `bin/solve-focus-filter.cjs` module, updated CLI parsing in `bin/nf-solve.cjs`, updated orchestrator and sub-skill .md files to forward the flag.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@commands/nf/solve.md
@commands/nf/solve-diagnose.md
@commands/nf/solve-report.md
@bin/nf-solve.cjs
@.planning/formal/category-groups.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create solve-focus-filter.cjs module with tests</name>
  <files>bin/solve-focus-filter.cjs, bin/solve-focus-filter.test.cjs</files>
  <action>
Create `bin/solve-focus-filter.cjs` exporting a single function:

```js
function filterRequirementsByFocus(focusPhrase, { root = process.cwd() } = {})
```

The function:
1. Returns `null` if `focusPhrase` is falsy (signals "no filter, use all requirements") -- callers check for null to preserve existing behavior
2. Loads `requirements.json` from `{root}/.planning/formal/requirements.json` (envelope format: `reqData.requirements` array)
3. Loads `category-groups.json` from `{root}/.planning/formal/category-groups.json`
4. Tokenizes the focus phrase: lowercase, split on whitespace and hyphens, filter out stop words (the, a, an, to, for, in, of, and, or, is, it, on, by, with, from, that, this, at, as). Keep tokens with length >= 2.
5. For each requirement in requirements.json, compute a match score:
   - +2 if any token appears in the requirement `id` (case-insensitive) (e.g., "quorum" matches "QUORUM-01")
   - +2 if any token appears in the requirement `category` field (case-insensitive)
   - +3 if any token matches a category-group name (look up req.category in category-groups.json to get group name, then match tokens against that group name, case-insensitive)
   - +1 for each token that appears in the requirement `text` field (case-insensitive substring match)
   - +1 if any token appears in the requirement `background` field (case-insensitive substring match)
6. Return a `Set<string>` of requirement IDs with score >= 2 (at least one strong match or two weak matches)

Also export a `describeFocusFilter(focusPhrase, matchedIds, totalIds)` helper that returns a one-line string like: `"Focus: 'quorum' -- 23/287 requirements matched"` for use in report headers.

Create `bin/solve-focus-filter.test.cjs` with tests:
- Returns null for empty/undefined/null focus phrase
- Matches requirement by ID substring (e.g., "quorum" matches QUORUM-01)
- Matches requirement by category group name (e.g., "hooks" matches requirements in "Hooks and Enforcement" group)
- Matches requirement by text content
- Does NOT match completely unrelated requirements (score < 2)
- describeFocusFilter returns correct summary string
- Uses mock data (inline test fixtures), NOT real requirements.json -- to avoid test brittleness

Run tests: `node bin/solve-focus-filter.test.cjs`
  </action>
  <verify>
`node bin/solve-focus-filter.test.cjs` exits 0 with all tests passing.
`node -e "const f = require('./bin/solve-focus-filter.cjs'); console.log(typeof f.filterRequirementsByFocus)"` prints "function".
  </verify>
  <done>
solve-focus-filter.cjs exports filterRequirementsByFocus and describeFocusFilter. All unit tests pass. Module handles null/empty input gracefully by returning null.
  </done>
</task>

<task type="auto">
  <name>Task 2: Wire --focus flag into nf-solve.cjs and orchestrator skill files</name>
  <files>bin/nf-solve.cjs, commands/nf/solve.md, commands/nf/solve-diagnose.md, commands/nf/solve-report.md</files>
  <action>
**A. bin/nf-solve.cjs CLI parsing (lines 53-76 area):**

1. Add `require('./solve-focus-filter.cjs')` at the top near existing requires (line ~46)
2. In the CLI flags section (after `--max-iterations` parsing), add:
```js
let focusPhrase = null;
for (const arg of args) {
  if (arg.startsWith('--focus=')) {
    focusPhrase = arg.slice('--focus='.length).replace(/^["']|["']$/g, '');
  }
}
```
3. After CLI parsing, compute the focus set:
```js
const focusSet = focusPhrase
  ? filterRequirementsByFocus(focusPhrase, { root: ROOT })
  : null;
```
4. Log when focus is active: `if (focusSet) process.stderr.write(TAG + ' Focus filter active: ' + focusPhrase + ' (' + focusSet.size + ' requirements matched)\n');`

**B. Apply filter in sweepRtoF() (line 571):**

After `uncoveredReqs` is computed (around line 604-610 area where uncovered requirements are filtered), add focus filtering:
```js
// Apply focus filter if active
if (focusSet) {
  uncoveredReqs = uncoveredReqs.filter(r => focusSet.has(r.id));
}
```
This must be placed AFTER `uncoveredReqs` is populated but BEFORE the triage/residual counting. The `focusSet` variable is in module scope (set during CLI parsing), so it is accessible inside sweepRtoF.

**C. Apply filter in sweepRtoD() (line 1220):**

After requirements are loaded and the allReqs array is populated, add:
```js
// Apply focus filter if active
if (focusSet) {
  allReqs = allReqs.filter(r => focusSet.has(r.id));
}
```
Place this right after allReqs is extracted from reqData (before the doc scanning loop).

**D. Add focus metadata to computeResidual() output (line 2532):**

In the return object of `computeResidual()`, add:
```js
focus: focusPhrase ? { phrase: focusPhrase, matched: focusSet ? focusSet.size : 0 } : null,
```

**E. Add focus to solve-state.json persistence:**

In main() where `solveState` is assembled (around line 3527), add:
```js
focus: focusPhrase || null,
```

**F. commands/nf/solve.md:**

1. Update the `argument-hint` line (line 4) to add `[--focus="<phrase>"]`:
   `[--report-only] [--max-iterations=N] [--json] [--verbose] [--targets=<path>] [--skip-observe] [--focus="<phrase>"]`
2. In Phase 1 Agent prompt (line ~39), update the flags forwarding to include focus:
   `CLI flags from orchestrator: {flags}` -- this already forwards all flags generically, but add a note:
   After the Agent call blocks in Phase 1, Phase 3a, and Phase 3b, ensure `--focus` is included in the `{flags}` interpolation. The `{flags}` placeholder is resolved by the skill to include all CLI args, so this should work naturally. But in the Phase 3b re-diagnostic call (line ~99), the bash command directly invokes nf-solve.cjs -- update it to forward focus:
   ```
   POST=$(node ~/.claude/nf-bin/nf-solve.cjs --json --report-only --focus="{focus}" --project-root=$(pwd))
   ```
   Add a note before Phase 1 in the `<process>` section:
   ```
   ## Flag Extraction
   Parse all CLI flags from the user's invocation. Extract `--focus="<phrase>"` if present.
   Store as `focus_flag` for forwarding to sub-skills and bin/nf-solve.cjs.
   ```

**G. commands/nf/solve-diagnose.md:**

1. In `<execution_context>` (line ~23), add `--focus="<phrase>"` to the accepted CLI flags list:
   `- \`--focus="<phrase>"\` -- scope diagnostics to requirements matching the focus topic`
2. In the process section where `bin/nf-solve.cjs` is invoked, the flags are already forwarded generically. No additional changes needed.

**H. commands/nf/solve-report.md:**

Read `commands/nf/solve-report.md` first. In the report output formatting section, add logic to display "(focused: <phrase>)" in the report header when focus metadata is present in the input JSON. Add to the report header line:
```
If input JSON contains `focus.phrase`, prepend to the report title: "(focused: {phrase})"
```

IMPORTANT: The `focusSet` and `focusPhrase` variables must be module-level in nf-solve.cjs (not inside a function) so they are accessible from sweepRtoF() and sweepRtoD(). Place them right after the existing CLI parsing block.
  </action>
  <verify>
1. `grep 'solve-focus-filter' bin/nf-solve.cjs` confirms require is present
2. `grep '\-\-focus' bin/nf-solve.cjs` confirms CLI parsing exists
3. `grep 'focusSet' bin/nf-solve.cjs` confirms filter is applied in sweep functions
4. `grep '\-\-focus' commands/nf/solve.md` confirms orchestrator recognizes the flag
5. `grep '\-\-focus' commands/nf/solve-diagnose.md` confirms sub-skill documents the flag
6. `node bin/nf-solve.cjs --json --report-only --focus="quorum" 2>/dev/null | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(d.iterations?.[0]?.residual?.focus?.phrase || 'MISSING')"` prints "quorum"
7. `node bin/nf-solve.cjs --json --report-only 2>/dev/null | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(d.iterations?.[0]?.residual?.focus)"` prints "null" (no regression)
8. Existing test suite: `npm test 2>&1 | tail -5` -- no new failures
  </verify>
  <done>
The --focus flag is parsed in nf-solve.cjs, filters are applied in sweepRtoF and sweepRtoD, focus metadata appears in JSON output, the orchestrator and sub-skill .md files document and forward the flag, and existing behavior without --focus is unchanged.
  </done>
</task>

</tasks>

<verification>
1. Full solver run without focus: `node bin/nf-solve.cjs --json --report-only 2>/dev/null` produces output with `focus: null` -- confirms no regression
2. Focused solver run: `node bin/nf-solve.cjs --json --report-only --focus="hooks" 2>/dev/null` produces output with reduced r_to_f and r_to_d residuals scoped to hook-related requirements
3. Focus filter unit tests: `node bin/solve-focus-filter.test.cjs` all pass
4. Existing test suite: `npm test` no new failures
</verification>

<success_criteria>
- `bin/solve-focus-filter.cjs` exists and exports filterRequirementsByFocus + describeFocusFilter
- Unit tests in `bin/solve-focus-filter.test.cjs` pass
- `bin/nf-solve.cjs` parses --focus, applies filter in sweepRtoF and sweepRtoD, includes focus metadata in output
- `commands/nf/solve.md` argument-hint includes --focus, flag forwarding works
- Running without --focus produces identical output to before (no regression)
- Running with --focus produces scoped output with fewer requirement gaps
</success_criteria>

<output>
After completion, create `.planning/quick/252-add-focus-topic-filter-to-nf-solve/252-SUMMARY.md`
</output>

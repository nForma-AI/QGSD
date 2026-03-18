---
phase: quick-326
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - commands/nf/solve-diagnose.md
  - core/workflows/close-formal-gaps.md
  - .planning/quick/326-add-implicit-state-machine-detection-to-/326-SUMMARY.md
autonomous: true
requirements: []
formal_artifacts: none

must_haves:
  truths:
    - "solve-diagnose flags files with 3+ related boolean flags as implicit FSM candidates in its diagnostic output"
    - "solve-diagnose flags files with string/enum variables having 3+ distinct values used in conditionals as implicit FSM candidates"
    - "close-formal-gaps includes 'implicit FSM' as a recognized gap type when scanning for uncovered files"
    - "close-formal-gaps suggests running fsm-to-tla.cjs --scaffold-config when an implicit FSM gap is detected"
    - "core/workflows/close-formal-gaps.md is the repo-internal source; to propagate to the installed location, run node bin/install.js --claude --global"
  artifacts:
    - path: "commands/nf/solve-diagnose.md"
      provides: "Implicit FSM detection step added after git churn heatmap in Step 1"
      contains: "fsm_candidates"
    - path: "core/workflows/close-formal-gaps.md"
      provides: "Implicit FSM gap type in Step 1 detect_gaps, with fsm-to-tla.cjs suggestion"
      contains: "implicit_fsm"
  key_links:
    - from: "commands/nf/solve-diagnose.md"
      to: "output_contract JSON"
      via: "fsm_candidates array field added to JSON output schema"
      pattern: "fsm_candidates"
    - from: "core/workflows/close-formal-gaps.md"
      to: "~/.claude/nf/workflows/close-formal-gaps.md"
      via: "node bin/install.js --claude --global (run manually after task 2)"
      pattern: "implicit_fsm"
---

<objective>
Add implicit state machine detection heuristics to two nForma workflows:
1. `solve-diagnose` — detects ad-hoc control flow patterns (3+ related boolean flags OR enum-like strings with 3+ distinct values in conditionals) in hot-zone files, appends FSM candidates to diagnostic output
2. `close-formal-gaps` — recognizes "implicit FSM" as a coverage gap type, suggests `bin/fsm-to-tla.cjs --scaffold-config` when such gaps are found

Purpose: Close the detection gap — plan-phase.md and solve-remediate.md already bias toward state machines, but no workflow currently catches *existing* implicit FSMs before they're formally modeled.

Output: Modified solve-diagnose.md (commands/nf/), modified close-formal-gaps.md synced to core/workflows/ (repo-internal source). To propagate to the installed location, run node bin/install.js --claude --global separately.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
</execution_context>

<context>
@.planning/STATE.md
@commands/nf/solve-diagnose.md
@core/workflows/close-formal-gaps.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add implicit FSM detection step to solve-diagnose</name>
  <files>commands/nf/solve-diagnose.md</files>
  <action>
After the "Issue Classification" block at the end of `<process>` (after the `node bin/issue-classifier.cjs` paragraph, before `</process>`), insert a new subsection titled `### Implicit State Machine Detection`.

The section should read:

```markdown
### Implicit State Machine Detection

Scan the top files from the git churn heatmap (up to top 10 by churn score) for implicit state machine patterns.

**File source:** The heatmap command (`node bin/git-heatmap.cjs`) already ran above and printed a human-readable summary. Use Grep on each file path extracted from the on-disk artifact at `.planning/formal/evidence/git-heatmap.json` using the field path `uncovered_hot_zones[].file` (sorted by `priority` descending, take first 10 code files). Do NOT read the full JSON into agent context — use a shell command to extract the file list, filtering to code files only and excluding non-source paths:
```bash
jq -r '[.uncovered_hot_zones[] | select(.file | test("\\.(js|ts|cjs|mjs|py|go|rb|java|cs|rs)$")) | select(.file | test("^\\.planning/|^dist/|^node_modules/") | not)] | sort_by(.priority // 0) | reverse | .[].file' .planning/formal/evidence/git-heatmap.json | head -10
```

**Heuristic A — Multi-flag boolean cluster:**
For each file, search for boolean variable declarations or assignments (lines matching `(bool|boolean|let|var|const)\s+\w+(Pending|Active|Done|Started|Running|Stopped|Failed|Ready|Busy|Locked|Open|Closed|Enabled|Disabled)\s*[=:]`). If 3 or more such flags appear in the same file, record it as an FSM candidate with reason `"multi-flag-boolean"`.

**Heuristic B — Enum-like string state variable (heuristic — may produce false positives; intended for candidate surfacing only, not proof):**
For each file, search for patterns where string literals appear in 3 or more conditional comparisons (e.g., `if.*===\s*['"][A-Z_]+['"]` or `case\s+['"][A-Z_]+['"]:`). If 3+ such patterns appear in the file, flag it as an FSM candidate with reason `"enum-string-state"`. Note: a grep count of string literals cannot prove single-variable usage — this heuristic flags files as FSM candidates with possible false positives.

Both heuristics are **fail-open**: if the heatmap file is missing, if grep errors, or if a target file does not exist, skip silently and proceed.

Log results:
- If 0 candidates found: `"Step 1 FSM scan: No implicit state machine patterns detected in top ${N} heatmap files"`
- If candidates found: `"Step 1 FSM scan: {count} implicit FSM candidate(s) detected — recommend extraction + fsm-to-tla.cjs --scaffold-config"`
  For each candidate, log: `"  {file}: {reason} (flags: {matched_names_or_values})"`

Store the candidates array as `fsm_candidates` in the solve context.
```

Also add `"fsm_candidates": []` to the `<output_contract>` JSON schema block (the JSON object in the output_contract section) — add it as a sibling of `"issues"` with description `/* implicit FSM candidates from heatmap scan */`.
  </action>
  <verify>grep -n "fsm_candidates" /Users/jonathanborduas/code/QGSD/commands/nf/solve-diagnose.md | head -5</verify>
  <done>"fsm_candidates" appears in both the process section (detection step) and the output_contract JSON schema in commands/nf/solve-diagnose.md</done>
</task>

<task type="auto">
  <name>Task 2: Add implicit FSM gap type to close-formal-gaps</name>
  <files>
    core/workflows/close-formal-gaps.md
  </files>
  <action>
In `core/workflows/close-formal-gaps.md`, within the `<step name="detect_gaps">` block (Step 1), after the coverage gap summary table display (after the `Otherwise, present the categories...` paragraph but before the `**Bug context parsing (MRF-01):**` block), insert a new subsection:

```markdown
### Implicit FSM Gap Detection

After computing uncovered requirements, scan the top hot-zone files from the git churn heatmap for implicit state machine patterns. This surfaces code that should be formally modeled as a state machine but hasn't been flagged via requirements yet.

**File source:** Extract the top 10 code files from `.planning/formal/evidence/git-heatmap.json` using the `uncovered_hot_zones` array (sorted by `priority` descending). Use a shell command to avoid reading the full 3MB file into context, filtering to code extensions and excluding non-source paths:
```bash
jq -r '[.uncovered_hot_zones[] | select(.file | test("\\.(js|ts|cjs|mjs|py|go|rb|java|cs|rs)$")) | select(.file | test("^\\.planning/|^dist/|^node_modules/") | not)] | sort_by(.priority // 0) | reverse | .[].file' .planning/formal/evidence/git-heatmap.json | head -10
```
If the heatmap file is missing or the command errors, skip this step silently (fail-open).

For each file path in that list:

1. Run a grep for multi-flag boolean clusters: `grep -cE "(bool|boolean|let|var|const)\s+\w*(Pending|Active|Done|Started|Running|Stopped|Failed|Ready|Busy|Locked|Open|Closed|Enabled|Disabled)" {file}` — if count ≥ 3, record as implicit FSM gap. (Uses the same declaration-oriented pattern as solve-diagnose for consistency.)
2. Run a grep for enum-like string comparisons: `grep -cE "===\s*['\"][A-Z_]{3,}['\"]|case\s+['\"][A-Z_]{3,}['\"]:" {file}` — if count ≥ 3, record as implicit FSM gap.

Both greps are **fail-open**: if a file does not exist or grep errors, skip that file silently. Note: the coverage check is requirement-centric, not file-centric, so "no formal model yet" is a heuristic — some files may already be partially modeled via a linked requirement. Soften output language accordingly: say "may not yet have a formal model" rather than asserting absence.

If implicit FSM gaps are found, append a section to the coverage gap summary:

```
Implicit FSM Candidates (may not yet have a formal model)
─────────────────────────────────────────────
  src/foo/bar.ts                multi-flag-boolean  (Pending, Active, Done, ...)
  src/hooks/dispatch.ts         enum-string-state   (IDLE, RUNNING, FAILED, ...)

Recommended action: run `node bin/fsm-to-tla.cjs --scaffold-config` to generate
TLA+ scaffold configs for these files, then use close-formal-gaps to cover them.
```

If `--batch` is active, log the implicit FSM candidates but proceed without pausing. If not in batch mode, present these alongside uncovered requirements so the user can decide whether to address them in this session.
```
  </action>
  <verify>grep -n "implicit_fsm\|Implicit FSM\|fsm-to-tla" /Users/jonathanborduas/code/QGSD/core/workflows/close-formal-gaps.md | head -10</verify>
  <done>"Implicit FSM" detection block appears in core/workflows/close-formal-gaps.md Step 1 with uncovered_hot_zones field reference and no model-registry filter. Note: core/workflows/close-formal-gaps.md IS the durable repo source — no cp needed. To propagate to the installed location, run `node bin/install.js --claude --global` after this task completes.</done>
</task>

</tasks>

<verification>
1. `grep -n "fsm_candidates" commands/nf/solve-diagnose.md` returns at least 2 matches (process section + output_contract)
2. `grep -n "Implicit FSM" core/workflows/close-formal-gaps.md` returns matches in detect_gaps step
3. `grep -n "fsm-to-tla" core/workflows/close-formal-gaps.md` returns the scaffold suggestion
4. `grep -n "uncovered_hot_zones" core/workflows/close-formal-gaps.md` returns a match (confirms correct heatmap field, not top_files)
5. Both heuristics are documented as fail-open (no blocking on grep errors or missing files)
6. `.planning/quick/326-add-implicit-state-machine-detection-to-/326-SUMMARY.md` exists and contains all three required headings: `grep -cE "^## (Summary|What Changed|Verification)" .planning/quick/326-add-implicit-state-machine-detection-to-/326-SUMMARY.md` returns exactly `3` (use `grep -cE` to count matching lines; a count other than 3 means a heading is missing or duplicated)
</verification>

<success_criteria>
- solve-diagnose output_contract JSON schema includes fsm_candidates field
- solve-diagnose Step 1 scan logs FSM candidates from top heatmap files using both heuristics
- close-formal-gaps Step 1 detect_gaps shows implicit FSM candidates alongside requirement coverage gaps
- close-formal-gaps recommends fsm-to-tla.cjs --scaffold-config for detected implicit FSMs
- core/workflows/close-formal-gaps.md is the durable repo source and is edited directly; installed propagation requires running node bin/install.js --claude --global separately
- No existing workflow behavior changed — both additions are additive and fail-open
</success_criteria>

<output>
After completion, create `.planning/quick/326-add-implicit-state-machine-detection-to-/326-SUMMARY.md` with:
- Files modified
- What was added to each workflow
- Verification commands run and their output

<note>326-SUMMARY.md is created by the executor as a standard deliverable per nf-executor constraints. No explicit task is needed here — the executor's built-in output phase handles this file.</note>
</output>

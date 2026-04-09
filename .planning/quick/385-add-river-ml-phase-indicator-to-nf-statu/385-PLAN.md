---
phase: quick-385
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - hooks/nf-statusline.js
  - hooks/dist/nf-statusline.js
  - hooks/nf-statusline.test.js
autonomous: true
requirements: [INTENT-01]
formal_artifacts: none
must_haves:
  truths:
    - "Statusline shows 'River: exploring' when any arm in any task type has visits < minExplore (20)"
    - "Statusline shows 'River: active' when all arms across all task types have visits >= minExplore"
    - "Statusline shows nothing River-related when .nf-river-state.json does not exist"
    - "Statusline shows nothing River-related when .nf-river-state.json is malformed"
    - "All existing statusline tests still pass"
  artifacts:
    - path: "hooks/nf-statusline.js"
      provides: "River ML phase indicator in statusline output"
      contains: "River:"
    - path: "hooks/dist/nf-statusline.js"
      provides: "Dist copy of statusline with River indicator"
      contains: "River:"
    - path: "hooks/nf-statusline.test.js"
      provides: "Test coverage for River phase indicator"
      contains: "River"
  key_links:
    - from: "hooks/nf-statusline.js"
      to: ".nf-river-state.json"
      via: "fs.readFileSync with try/catch fail-silent"
      pattern: "nf-river-state"
---

<objective>
Add a River ML phase indicator to the nf-statusline hook that reads `.nf-river-state.json` from the workspace directory and displays the current learning phase.

Purpose: Give the user visibility into whether River ML is still exploring (gathering data on all arms) or actively exploiting learned preferences for quorum slot routing.

Output: Updated `hooks/nf-statusline.js` with River indicator, synced dist copy, and comprehensive tests.
</objective>

<execution_context>
@./CLAUDE.md
</execution_context>

<context>
@hooks/nf-statusline.js
@hooks/nf-statusline.test.js
@bin/routing-policy.cjs (lines 180-220 for state file structure and minExplore default)
@.nf-river-state.json (example state file for reference)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add River ML phase indicator to nf-statusline.js</name>
  <files>hooks/nf-statusline.js, hooks/dist/nf-statusline.js</files>
  <action>
Add a River ML phase indicator section to `hooks/nf-statusline.js`, placed after the update-available check (line ~174) and before the final output section (line ~177).

**Reading the state file:**
- Construct path: `path.join(dir, '.nf-river-state.json')` where `dir` is the workspace current_dir (already extracted on line 54).
- Read with `fs.readFileSync` wrapped in try/catch. On ANY error (ENOENT, parse error, etc.), set `riverIndicator = ''` and continue (fail-silent, no stderr output).
- Parse JSON. Expected structure: `{ qTable: { [taskType]: { [armName]: { q, visits, lastUpdate } } } }`

**Determining phase:**
- Define `const RIVER_MIN_EXPLORE = 20;` (matches the default in routing-policy.cjs).
- Iterate all task types in `qTable`. For each task type, iterate all arms.
- If ANY arm across ANY task type has `visits < RIVER_MIN_EXPLORE`, phase is "exploring".
- If ALL arms across ALL task types have `visits >= RIVER_MIN_EXPLORE`, phase is "active".
- Edge case: if qTable is empty or has no arms, treat as no indicator (empty string).

**Formatting the indicator:**
- Exploring: `riverIndicator = ' \x1b[36mRiver: exploring\x1b[0m'` (cyan)
- Active: `riverIndicator = ' \x1b[32mRiver: active\x1b[0m'` (green)

**Inserting into output:**
- Append `riverIndicator` after the context bar in the output lines (lines 179/181). The River indicator appears at the end of the statusline, after `${ctx}`.
- Both output paths (with task and without task) must include `${riverIndicator}`.

**After editing hooks/nf-statusline.js, copy the file to hooks/dist/nf-statusline.js** to keep them in sync (per git-workflow rules).
  </action>
  <verify>
Run: `node hooks/nf-statusline.test.js` — all existing tests must pass (exit code 0).
Manual smoke: `echo '{"model":{"display_name":"M"},"workspace":{"current_dir":"'"$(pwd)"'"}}' | node hooks/nf-statusline.js` — should show "River: exploring" since the current .nf-river-state.json has arms with visits < 20.
Verify dist sync: `diff hooks/nf-statusline.js hooks/dist/nf-statusline.js` — must show no differences.
  </verify>
  <done>
River phase indicator appears in statusline output when .nf-river-state.json exists. Shows "exploring" or "active" based on arm visit counts. Fails silently when file missing or malformed. Dist copy matches source.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add test coverage for River ML phase indicator</name>
  <files>hooks/nf-statusline.test.js</files>
  <action>
Add the following test cases to `hooks/nf-statusline.test.js`, following the existing pattern of spawning the hook as a child process with mock stdin.

For tests that need a `.nf-river-state.json` file, create a temp directory (using the existing `makeTempDir` pattern), write the state file there, and pass `workspace.current_dir` pointing to that temp dir. Clean up in `finally` blocks.

**TC15: River exploring — arm with visits below minExplore**
- Create temp dir with `.nf-river-state.json` containing:
  ```json
  {"qTable":{"implement":{"codex-1":{"q":0.5,"visits":5},"gemini-1":{"q":0.3,"visits":2}}}}
  ```
- Pass `workspace.current_dir` as the temp dir.
- Assert stdout includes `River: exploring` (both visits < 20).
- Assert stdout includes cyan ANSI code `\x1b[36m`.

**TC16: River active — all arms above minExplore**
- Create temp dir with `.nf-river-state.json` containing:
  ```json
  {"qTable":{"implement":{"codex-1":{"q":0.8,"visits":25},"gemini-1":{"q":0.6,"visits":30}}}}
  ```
- Pass `workspace.current_dir` as the temp dir.
- Assert stdout includes `River: active`.
- Assert stdout includes green ANSI code `\x1b[32m`.

**TC17: No state file — no River indicator**
- Create temp dir WITHOUT `.nf-river-state.json`.
- Pass `workspace.current_dir` as the temp dir.
- Assert stdout does NOT include `River:`.

**TC18: Malformed state file — no River indicator (fail-silent)**
- Create temp dir with `.nf-river-state.json` containing `not valid json`.
- Pass `workspace.current_dir` as the temp dir.
- Assert stdout does NOT include `River:`.
- Assert exit code is 0.

**TC19: Mixed task types — one exploring, one active**
- Create temp dir with `.nf-river-state.json` containing:
  ```json
  {"qTable":{"implement":{"codex-1":{"q":0.8,"visits":25},"gemini-1":{"q":0.6,"visits":30}},"review":{"codex-1":{"q":0.1,"visits":3}}}}
  ```
- Assert stdout includes `River: exploring` (review task type has arm with visits < 20).

**TC20: Empty qTable — no River indicator**
- Create temp dir with `.nf-river-state.json` containing `{"qTable":{}}`.
- Assert stdout does NOT include `River:`.
  </action>
  <verify>
Run: `node --test hooks/nf-statusline.test.js` — all tests (TC1-TC20) must pass with exit code 0.
Run: `npm test` — full test suite passes.
  </verify>
  <done>
Six new test cases (TC15-TC20) cover: exploring phase, active phase, missing state file, malformed state file, mixed task types, and empty qTable. All tests pass.
  </done>
</task>

</tasks>

<verification>
1. `node --test hooks/nf-statusline.test.js` — all 20 tests pass
2. `npm test` — full test suite passes
3. `diff hooks/nf-statusline.js hooks/dist/nf-statusline.js` — no differences
4. Manual: `echo '{"model":{"display_name":"M"},"workspace":{"current_dir":"'"$(pwd)"'"}}' | node hooks/nf-statusline.js` shows River indicator
</verification>

<success_criteria>
- Statusline displays "River: exploring" (cyan) when any arm has visits < 20
- Statusline displays "River: active" (green) when all arms have visits >= 20
- No River indicator when .nf-river-state.json is absent or malformed
- All 20 test cases pass
- hooks/dist/nf-statusline.js matches hooks/nf-statusline.js
</success_criteria>

<output>
After completion, create `.planning/quick/385-add-river-ml-phase-indicator-to-nf-statu/385-SUMMARY.md`
</output>

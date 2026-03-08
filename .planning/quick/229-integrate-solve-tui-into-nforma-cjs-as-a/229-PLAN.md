---
phase: quick-229
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/nForma.cjs
autonomous: true
must_haves:
  truths:
    - "F5 key switches to Solve module in nForma TUI"
    - "Browse Items shows all 4 sweep categories with item counts"
    - "Each category action (D->C, C->R, T->R, D->R) renders items in blessed contentBox with pagination"
    - "Manage Suppressions shows acknowledged-false-positives.json entries and patterns"
    - "Items can be acknowledged as false positives via promptList interaction"
    - "Tab/Shift-Tab cycles through all 5 modules including Solve"
  artifacts:
    - path: "bin/nForma.cjs"
      provides: "F5 Solve module with 7 menu items and blessed-based action handlers"
      contains: "solve-browse"
  key_links:
    - from: "bin/nForma.cjs"
      to: "bin/solve-tui.cjs"
      via: "require('./solve-tui.cjs')"
      pattern: "require.*solve-tui"
    - from: "bin/nForma.cjs dispatch()"
      to: "solveTui.loadSweepData()"
      via: "action handler delegation"
      pattern: "loadSweepData"
---

<objective>
Integrate solve-tui.cjs into nForma.cjs as a 5th module (F5: Solve).

Purpose: Provide access to formal verification sweep items (broken claims, untraced modules, orphan tests, unbacked claims) directly within the nForma TUI rather than requiring a separate CLI invocation.

Output: Updated bin/nForma.cjs with Solve module, F5 keybinding, and blessed-based action handlers that delegate data loading to solve-tui.cjs exports.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@bin/nForma.cjs
@bin/solve-tui.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add Solve module definition and F5 keybinding</name>
  <files>bin/nForma.cjs</files>
  <action>
1. Near the top of the file (around the existing require statements), add:
   `const solveTui = require('./solve-tui.cjs');`

2. Add a 5th entry to the MODULES array (line ~266, after the Sessions entry at line ~329):
   ```js
   {
     name: 'Solve',
     icon: '\uD83D\uDD0D',
     art: ['\u2580\u2588\u2580', ' \u2588 ', ' \u2588 '],
     key: 'f5',
     items: [
       { label: '  Browse Items',           action: 'solve-browse' },
       { label: '  D->C Broken Claims',     action: 'solve-dtoc' },
       { label: '  C->R Untraced Modules',  action: 'solve-ctor' },
       { label: '  T->R Orphan Tests',      action: 'solve-ttor' },
       { label: '  D->R Unbacked Claims',   action: 'solve-dtor' },
       { label: ' \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500', action: 'sep' },
       { label: '  Manage Suppressions',    action: 'solve-suppressions' },
     ],
   }
   ```

3. Add F5 keybinding in the key bindings section (line ~2841, after the f4 binding):
   `screen.key(['f5'], () => switchModule(4));`

4. The tab/shift-tab bindings already use `MODULES.length` so they will automatically include the new module.
  </action>
  <verify>
Run: `node -e "const m = require('./bin/nForma.cjs')._pure; console.log('exports ok')" 2>/dev/null || node -c bin/nForma.cjs && echo "syntax ok"`
Grep: `grep -c 'solve-browse\|solve-dtoc\|solve-ctor\|solve-ttor\|solve-dtor\|solve-suppressions' bin/nForma.cjs` returns 6+
Grep: `grep 'f5.*switchModule' bin/nForma.cjs` returns a match
  </verify>
  <done>MODULES array has 5 entries, F5 keybinding registered, solve-tui.cjs imported</done>
</task>

<task type="auto">
  <name>Task 2: Add Solve action handlers using blessed rendering</name>
  <files>bin/nForma.cjs</files>
  <action>
Add action handlers in the dispatch() function's if/else chain (around line ~2554, after session handlers) for all 6 solve actions. Use blessed patterns already established in nForma.cjs (setContent, promptList, toast). Do NOT use readline/raw stdin patterns from solve-tui.cjs.

**solve-browse handler** (renders overview of all categories):
- Call `solveTui.loadSweepData()` to get category data
- Build lines array with `{bold}Solve Items{/bold}` header
- For each of the 4 categories: show label, item count, and error if any
- Show total count summary at bottom
- Call `setContent('Solve - Browse', lines.join('\n'))`

**solve-dtoc / solve-ctor / solve-ttor / solve-dtor handlers** (renders items for one category):
- Map action string to solveTui.CATEGORIES key: `{ 'solve-dtoc': 'dtoc', 'solve-ctor': 'ctor', 'solve-ttor': 'ttor', 'solve-dtor': 'dtor' }`
- Call `solveTui.loadSweepData()`, extract the matching category
- If error, show in red via setContent and return
- If no items, show "No items found" and return
- Build paginated display: use PAGE_SIZE=20, show items with index numbers
- For each item show: index, summary (truncated to fit), and type-specific details (doc_file, file, line)
- Use `{cyan-fg}` for file paths, `{yellow-fg}` for summaries, `{gray-fg}` for details
- At bottom show: "Page X/Y | Select item to act..."
- After rendering, present a `promptList` with item labels + "[Back]" option
- On item select, show item detail in contentBox with full info (summary, file, line, reason, etc.)
- Then offer another `promptList`: "Acknowledge as FP", "Add Regex Suppression", "Back"
  - Acknowledge: call `solveTui.acknowledgeItem(item)`, toast success/failure
  - Regex: use `promptInput` to get regex string + reason, call `solveTui.addRegexPattern(item, regex, reason)`, toast result

Create a helper function `async function solveCategoryFlow(catKey)` to avoid duplicating this logic 4 times. Each solve-dtoc/ctor/ttor/dtor action just calls `await solveCategoryFlow('dtoc')` etc.

**solve-suppressions handler:**
- Call `solveTui.readFPFile()` to get current FP data
- Build lines showing:
  - Header: `{bold}Acknowledged False Positives{/bold}`
  - Count of entries and patterns
  - List each entry with type, value, reason, date
  - Separator
  - List each pattern with type, regex, reason, enabled status
  - If empty, show "No suppressions configured"
- Call `setContent('Solve - Suppressions', lines.join('\n'))`

Pattern reference: Follow `reqCoverageGapsFlow()` (line 2787) for simple setContent rendering, and `reqTraceabilityFlow()` (line 2690) for promptList-based drill-down.
  </action>
  <verify>
Run: `node -c bin/nForma.cjs && echo "syntax ok"`
Grep: `grep -c 'solveCategoryFlow\|solve-browse\|solve-suppressions' bin/nForma.cjs` returns 3+ matches in dispatch
Manual: Launch `node bin/nForma.cjs`, press F5, verify module switches. Select Browse Items, verify category counts appear. Select a specific category, verify items render with pagination.
  </verify>
  <done>
All 6 solve actions dispatch correctly: browse shows category overview with counts, individual categories show paginated items with acknowledge/suppress actions, suppressions shows FP entries and patterns. All rendering uses blessed setContent/promptList/promptInput — no readline usage.
  </done>
</task>

</tasks>

<verification>
- `node -c bin/nForma.cjs` passes (syntax valid)
- `grep 'solve-tui' bin/nForma.cjs` confirms require import
- `grep -c "action: 'solve-" bin/nForma.cjs` returns 7 (6 actions + 1 sep)
- `grep 'f5.*switchModule' bin/nForma.cjs` confirms F5 keybinding
- `grep 'solveCategoryFlow' bin/nForma.cjs` confirms shared handler function exists
- `node bin/nForma.cjs` launches without crash, F5 shows Solve module
</verification>

<success_criteria>
nForma.cjs has a working Solve module (F5) with browse overview, per-category item listing with acknowledge/suppress actions, and suppression management — all rendered through blessed widgets consistent with existing modules.
</success_criteria>

<output>
After completion, create `.planning/quick/229-integrate-solve-tui-into-nforma-cjs-as-a/229-SUMMARY.md`
</output>

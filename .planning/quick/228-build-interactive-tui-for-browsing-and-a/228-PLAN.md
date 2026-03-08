---
phase: quick-228
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/solve-tui.cjs
  - .planning/formal/acknowledged-false-positives.json
autonomous: true
requirements: [QUICK-228]
formal_artifacts: none

must_haves:
  truths:
    - "User can launch TUI and see a main menu with 4 sweep categories"
    - "User can navigate into a category and see paginated items"
    - "User can acknowledge an item as false positive and it persists to acknowledged-false-positives.json"
    - "User can add a regex suppression pattern"
    - "User can view detail (file content around the line) for any item"
    - "ESC always reduces navigation depth (EscapeProgress invariant)"
    - "Navigation depth never exceeds 3 (DepthBounded invariant)"
    - "No state exists where all inputs are ignored (NoDeadlock invariant)"
  artifacts:
    - path: "bin/solve-tui.cjs"
      provides: "Interactive TUI for browsing solve sweep items"
      min_lines: 400
  key_links:
    - from: "bin/solve-tui.cjs"
      to: "bin/nf-solve.cjs"
      via: "require() for sweep functions"
      pattern: "require.*nf-solve"
    - from: "bin/solve-tui.cjs"
      to: ".planning/formal/acknowledged-false-positives.json"
      via: "fs.readFileSync/writeFileSync for FP persistence"
      pattern: "acknowledged-false-positives\\.json"
---

<objective>
Build an interactive terminal UI at bin/solve-tui.cjs that imports sweep functions from
bin/nf-solve.cjs, presents human-gated items (D->C broken claims, C->R untraced modules,
T->R orphan tests, D->R unbacked claims) in a paginated navigable interface, and supports
actions: acknowledge as false positive, add regex suppression, view item detail.

Purpose: Currently nf-solve output is truncated in terminal reports. The TUI provides full
browsable access to all items with inline actions to reduce false positive noise.

Output: bin/solve-tui.cjs — standalone CLI tool, zero external dependencies.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@bin/nf-solve.cjs
@bin/cross-layer-dashboard.cjs
@.planning/formal/acknowledged-false-positives.json
@.planning/formal/spec/tui-nav/invariants.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Build core TUI engine with navigation and sweep data loading</name>
  <files>bin/solve-tui.cjs</files>
  <action>
Create bin/solve-tui.cjs as a Node.js CLI tool using only built-in modules (readline, fs, path).

**Architecture — 3-level depth model (satisfies DepthBounded invariant, MaxDepth=3):**
- depth=0: Main menu — lists 4 categories: D->C Broken Claims, C->R Untraced Modules, T->R Orphan Tests, D->R Unbacked Claims. Show item count per category.
- depth=1: Category list view — paginated list of items (10 per page). Show page N/M. Each item shows a 1-line summary.
- depth=2: Item detail view — full detail for selected item plus action menu.

**Key bindings (satisfy EscapeProgress + NoDeadlock invariants):**
- ESC: Always go up one depth level (depth=2->1, depth=1->0, depth=0->exit). This is the EscapeProgress invariant: ESC always reduces depth.
- Up/Down arrows: Navigate within current list
- Enter: Select item (increases depth)
- Page Up/Down or n/p: Navigate pages in list view
- q: Quit from any depth
- At depth=0, ESC also quits (depth would go to -1, so exit)

**Data loading:**
- On startup, require('../bin/nf-solve.cjs') and call sweepDtoC(), sweepCtoR(), sweepTtoR(), sweepDtoR()
- Store results in memory. Map each sweep result to a uniform item format:
  - D->C: items from detail.broken_claims (each has doc_file, line, type, value, reason, category)
  - C->R: items from detail.untraced_modules (each has file)
  - T->R: items from detail.orphan_tests (string paths)
  - D->R: items from detail.unbacked_claims (each has doc_file, line, claim_text)

**Rendering (follow cross-layer-dashboard.cjs box-drawing patterns):**
- Use box-drawing characters for borders (Unicode: corners, horizontal/vertical lines)
- Clear screen on each render (process.stdout.write('\x1B[2J\x1B[0;0H'))
- Header bar with "nForma Solve TUI" and current breadcrumb path
- Footer with key hints contextual to current depth
- Use ANSI colors: \x1B[1m bold, \x1B[36m cyan for headers, \x1B[33m yellow for warnings, \x1B[0m reset

**Filtering (at depth=1):**
- Press 'f' to enter filter mode — prompts for search text at bottom of screen
- Filters items by substring match across all fields (case-insensitive)
- Press 'f' again or ESC from filter prompt to clear filter
- For D->C view, press 't' to cycle type filter (all -> file_path -> cli_command -> dependency -> all)
- For D->C view, press 'c' to cycle category filter (all -> user -> developer -> examples -> all)

**stdin handling:**
- Use readline with process.stdin in raw mode (readline.emitKeypressEvents, stdin.setRawMode(true))
- Listen for 'keypress' events
- Handle multi-byte escape sequences for arrow keys (\x1B[A, \x1B[B, etc.)

**Error handling:**
- If a sweep function throws, show "Error loading [category]: [message]" in main menu instead of crashing
- Wrap all fs operations in try/catch
  </action>
  <verify>
Run: `node bin/solve-tui.cjs --help` prints usage info (add --help flag that prints usage and exits without entering interactive mode).
Run: `node -e "const m = require('./bin/solve-tui.cjs'); console.log(typeof m.loadSweepData)"` prints "function" (export loadSweepData for testability).
Run: `head -1 bin/solve-tui.cjs` shows `#!/usr/bin/env node`.
  </verify>
  <done>
bin/solve-tui.cjs exists with shebang, loads sweep data from nf-solve.cjs exports, renders a 3-depth TUI with box-drawing, supports arrow/enter/ESC navigation, pagination with 10 items per page, and text/type/category filtering. ESC always reduces depth. --help flag works without entering interactive mode.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add item actions — acknowledge FP, add regex pattern, view detail</name>
  <files>bin/solve-tui.cjs, .planning/formal/acknowledged-false-positives.json</files>
  <action>
Extend solve-tui.cjs with actions available at depth=2 (item detail view).

**Item detail view (depth=2):**
- Show full item data in a bordered box:
  - D->C: doc_file, line number, claim type, value, reason, category, weight
  - C->R: file path, with a snippet of the file's first 5 lines (fs.readFileSync, truncate)
  - T->R: test file path, show first 10 lines of the file
  - D->R: doc_file, line number, claim_text
- For items with line numbers, show context: read the file and display lines [line-3, line+3] with line numbers, highlighting the target line in yellow

**Action: Acknowledge as false positive (key 'a'):**
- Read .planning/formal/acknowledged-false-positives.json
- For D->C items: append to entries[] an object { doc_file, value, type, reason: "Acknowledged via TUI", acknowledged_at: ISO date string }
- For other sweep types: append { source: "C->R"|"T->R"|"D->R", value: <file or claim_text>, reason: "Acknowledged via TUI", acknowledged_at: ISO date string }
- Write back with JSON.stringify(data, null, 2)
- Show confirmation message "Acknowledged — will be suppressed on next sweep"
- Remove item from current in-memory list, return to depth=1

**Action: Add regex suppression pattern (key 'r'):**
- Prompt user for regex pattern (enter raw mode temporarily switches to line mode for input)
- Prompt for reason string
- Read acknowledged-false-positives.json
- Append to patterns[]: { type: <claim type for D->C, or sweep category>, regex: <user input>, reason: <user input>, enabled: true }
- Validate regex with `new RegExp(input)` before saving — if invalid, show error and re-prompt
- Write back, show confirmation, return to depth=1

**Action: View file context (key 'v'):**
- For items with a file reference, read the file and show a scrollable view (up/down to scroll, ESC to return)
- Show line numbers, highlight the relevant line if line number is known
- Page through with up/down, show 20 lines at a time
- This is still depth=2 (viewing detail), ESC returns to depth=1

**Key hints footer at depth=2:**
- "a: acknowledge FP | r: add regex pattern | v: view file | ESC: back"

**Persistence safety:**
- Before writing acknowledged-false-positives.json, read current contents (another process may have modified)
- Use atomic write pattern: write to .tmp file then rename
  </action>
  <verify>
Run: `node -e "
const fs = require('fs');
const fp = JSON.parse(fs.readFileSync('.planning/formal/acknowledged-false-positives.json','utf8'));
console.log('entries:', Array.isArray(fp.entries));
console.log('patterns:', Array.isArray(fp.patterns));
"` — confirms the FP file structure is intact.
Run: `grep -c 'acknowledged-false-positives' bin/solve-tui.cjs` — returns 2+ (read and write paths).
Run: `grep 'setRawMode' bin/solve-tui.cjs` — confirms raw mode handling exists.
Run: `grep 'new RegExp' bin/solve-tui.cjs` — confirms regex validation exists.
  </verify>
  <done>
Item detail view shows full data with file context around relevant lines. Acknowledge action persists to acknowledged-false-positives.json entries[]. Regex pattern action validates and persists to patterns[]. File viewer shows scrollable content. All actions accessible via single keypress at depth=2. Atomic write prevents data loss.
  </done>
</task>

<task type="auto">
  <name>Task 3: Add summary stats, make executable, and verify invariants</name>
  <files>bin/solve-tui.cjs</files>
  <action>
Final polish and invariant verification.

**Summary stats on main menu (depth=0):**
- Show a stats box at the top:
  - Total items across all categories
  - Items acknowledged this session (counter)
  - Patterns added this session (counter)
- Per category line: "D->C Broken Claims: 42 items (3 file_path, 12 cli_command, 27 dependency)"

**Make executable:**
- Ensure shebang line: #!/usr/bin/env node
- Run: chmod +x bin/solve-tui.cjs

**Graceful exit:**
- On quit (q or ESC at depth=0), restore terminal state: stdin.setRawMode(false), clear any readline interface
- Show session summary: "Session: acknowledged N items, added M patterns"
- process.exit(0)

**Handle empty categories gracefully:**
- If a sweep returns 0 items, show "(empty)" next to category name
- If ALL sweeps return 0, show "All clean! No human-gated items found." and exit

**Invariant self-check (defense in depth):**
- Add a DEBUG_INVARIANTS constant (default false, set via --debug-invariants flag)
- When enabled, after every state transition assert:
  - depth >= 0 and depth <= 3 (DepthBounded)
  - If last action was ESC, assert new depth < old depth (EscapeProgress)
  - Assert at least one valid keypress is handled in current state (NoDeadlock)
- If assertion fails, log to stderr and force-return to depth=0

**Export for testability:**
- module.exports = { loadSweepData, ... } but only when require.main !== module
- When require.main === module, enter interactive mode
  </action>
  <verify>
Run: `chmod +x bin/solve-tui.cjs && ls -la bin/solve-tui.cjs | grep -c 'x'` — confirms executable.
Run: `node bin/solve-tui.cjs --help` — prints usage without error.
Run: `node -e "const t = require('./bin/solve-tui.cjs'); console.log('exports:', Object.keys(t).join(', '))"` — shows loadSweepData in exports.
Run: `grep 'DepthBounded\|EscapeProgress\|NoDeadlock' bin/solve-tui.cjs` — confirms invariant checks referenced.
Run: `wc -l bin/solve-tui.cjs` — confirms 400+ lines.
  </verify>
  <done>
Main menu shows summary stats with per-category breakdowns. Script is executable with shebang. Graceful exit restores terminal. Empty states handled. Debug invariant assertions implemented matching TLA+ spec properties. Exports available for testing when loaded as module.
  </done>
</task>

</tasks>

<verification>
1. `node bin/solve-tui.cjs --help` exits cleanly with usage text
2. `node -e "const t = require('./bin/solve-tui.cjs'); const d = t.loadSweepData(); console.log(Object.keys(d))"` shows four category keys
3. `grep -c 'EscapeProgress\|DepthBounded\|NoDeadlock' bin/solve-tui.cjs` returns 3+
4. acknowledged-false-positives.json remains valid JSON after any TUI actions
5. Zero external dependencies: `grep "require(" bin/solve-tui.cjs` shows only node built-ins and local files
</verification>

<success_criteria>
- bin/solve-tui.cjs is a working interactive TUI that loads all 4 sweep categories from nf-solve.cjs
- 3-depth navigation: main menu -> category list (paginated) -> item detail with actions
- ESC always reduces depth (EscapeProgress), max depth 3 (DepthBounded), always has valid input (NoDeadlock)
- Acknowledge FP and regex pattern actions persist to acknowledged-false-positives.json
- File context viewer shows surrounding lines for items with line references
- Filtering by text, type, and category works in list view
- Zero external dependencies — only Node.js built-ins
</success_criteria>

<output>
After completion, create `.planning/quick/228-build-interactive-tui-for-browsing-and-a/228-SUMMARY.md`
</output>

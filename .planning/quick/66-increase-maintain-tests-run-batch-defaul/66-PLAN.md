---
phase: quick-66
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - get-shit-done/bin/gsd-tools.cjs
autonomous: true
requirements: [QUICK-66]
must_haves:
  truths:
    - "run-batch does not time out on large test suites (100+ files) after 5 minutes"
    - "default batch wall-clock timeout is 3600 seconds (1 hour)"
  artifacts:
    - path: "get-shit-done/bin/gsd-tools.cjs"
      provides: "run-batch subcommand with updated default timeout"
      contains: "3600"
  key_links:
    - from: "get-shit-done/bin/gsd-tools.cjs line 5437"
      to: "cmdMaintainTestsRunBatch options"
      via: "timeoutSec default at call site"
    - from: "get-shit-done/bin/gsd-tools.cjs line 6180"
      to: "batch execution"
      via: "timeoutSec destructuring default"
    - from: "get-shit-done/bin/gsd-tools.cjs line 6212"
      to: "timeoutMs calculation"
      via: "fallback default in multiplication"
---

<objective>
Increase the `run-batch` subcommand default wall-clock timeout from 300 seconds (5 minutes) to 3600 seconds (1 hour) so large test suites do not hit "batch timeout exceeded" prematurely.

Purpose: 300s is far too short for test suites with 100+ files. Files get "batch timeout exceeded" status before they can run.
Output: Updated gsd-tools.cjs with 3600 as the default at all three timeout sites, synced to installed copy.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Change run-batch default timeout from 300 to 3600 at all three sites</name>
  <files>get-shit-done/bin/gsd-tools.cjs</files>
  <action>
    Change the value `300` to `3600` at exactly these three lines in
    `/Users/jonathanborduas/code/QGSD/get-shit-done/bin/gsd-tools.cjs`:

    - Line 5437: `timeoutSec: timeoutIdx !== -1 ? parseInt(args[timeoutIdx + 1], 10) : 300`
      becomes: `timeoutSec: timeoutIdx !== -1 ? parseInt(args[timeoutIdx + 1], 10) : 3600`

    - Line 6180: `const { batchFile, timeoutSec = 300, outputFile, batchIndex = 0, env } = options;`
      becomes: `const { batchFile, timeoutSec = 3600, outputFile, batchIndex = 0, env } = options;`

    - Line 6212: `const timeoutMs = (timeoutSec || 300) * 1000;`
      becomes: `const timeoutMs = (timeoutSec || 3600) * 1000;`

    No other changes. Do not alter surrounding logic, variable names, or formatting.
  </action>
  <verify>
    Run: `grep -n "timeoutSec\|timeoutMs\||| 300\||| 3600\|: 300\|: 3600" /Users/jonathanborduas/code/QGSD/get-shit-done/bin/gsd-tools.cjs | grep -E "5437|6180|6212"`

    All three lines should show 3600, not 300.
  </verify>
  <done>
    Lines 5437, 6180, and 6212 all reference 3600. No instance of the old `300` default remains at these three locations.
  </done>
</task>

<task type="auto">
  <name>Task 2: Sync installed copy via install.js</name>
  <files>~/.claude/qgsd/bin/gsd-tools.cjs (installed copy — written by install.js)</files>
  <action>
    Run the install sync to propagate the updated source into the installed copy:

    ```
    node /Users/jonathanborduas/code/QGSD/bin/install.js --claude --global
    ```

    This copies `get-shit-done/bin/gsd-tools.cjs` to `~/.claude/qgsd/bin/gsd-tools.cjs`,
    which is what actually runs during `/qgsd:maintain-tests`.
  </action>
  <verify>
    Run: `grep -c "3600" ~/.claude/qgsd/bin/gsd-tools.cjs`

    Should return a positive count confirming 3600 is present in the installed copy.

    Also confirm the three timeout sites specifically:
    `grep -n "timeoutSec\|timeoutMs" ~/.claude/qgsd/bin/gsd-tools.cjs | grep -E "300|3600" | head -10`
  </verify>
  <done>
    Installed copy at `~/.claude/qgsd/bin/gsd-tools.cjs` contains 3600 at the three timeout default sites. The running binary now uses 1-hour default batch timeout.
  </done>
</task>

</tasks>

<verification>
After both tasks:
1. `grep "300\b" /Users/jonathanborduas/code/QGSD/get-shit-done/bin/gsd-tools.cjs | grep -E "timeoutSec|timeoutMs"` — should return no matches (all timeout defaults updated)
2. `grep "3600" ~/.claude/qgsd/bin/gsd-tools.cjs | wc -l` — should be > 0
3. The `run-batch` command will no longer prematurely terminate large batches at 5 minutes
</verification>

<success_criteria>
- Source file `get-shit-done/bin/gsd-tools.cjs` has 3600 at lines 5437, 6180, 6212
- Installed copy `~/.claude/qgsd/bin/gsd-tools.cjs` reflects the same changes
- No other code changed
</success_criteria>

<output>
After completion, create `.planning/quick/66-increase-maintain-tests-run-batch-defaul/66-SUMMARY.md`
</output>

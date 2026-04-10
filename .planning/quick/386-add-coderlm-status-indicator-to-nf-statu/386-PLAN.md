---
phase: quick-386
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - hooks/nf-statusline.js
  - hooks/dist/nf-statusline.js
  - bin/coderlm-lifecycle.cjs
autonomous: true
requirements: [QUICK-386]
formal_artifacts: none

must_haves:
  truths:
    - "When coderlm server is running (PID alive), statusline shows ● coderlm in green"
    - "When coderlm is not running or not installed, statusline shows nothing (no extra segment)"
    - "Any read error on coderlm.pid renders nothing — no crash, no empty segment"
    - "coderlm-lifecycle.cjs writes coderlm.state.json on start and on stop"
  artifacts:
    - path: "hooks/nf-statusline.js"
      provides: "coderlm indicator reading PID file from ~/.claude/nf-bin/coderlm.pid"
      contains: "coderlm"
    - path: "hooks/dist/nf-statusline.js"
      provides: "dist copy matching hooks/nf-statusline.js"
      contains: "coderlm"
    - path: "bin/coderlm-lifecycle.cjs"
      provides: "coderlm.state.json writes on ensureRunning start/stop"
      contains: "state.json"
  key_links:
    - from: "hooks/nf-statusline.js"
      to: "~/.claude/nf-bin/coderlm.pid"
      via: "fs.readFileSync then process.kill(pid, 0)"
      pattern: "coderlm\\.pid"
    - from: "bin/coderlm-lifecycle.cjs"
      to: "~/.claude/nf-bin/coderlm.state.json"
      via: "fs.writeFileSync on start (source: started) and stop"
      pattern: "state\\.json"
---

<objective>
Add a coderlm server status indicator to the nf-statusline hook and write
coderlm.state.json as a secondary state signal from coderlm-lifecycle.cjs.

Purpose: Developers can see at a glance whether the coderlm server is active
inside the Claude statusline.

Output: Updated nf-statusline.js (+ dist copy), updated coderlm-lifecycle.cjs,
installer sync applied.
</objective>

<execution_context>
@./.claude/nf/workflows/execute-plan.md
@./.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@hooks/nf-statusline.js
@bin/coderlm-lifecycle.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add coderlm indicator to nf-statusline.js</name>
  <files>hooks/nf-statusline.js</files>
  <action>
After the `gsdUpdate` block (line ~175) and before the `// Output` comment, add a
coderlm status indicator section. Use `os.homedir()` (already imported) to derive
the PID path `~/.claude/nf-bin/coderlm.pid`.

Algorithm (fail-open — any exception → empty string):
1. Try to read `~/.claude/nf-bin/coderlm.pid` with `fs.readFileSync`.
2. Parse the PID as integer.
3. Call `process.kill(pid, 0)` — if it does NOT throw, process is alive.
4. Set `coderlmIndicator = '\x1b[32m● coderlm\x1b[0m'`.
5. On any error (file not found, ESRCH, NaN) → `coderlmIndicator = ''`.

Append `coderlmIndicator` to the output lines as a `│`-separated segment
immediately after `gsdUpdate` and before the model name. Format:

    ${gsdUpdate}${coderlmPart}${model}...

where `coderlmPart` is `coderlmIndicator + ' │ '` when non-empty, else `''`.

This means the output becomes:
- Running: `[update │ ]● coderlm │ model │ [task │ ]dir[ctx]`
- Stopped/absent: `[update │ ]model │ [task │ ]dir[ctx]`

Do NOT change any existing logic — insert the new block after `gsdUpdate` is
computed and before the `process.stdout.write` calls at the end.
  </action>
  <verify>
    node -e "
const { execSync } = require('child_process');
const src = require('fs').readFileSync('hooks/nf-statusline.js', 'utf8');
if (!src.includes('coderlm.pid')) { console.error('FAIL: no coderlm.pid reference'); process.exit(1); }
if (!src.includes('coderlmIndicator')) { console.error('FAIL: no coderlmIndicator variable'); process.exit(1); }
if (!src.includes('coderlmPart')) { console.error('FAIL: no coderlmPart variable'); process.exit(1); }
console.log('PASS: coderlm indicator present in hooks/nf-statusline.js');
"
  </verify>
  <done>
hooks/nf-statusline.js contains the coderlm PID-check block, coderlmIndicator
variable, and coderlmPart insertion in both output branches. Running node with a
fake stdin payload shows the indicator segment when a live PID is present, and
nothing when PID file is absent.
  </done>
</task>

<task type="auto">
  <name>Task 2: Write coderlm.state.json in coderlm-lifecycle.cjs on start/stop</name>
  <files>bin/coderlm-lifecycle.cjs</files>
  <action>
Add a `STATE_PATH` constant at the top of the constants block (after `LASTQUERY_PATH`):

    const STATE_PATH = path.join(BINARY_DIR, 'coderlm.state.json');

Also add a `_statePath` variable in the `_setPaths` test-helper block alongside
`_pidPath` and `_lastqueryPath`, and update `_setPaths` to override it:

    let _statePath = STATE_PATH;
    // inside _setPaths(dir):
    _statePath = path.join(dir, 'coderlm.state.json');
    // reset case:
    _statePath = STATE_PATH;

Write state in two places (fail-open — wrap each in try/catch, never throw):

1. In `ensureRunning()`, after the healthy-startup return branch and after the
   started-unhealthy return, write state just before each `return`:
   - When `source === 'already-running'`: write `{ running: true, pid: existingPid, ts: Date.now() }`
   - When `source === 'started'`: write `{ running: true, pid: child.pid, ts: Date.now() }`
   - When `source === 'started-unhealthy'`: write `{ running: true, pid: child.pid, ts: Date.now(), warning: 'unhealthy' }`

2. In `stop()`, after the PID file cleanup lines in each exit path (not-running,
   already-dead, stopped, error catch), write:
   - `{ running: false, pid: null, ts: Date.now() }`

Helper function to avoid repetition (insert before `ensureRunning`):

```js
function _writeState(state) {
  try {
    fs.writeFileSync(_statePath, JSON.stringify(state));
  } catch (e) { /* fail-open */ }
}
```

Export `_statePath` via the existing exports block for test use (alongside `_setPaths`).

Do NOT change any existing logic, return values, PID file handling, or error paths.
The LivenessProperty1 invariant (PID file cleanup in ALL exit paths) is preserved
because state writes are in addition to, not replacing, PID cleanup.
  </action>
  <verify>
    node -e "
const src = require('fs').readFileSync('bin/coderlm-lifecycle.cjs', 'utf8');
if (!src.includes('state.json')) { console.error('FAIL: no state.json reference'); process.exit(1); }
if (!src.includes('_writeState')) { console.error('FAIL: no _writeState helper'); process.exit(1); }
if (!src.includes('_statePath')) { console.error('FAIL: no _statePath variable'); process.exit(1); }
console.log('PASS: coderlm.state.json writes present in coderlm-lifecycle.cjs');
"

    node -e "
// Verify stop() still has PID cleanup (LivenessProperty1 not broken)
const src = require('fs').readFileSync('bin/coderlm-lifecycle.cjs', 'utf8');
if ((src.match(/unlinkSync\(_pidPath\)/g) || []).length < 3) {
  console.error('FAIL: fewer than 3 PID cleanup calls — LivenessProperty1 may be broken');
  process.exit(1);
}
console.log('PASS: LivenessProperty1 PID cleanup intact');
"
  </verify>
  <done>
bin/coderlm-lifecycle.cjs has _writeState helper, _statePath variable (test-
overridable), and state JSON writes on all start/stop paths. Existing return values,
error handling, and PID file cleanup are unchanged.
  </done>
</task>

<task type="auto">
  <name>Task 3: Sync hooks/dist and run installer</name>
  <files>hooks/dist/nf-statusline.js</files>
  <action>
Copy updated hooks/nf-statusline.js to hooks/dist/nf-statusline.js:

    cp hooks/nf-statusline.js hooks/dist/nf-statusline.js

Then run the installer to deploy to ~/.claude/hooks/:

    node bin/install.js --claude --global

Verify the installed copy also contains the coderlm indicator. If the installer
fails due to a non-auth reason, diagnose before continuing — do not silently
ignore failures.
  </action>
  <verify>
    node -e "
const fs = require('fs');
const os = require('os');
const dist = fs.readFileSync('hooks/dist/nf-statusline.js', 'utf8');
if (!dist.includes('coderlm.pid')) { console.error('FAIL: dist copy missing coderlm.pid'); process.exit(1); }
console.log('PASS: hooks/dist/nf-statusline.js synced');

const installed = fs.readFileSync(os.homedir() + '/.claude/hooks/nf-statusline.js', 'utf8');
if (!installed.includes('coderlm.pid')) { console.error('FAIL: installed copy missing coderlm.pid'); process.exit(1); }
console.log('PASS: installed ~/.claude/hooks/nf-statusline.js updated');
"
  </verify>
  <done>
hooks/dist/nf-statusline.js matches hooks/nf-statusline.js with coderlm indicator.
~/.claude/hooks/nf-statusline.js also contains the coderlm.pid reference.
  </done>
</task>

</tasks>

<verification>
1. All three files contain expected coderlm references:
   - hooks/nf-statusline.js — coderlm.pid, coderlmIndicator, coderlmPart
   - hooks/dist/nf-statusline.js — same as source
   - bin/coderlm-lifecycle.cjs — state.json, _writeState, _statePath

2. Fail-open: pipe an empty JSON object into hooks/nf-statusline.js — should exit 0 with no crash:
   echo '{"hook_event_name":"Notification","session_id":"","model":{},"context_window":{},"workspace":{"current_dir":"'"$PWD"'"}}' | node hooks/nf-statusline.js

3. LivenessProperty1 preserved: PID cleanup still present in all stop() exit paths.

4. OverridesPreserved: installer run does not delete project-level overrides.
</verification>

<success_criteria>
- coderlm indicator renders green ● coderlm when PID file exists and process is alive
- No output for indicator when PID file absent or process dead
- coderlm-lifecycle.cjs writes state.json on start and stop without changing return values
- dist copy and installed copy both updated
- npm run test:ci passes (or relevant test files pass if full suite unavailable)
</success_criteria>

<output>
After completion, create `.planning/quick/386-add-coderlm-status-indicator-to-nf-statu/386-SUMMARY.md`
</output>

---
phase: quick-392
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/install.js
  - hooks/nf-statusline.js
  - hooks/dist/nf-statusline.js
autonomous: true
requirements:
  - QT-392
must_haves:
  truths:
    - "River ML is installed via uv into ~/.claude/nf-bin/river-venv/ rather than pip3 into the system site-packages"
    - "install.js skips River install when ~/.claude/nf-bin/river-venv/river directory already exists (idempotent path check)"
    - "nf-statusline.js River indicator uses fs.existsSync path check instead of spawning python3"
    - "hooks/dist/nf-statusline.js matches hooks/nf-statusline.js after copy"
  artifacts:
    - path: "bin/install.js"
      provides: "River install block using uv pip install --target"
      contains: "uv.*pip.*install.*river.*river-venv"
    - path: "hooks/nf-statusline.js"
      provides: "River availability check via fs.existsSync"
      contains: "river-venv/river"
    - path: "hooks/dist/nf-statusline.js"
      provides: "Dist copy of updated statusline hook"
  key_links:
    - from: "bin/install.js"
      to: "~/.claude/nf-bin/river-venv/"
      via: "uv pip install --target"
      pattern: "river-venv"
    - from: "hooks/nf-statusline.js"
      to: "~/.claude/nf-bin/river-venv/river"
      via: "fs.existsSync"
      pattern: "existsSync.*river-venv"
---

<objective>
Switch River ML tooling from pip3/python3 subprocess calls to uv-based install and path-existence detection.

Purpose: The current pip3 install and python3 import check are slow (spawn overhead on every statusline render) and fragile (depends on system Python). Moving to a fixed uv install target gives a deterministic path that can be checked with a zero-cost fs.existsSync call.
Output: Updated bin/install.js River block, updated hooks/nf-statusline.js River check, dist copy synced, and hook re-installed.
</objective>

<execution_context>
@./.claude/nf/workflows/execute-plan.md
@./.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@bin/install.js
@hooks/nf-statusline.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace River install block in bin/install.js with uv-based install</name>
  <files>bin/install.js</files>
  <action>
    Locate the River ML install block starting at approximately line 2604 (comment: "// Install River ML library via pip3 if not already importable (fail-open)").

    Replace the entire block — from the comment line through the closing brace — with the following verbatim replacement:

    ```js
      // Install River ML library via uv if not already present (fail-open)
      {
        const { spawnSync: _spawnRiver } = require('child_process');
        try {
          const riverVenvPath = path.join(os.homedir(), '.claude', 'nf-bin', 'river-venv', 'river');
          if (!fs.existsSync(riverVenvPath)) {
            console.log(`  ${cyan}↓${reset} Installing River ML (uv)...`);
            const riverInstall = _spawnRiver('uv', ['pip', 'install', 'river', '--python', '3.13', '--target', path.join(os.homedir(), '.claude', 'nf-bin', 'river-venv')], { timeout: 120000 });
            if (riverInstall.status === 0) {
              console.log(`  ${green}✓${reset} River ML installed`);
            } else {
              const errOut = riverInstall.stderr ? riverInstall.stderr.toString().slice(0, 120) : '';
              console.log(`  ${yellow}⚠${reset} River ML install skipped: uv returned non-zero${errOut ? ' (' + errOut + ')' : ''}`);
            }
          }
          // Already present — skip silently
        } catch (e) {
          // uv not found or unexpected error — skip silently (fail-open)
        }
      }
    ```

    Key differences from the old block:
    - Presence check is `fs.existsSync(riverVenvPath)` on the river package directory, NOT a python3 import spawn
    - Install command is `uv pip install river --python 3.13 --target ~/.claude/nf-bin/river-venv` (uv, NOT pip3)
    - Timeout is 120000ms (was 60000ms) to account for uv download time
    - Comment and error message reference "uv" not "pip3"

    Do NOT change any surrounding code (the @huggingface/transformers block above or below this block).
  </action>
  <verify>
    grep -n "river-venv" bin/install.js
    # Must show: riverVenvPath assignment AND the uv install --target line
    grep -n "pip3" bin/install.js
    # Must NOT match the River block (pip3 should be gone from the River section)
    grep -n "python3.*import river" bin/install.js
    # Must return no matches
  </verify>
  <done>bin/install.js River block references uv and river-venv path; no python3/pip3 subprocess calls remain in the River section.</done>
</task>

<task type="auto">
  <name>Task 2: Replace River availability check in hooks/nf-statusline.js with fs.existsSync, sync dist, re-install</name>
  <files>hooks/nf-statusline.js, hooks/dist/nf-statusline.js</files>
  <action>
    In hooks/nf-statusline.js, locate the River indicator block inside buildToolsLine() (around line 58-101). The current availability check is:

    ```js
        let riverImportable = false;
        try {
          const riverCheck = spawnSync('python3', ['-c', 'import river'], { timeout: 3000 });
          riverImportable = riverCheck.status === 0;
        } catch (_e) {}
    ```

    Replace those four lines (the inner try/catch and the let declaration) with:

    ```js
        let riverImportable = false;
        riverImportable = fs.existsSync(path.join(homeDir, '.claude', 'nf-bin', 'river-venv', 'river'));
    ```

    The inner try/catch is removed entirely because fs.existsSync does not throw. The outer try/catch wrapping the full River section (lines ~59 and ~101) MUST remain untouched.

    Do NOT remove the `const { spawnSync } = require('child_process');` import at line 8 — it may be used elsewhere in the file.

    After editing hooks/nf-statusline.js:
    1. Copy source to dist: `cp hooks/nf-statusline.js hooks/dist/nf-statusline.js`
    2. Re-install hooks: `node bin/install.js --claude --global`
  </action>
  <verify>
    grep -n "river-venv" hooks/nf-statusline.js
    # Must show the fs.existsSync line referencing river-venv/river
    grep -n "python3.*import river" hooks/nf-statusline.js
    # Must return no matches
    grep -n "spawnSync" hooks/nf-statusline.js
    # Must still show line 8 require (do not remove it)
    diff hooks/nf-statusline.js hooks/dist/nf-statusline.js
    # Must show no differences (dist copy is in sync)
  </verify>
  <done>hooks/nf-statusline.js River check uses fs.existsSync; dist copy matches source; hook is re-installed.</done>
</task>

</tasks>

<verification>
Run these checks after both tasks complete:

```bash
# 1. River block in install.js uses uv
grep -n "uv.*pip.*install.*river" bin/install.js
# Expected: line with uv pip install river --python 3.13 --target

# 2. No python3 import spawn for River in install.js
grep -n "python3.*import river\|pip3.*install.*river" bin/install.js
# Expected: no matches

# 3. Statusline uses path check
grep -n "existsSync.*river-venv" hooks/nf-statusline.js
# Expected: one match

# 4. No python3 spawn in statusline River section
grep -n "spawnSync.*python3" hooks/nf-statusline.js
# Expected: no matches

# 5. Dist copy is in sync
diff hooks/nf-statusline.js hooks/dist/nf-statusline.js
# Expected: no output (identical)
```
</verification>

<success_criteria>
1. `grep "uv.*pip.*install.*river" bin/install.js` returns a match
2. `grep "python3.*import river" bin/install.js` returns no matches
3. `grep "pip3.*install.*river" bin/install.js` returns no matches
4. `grep "existsSync.*river-venv" hooks/nf-statusline.js` returns one match
5. `grep "spawnSync.*python3" hooks/nf-statusline.js` returns no matches
6. `diff hooks/nf-statusline.js hooks/dist/nf-statusline.js` produces no output
</success_criteria>

<output>
After completion, create `.planning/quick/392-update-river-install-block-in-install-js/392-SUMMARY.md` following the summary template.
</output>

---
phase: quick-122
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/install-formal-tools.cjs
  - bin/install.js
autonomous: true
requirements: [QUICK-122]
must_haves:
  truths:
    - "Normal install always exits 0, even when TLA+ or Alloy download fails"
    - "install-formal-tools.cjs always exits 0 regardless of TLA+ or Alloy result"
    - "After the success banner in a normal install, a formal verification tools summary block is printed"
    - "node bin/install.js --formal still works as a standalone retry shortcut"
    - "node bin/install.js --uninstall does NOT trigger the formal tools block"
  artifacts:
    - path: "bin/install-formal-tools.cjs"
      provides: "Best-effort formal tools installer, always exit 0"
      contains: "process.exit(0)"
    - path: "bin/install.js"
      provides: "Main installer with formal tools appended after success banner"
      contains: "Best-effort formal tools"
  key_links:
    - from: "bin/install.js finishInstall()"
      to: "bin/install-formal-tools.cjs"
      via: "spawnSync(process.execPath, [formalScript], { stdio: 'inherit' })"
      pattern: "spawnSync.*install-formal-tools"
---

<objective>
Wire best-effort formal tools install into the main install flow, and make install-formal-tools.cjs always exit 0.

Purpose: Every `node bin/install.js` run (any runtime, any mode) automatically attempts to download formal verification jars and shows the result. Failures are non-blocking warnings — main install always exits 0.
Output: Two edited files. No new files. No behavior change for --formal or --uninstall.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Make install-formal-tools.cjs always exit 0</name>
  <files>bin/install-formal-tools.cjs</files>
  <action>
    In bin/install-formal-tools.cjs, locate the exit-code block at the bottom of the async IIFE (around line 261-272):

    ```js
    const tlaResult = results.find(r => r.name === 'TLA+');
    const alloyResult = results.find(r => r.name === 'Alloy');
    const tlaFailed = tlaResult && tlaResult.status === 'fail';
    const alloyFailed = alloyResult && alloyResult.status === 'fail';

    if (tlaFailed || alloyFailed) {
      process.exit(1);
    } else {
      process.exit(0);
    }
    ```

    Replace with a single unconditional exit 0:

    ```js
    // Best-effort — all failures are non-blocking warnings
    process.exit(0);
    ```

    Also update the `.catch` handler at the bottom (currently `process.exit(1)`) to `process.exit(0)`:

    ```js
    })().catch(err => {
      fail(err.message);
      process.exit(0);
    });
    ```

    Also update the file header comment (line 19) from:
      "Exits 0 if TLA+ and Alloy succeed; exits 1 if either fails."
    to:
      "Always exits 0 — failures are non-blocking warnings."
  </action>
  <verify>
    node -e "
      const { spawnSync } = require('child_process');
      // Simulate failure by temporarily passing a bad arg — but best test is direct:
      // The script exits 0 even on download failure. Run it and check exit code.
      // Since real downloads may succeed or fail, confirm the exit-1 path is gone:
      const src = require('fs').readFileSync('bin/install-formal-tools.cjs', 'utf8');
      const hasExit1 = /process\.exit\(1\)/.test(src);
      console.log('Has exit(1):', hasExit1);
      if (hasExit1) process.exit(1);
    "
  </verify>
  <done>bin/install-formal-tools.cjs contains no process.exit(1) calls. All failure paths call process.exit(0).</done>
</task>

<task type="auto">
  <name>Task 2: Inject best-effort formal tools run into finishInstall in bin/install.js</name>
  <files>bin/install.js</files>
  <action>
    In bin/install.js, locate the `finishInstall` function (line ~2022). Find the success banner console.log at the end of the function body (lines ~2052-2056):

    ```js
    console.log(`
      ${green}Done!${reset} Launch ${program} and run ${cyan}${command}${reset}.
    ${nudge}
      ${cyan}Join the community:${reset} https://discord.gg/5JJgD5svVS
    `);
    }   // <-- closing brace of finishInstall, line ~2057
    ```

    Insert the following block AFTER the console.log and BEFORE the closing brace of `finishInstall`:

    ```js
    // Best-effort formal tools — always runs after success banner, never blocks main install
    if (!hasUninstall && !hasFormal) {
      const { spawnSync: _formalSpawn } = require('child_process');
      const formalScript = path.join(__dirname, 'install-formal-tools.cjs');
      if (fs.existsSync(formalScript)) {
        console.log('  Formal verification tools:');
        _formalSpawn(process.execPath, [formalScript], { stdio: 'inherit' });
        // exit code ignored — best-effort
      }
    }
    ```

    The `hasUninstall` and `hasFormal` guards are technically redundant (those paths never reach `finishInstall`) but are explicit safety checks per the task description.

    Do NOT change the `--formal` early-exit block (lines ~2346-2351). It stays exactly as-is — standalone retry shortcut.

    Do NOT add any other changes. The injection is purely additive, inside `finishInstall`, after the Done banner.
  </action>
  <verify>
    node -e "
      const src = require('fs').readFileSync('bin/install.js', 'utf8');
      const hasFormalBlock = src.includes('Best-effort formal tools') && src.includes('install-formal-tools.cjs') && src.includes('exit code ignored');
      const formalFlagUntouched = src.includes('process.exit(result.status ?? 0)');
      console.log('Has best-effort block:', hasFormalBlock);
      console.log('--formal flag unchanged:', formalFlagUntouched);
      if (!hasFormalBlock || !formalFlagUntouched) process.exit(1);
    "
  </verify>
  <done>bin/install.js finishInstall() contains the best-effort formal tools block after the Done banner. The --formal early-exit block is unchanged. grep confirms both: "Best-effort formal tools" appears inside finishInstall scope, "process.exit(result.status ?? 0)" still exists for the --formal path.</done>
</task>

</tasks>

<verification>
Run both verify commands from the task blocks. Then do a quick smoke test:

```bash
node -e "
  const src = require('fs').readFileSync('bin/install-formal-tools.cjs', 'utf8');
  console.log('exit(1) in formal tools:', /process\.exit\(1\)/.test(src));
"

node -e "
  const src = require('fs').readFileSync('bin/install.js', 'utf8');
  console.log('Best-effort block present:', src.includes('Best-effort formal tools'));
  console.log('--formal flag intact:', src.includes('process.exit(result.status ?? 0)'));
"
```

All three checks must print false/true/true respectively.
</verification>

<success_criteria>
- bin/install-formal-tools.cjs: zero process.exit(1) calls; all paths exit 0
- bin/install.js: finishInstall() runs formal tools block after success banner; --formal flag path is unchanged; --uninstall path never reaches finishInstall
- A normal `node bin/install.js --claude --global` run prints the "Formal verification tools:" header and summary table after "Done!"
- The main install exits 0 whether jars download or not
</success_criteria>

<output>
After completion, create `.planning/quick/122-wire-best-effort-formal-tools-install-in/122-SUMMARY.md`
</output>

---
phase: quick-389
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/install.js
autonomous: true
formal_artifacts: none
requirements:
  - INSTALL-CODERLM-01

must_haves:
  truths:
    - "Running node bin/install.js --claude --global downloads coderlm to ~/.claude/nf-bin/coderlm when missing"
    - "Install succeeds (exit 0) even when coderlm download fails (no network, no gh CLI)"
    - "A status line 'Installing coderlm...' prints during download, 'coderlm installed' on success, or a yellow warning on failure"
    - "If coderlm binary already exists, install skips download and prints nothing extra (idempotent)"
    - "Project overrides are never cleared by the install operation (OverridesPreserved)"
  artifacts:
    - path: "bin/install.js"
      provides: "Modified install() function with coderlm ensureBinary() call"
      contains: "ensureBinary"
  key_links:
    - from: "bin/install.js install()"
      to: "bin/coderlm-lifecycle.cjs ensureBinary()"
      via: "require('./coderlm-lifecycle.cjs')"
      pattern: "ensureBinary"
---

<objective>
Integrate coderlm binary auto-download into install.js so that users get the coderlm binary placed at ~/.claude/nf-bin/coderlm as part of the standard install flow, with no manual steps required.

Purpose: Removes the gap where users install nForma but coderlm is absent, causing lifecycle errors on first use.
Output: Modified bin/install.js that calls ensureBinary() after the nf-bin copy step, prints progress, and never blocks install on download failure.
</objective>

<execution_context>
@./.claude/nf/workflows/execute-plan.md
@./.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/quick/389-make-install-js-automatically-download-a/scope-contract.json
@bin/coderlm-lifecycle.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Wire ensureBinary() into install() after nf-bin copy</name>
  <files>bin/install.js</files>
  <action>
After the nf-bin copy block (the block ending around line 2562 with the closing brace of `if (fs.existsSync(binSrc))`), add a coderlm binary installation step. The step must:

1. Require coderlm-lifecycle.cjs at the top of the file (alongside existing requires), as a lazy try/require so it does not break if the module is absent:
   ```
   // Lazy require: coderlm-lifecycle.cjs is an optional sibling module. Deferring
   // the require() prevents install.js from failing at startup if the module is
   // absent (e.g., partial install or future removal of the feature).
   let _coderlmLifecycle = null;
   function getCoderlmLifecycle() {
     if (!_coderlmLifecycle) {
       try { _coderlmLifecycle = require('./coderlm-lifecycle.cjs'); } catch (e) { /* not available */ }
     }
     return _coderlmLifecycle;
   }
   ```
   Place this near the top of the file with the other requires. Do NOT add 'use strict' (pre-existing deviation from cjs style rules — install.js deliberately omits it).

2. After the closing brace of the `if (fs.existsSync(binSrc))` block (around line 2562), add:
   ```
   // Download coderlm binary to nf-bin/ if not already present (fail-open)
   {
     const lifecycle = getCoderlmLifecycle();
     if (lifecycle) {
       // Idempotency check: if coderlm already installed, skip silently
       try {
         fs.accessSync(path.join(os.homedir(), '.claude', 'nf-bin', 'coderlm'), fs.constants.X_OK);
         // Already installed — no-op
       } catch (e) {
         // NOTE: this outer try/catch is ONLY for fs.accessSync (detect missing binary).
         // Only act on ENOENT (file truly absent) — other errors (EACCES, EISDIR, etc.)
         // mean the binary path exists but is inaccessible; skip silently to preserve
         // idempotency and avoid spurious installs.
         // Do NOT wrap ensureBinary() in this catch — it handles its own errors internally.
         if (e.code === 'ENOENT') {
           console.log(`  ${cyan}↓${reset} Installing coderlm...`);
           const result = lifecycle.ensureBinary();
           if (result.ok && result.source !== 'cached') {
             console.log(`  ${green}✓${reset} coderlm installed`);
           } else if (!result.ok) {
             const detail = typeof result.detail === 'string' ? result.detail : '';
             console.log(`  ${yellow}⚠${reset} coderlm download skipped: ${result.error}${detail ? ' (' + detail.slice(0, 80) + ')' : ''}`);
           }
         }
         // Other errors (EACCES, EISDIR, etc.) — assume binary exists, skip silently
       }
     }
   }
   ```

IMPORTANT constraints:
- The download block is wrapped in try/catch internally inside ensureBinary() — it is already fail-open. The outer try/catch around fs.accessSync is only to detect the missing binary (presence check); do NOT place ensureBinary() inside the catch block, and do NOT add a second outer try/catch wrapping ensureBinary(). The inline comment in the code snippet above explains this boundary for future maintainers.
- Never call failures.push() for coderlm download failure. The coderlm step must never cause `process.exit(1)`.
- Do not add 'use strict' anywhere in this file.
- The OverridesPreserved invariant is not at risk: the coderlm step only writes to `~/.claude/nf-bin/coderlm`, which is a different path from any project override settings. Do not add any logic that reads or writes settings.json, .claude/nf.json, or project override state.
- Only print the "Installing coderlm..." line when the binary is actually absent. Skip printing entirely when already installed (idempotent re-runs are silent).
- The lazy require pattern (getCoderlmLifecycle()) prevents install.js from crashing if coderlm-lifecycle.cjs is somehow absent in the package.
  </action>
  <verify>
    1. Run `node bin/install.js --claude --global --verbose` — observe that "Installing coderlm..." and "coderlm installed" (or yellow warning) appear in output.
    2. Run it again — confirm no "Installing coderlm..." line appears on re-run (idempotent).
    3. Confirm exit code 0 in both cases: `echo $?`
    4. `grep -n 'ensureBinary' bin/install.js` returns at least one match.
    5. `grep -n "'use strict'" bin/install.js` returns no match (constraint preserved).
    6. Fail-open behavior: simulate a missing gh CLI by temporarily renaming it (`mv $(which gh) $(which gh).bak`) or by running in an environment without gh, then run `node bin/install.js --claude --global`. Verify: install exits 0, a yellow warning line appears (not an error/exception), and all other install steps completed normally. Restore gh afterward.
  </verify>
  <done>
    install.js calls ensureBinary() after the nf-bin copy step; install exits 0 regardless of download outcome; "Installing coderlm..." only prints when binary is absent; no 'use strict' added; project override logic is untouched.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add integration test for coderlm download step</name>
  <files>bin/coderlm-lifecycle.test.cjs</files>
  <action>
The existing test file at bin/coderlm-lifecycle.test.cjs already tests ensureBinary() in isolation. Add a new test section (describe block or additional tests at the end) that verifies the behavior contract relied upon by install.js:

Add to the bottom of bin/coderlm-lifecycle.test.cjs:

```js
// Integration contract: behavior expected by install.js
describe('ensureBinary() install.js contract', () => {
  it('returns ok:true with source:cached when binary already exists', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nf-lifecycle-contract-'));
    try {
      const { _setPaths, ensureBinary } = require('./coderlm-lifecycle.cjs');
      _setPaths(tmp);
      // Place a mock executable binary
      const binPath = path.join(tmp, 'coderlm');
      fs.writeFileSync(binPath, '#!/bin/sh\n');
      fs.chmodSync(binPath, 0o755);
      const result = ensureBinary();
      assert.strictEqual(result.ok, true);
      assert.strictEqual(result.source, 'cached');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
      const { _setPaths } = require('./coderlm-lifecycle.cjs');
      _setPaths(); // reset
    }
  });

  it('returns ok:false (not ok:undefined) on download failure — install.js relies on result.ok boolean', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nf-lifecycle-contract-'));
    try {
      const { _setPaths, ensureBinary } = require('./coderlm-lifecycle.cjs');
      _setPaths(tmp);
      // No binary present, gh CLI will fail (not authenticated or not present in CI)
      const result = ensureBinary();
      // result.ok must be a boolean (true or false), never undefined
      assert.ok(typeof result.ok === 'boolean', 'result.ok must be boolean');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
      const { _setPaths } = require('./coderlm-lifecycle.cjs');
      _setPaths();
    }
  });
});
```

Verify that the existing require/assert imports at the top of the test file already cover what these tests need. If `fs`, `path`, `os` are not already required, add them. Do not duplicate existing requires — check first.

Note: the second test may pass as ok:true if gh CLI is present and authenticated in the test environment; the assertion only checks that ok is a boolean (not undefined), which always holds.
  </action>
  <verify>
    `npm run test:ci 2>&1 | grep -E 'coderlm-lifecycle|PASS|FAIL'` — coderlm-lifecycle tests pass.
    Alternatively: `node --test bin/coderlm-lifecycle.test.cjs` exits 0.
  </verify>
  <done>
    Two new contract tests exist in bin/coderlm-lifecycle.test.cjs; both pass; no existing tests broken.
  </done>
</task>

</tasks>

<verification>
1. `node bin/install.js --claude --global` exits 0 (no download blockage).
2. `grep -n 'ensureBinary' bin/install.js` returns a match confirming the hook is wired.
3. `grep -n "'use strict'" bin/install.js` returns nothing (constraint preserved).
4. On a fresh environment (coderlm absent): "Installing coderlm..." and either "coderlm installed" or a yellow warning appear.
5. On re-run (coderlm present): no "Installing coderlm..." line (idempotent).
6. `npm run test:ci` passes.
</verification>

<success_criteria>
- install.js automatically attempts to download coderlm as part of the standard install flow.
- Install never fails (exit 1) due to a coderlm download error.
- The download is silent when the binary is already present.
- No 'use strict' added to install.js.
- Project overrides are never touched by the coderlm step.
</success_criteria>

<output>
After completion, create `.planning/quick/389-make-install-js-automatically-download-a/389-SUMMARY.md` following the summary template.
</output>

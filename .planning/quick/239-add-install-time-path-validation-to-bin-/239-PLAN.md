---
phase: quick-239
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/install.js
  - test/install-path-validation.test.cjs
autonomous: true
requirements: [QUICK-239]
formal_artifacts: none

must_haves:
  truths:
    - "After install, any hook file with a path.join(__dirname, ...) pointing to a non-existent target produces a visible WARNING"
    - "Install completes successfully even when warnings are emitted (fail-open)"
    - "Validation runs against installed files at ~/.claude/hooks/, not source files"
  artifacts:
    - path: "bin/install.js"
      provides: "validateHookPaths function and call site after hook+bin copy"
      contains: "validateHookPaths"
    - path: "test/install-path-validation.test.cjs"
      provides: "Unit tests for the path validation logic"
      contains: "validateHookPaths"
  key_links:
    - from: "bin/install.js (install function)"
      to: "validateHookPaths"
      via: "function call after hooks and nf-bin are both copied"
      pattern: "validateHookPaths\\("
---

<objective>
Add install-time path validation to bin/install.js that scans installed hook files for
path.join(__dirname, ...) patterns, resolves them relative to the installed location, and
warns about any targets that do not exist on disk.

Purpose: LLM agents write paths that work in the repo but break after install because
__dirname changes. The fail-open pattern in hooks makes these bugs silent. This catches
them at install time.

Output: Updated bin/install.js with validateHookPaths function; unit test file.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@bin/install.js
@hooks/dist/nf-session-start.js (example of path.join(__dirname, '..', 'bin', ...) patterns)
@hooks/dist/nf-stop.js (example — has both 'bin' and 'nf-bin' references)
@hooks/dist/nf-prompt.js (heaviest user of __dirname paths)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add validateHookPaths function and wire into install flow</name>
  <files>bin/install.js</files>
  <action>
Add a new function `validateHookPaths(hooksDest, targetDir)` to bin/install.js. Place it
near the other utility functions (before the `install()` function, around line 1530).

The function should:

1. Read all `.js` files (NOT `.test.js`) in `hooksDest` directory
2. For each file, use a regex to extract path.join(__dirname, ...) patterns:
   - Pattern: `path\.join\(__dirname,\s*(['"][^'"]+['"]\s*,?\s*)*\)` — but simpler is fine since
     this is best-effort. A practical regex:
     `/path\.join\(\s*__dirname\s*,\s*((?:['"][^'"]*['"]\s*,?\s*)+)\)/g`
   - For each match, extract the string arguments (e.g., `'..', 'bin', 'foo.cjs'`)
   - Resolve the path: `path.resolve(hooksDest, ...args)` where args are the extracted strings
3. Check if the resolved path exists with `fs.existsSync()`
4. If missing, print a warning line:
   `  ⚠ ${hookFile}: path.join(__dirname, ${args}) resolves to ${resolved} — not found`
5. If the resolved path contains `/bin/` (not `/nf-bin/`), add a hint:
   `    Hint: did you mean 'nf-bin' instead of 'bin'? Hooks run from ~/.claude/hooks/, not the repo.`
6. Return an array of `{ file, pattern, resolved, suggestion }` objects for each warning (useful for testing)

Key design constraints:
- This is WARNING only — never set failures or call process.exit
- Skip .test.js files (they reference __dirname for test execution, not production paths)
- Handle the template replacement that already happens (line 1863: `.claude` gets replaced with
  runtime-specific config dir) — the paths we check already have this substitution applied
- Use the existing `yellow` and `reset` ANSI color constants already defined in install.js

Wire the call into the `install()` function at approximately line 1889 (after BOTH hooks copy
and nf-bin copy complete, before the `failures.length` check). The insertion point is right
after `console.log("Installed nf-bin scripts")`:

```javascript
  // Validate hook path references point to real targets
  const hooksDest = path.join(targetDir, 'hooks');
  if (fs.existsSync(hooksDest)) {
    validateHookPaths(hooksDest, targetDir);
  }
```

Note: `hooksDest` is already defined earlier in the function at line 1852, but it's scoped
inside the `if (fs.existsSync(hooksSrc))` block. Either hoist it or re-derive it as shown above.

IMPORTANT: Do NOT modify the OverridesPreserved installer invariant — this change only adds
a post-copy validation pass and does not alter the copy/config flow.
  </action>
  <verify>
Run the installer and confirm it completes without error:
```
node bin/install.js --claude --global 2>&1 | head -40
```
Check that warnings appear for any hooks with broken paths (most hooks reference `'..', 'bin', ...`
which should resolve to `~/.claude/bin/` but scripts live in `~/.claude/nf-bin/`):
```
node bin/install.js --claude --global 2>&1 | grep -i "not found"
```
Confirm install still succeeds (exit code 0) even with warnings.
  </verify>
  <done>
validateHookPaths function exists in install.js, is called after hooks+bin copy, prints
warnings for path.join(__dirname, ...) references that resolve to non-existent targets,
and does NOT block installation.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add unit tests for validateHookPaths</name>
  <files>test/install-path-validation.test.cjs</files>
  <action>
Create test/install-path-validation.test.cjs with tests for the validateHookPaths function.

Since install.js defines validateHookPaths as a local function (not exported), either:
- Option A (preferred): Add a conditional export at the bottom of install.js:
  `if (typeof module !== 'undefined') { module.exports = { validateHookPaths }; }`
  But ONLY if install.js doesn't already have module.exports or if it won't break CLI usage.
  Check first — if install.js is purely a CLI script (no existing exports), wrap the export
  in `if (require.main !== module) { module.exports = { validateHookPaths }; }` so it only
  exports when required as a library, not when run directly.
- Option B: Extract validateHookPaths to a small helper file and require it from install.js.
  Only do this if Option A is not feasible.

Test cases:
1. **No warnings for valid paths**: Create a temp dir with a hook file containing
   `path.join(__dirname, 'sibling.js')` and a sibling.js file. Verify empty warnings array.
2. **Warning for missing target**: Create a temp dir with a hook file containing
   `path.join(__dirname, '..', 'bin', 'missing.cjs')` and no such target. Verify warnings
   array has one entry with the correct resolved path.
3. **Hint for bin vs nf-bin**: Verify that when the resolved path contains `/bin/` (not nf-bin),
   the warning includes a suggestion about nf-bin.
4. **Skips .test.js files**: Create a temp dir with a `.test.js` file containing broken paths.
   Verify no warnings.
5. **Handles multiple patterns in one file**: A hook file with 3 path.join calls, 2 broken.
   Verify 2 warnings returned.

Use Node.js built-in assert and fs/path (no test framework needed — match project patterns
from test/install-virgin.test.cjs).

Use `fs.mkdtempSync(path.join(os.tmpdir(), 'nf-hook-test-'))` for temp directories.
Clean up temp dirs in a try/finally block.
  </action>
  <verify>
```
node test/install-path-validation.test.cjs
```
All tests pass with exit code 0.
  </verify>
  <done>
Unit tests exist and pass, covering: valid paths (no warnings), missing targets (warnings
emitted), bin-vs-nf-bin hint, .test.js skipping, and multiple patterns in one file.
  </done>
</task>

</tasks>

<verification>
1. `node bin/install.js --claude --global` completes successfully (exit 0)
2. Warnings are printed for hook files referencing non-existent paths
3. `node test/install-path-validation.test.cjs` passes all tests
4. Existing test suite is not broken: `node test/install-virgin.test.cjs` still passes
</verification>

<success_criteria>
- validateHookPaths function scans installed hook .js files for path.join(__dirname, ...) patterns
- Missing path targets produce visible WARNING lines with file name, resolved path, and hint
- Install completes successfully regardless of warnings (fail-open)
- Unit tests cover the core scenarios
</success_criteria>

<output>
After completion, create `.planning/quick/239-add-install-time-path-validation-to-bin-/239-SUMMARY.md`
</output>

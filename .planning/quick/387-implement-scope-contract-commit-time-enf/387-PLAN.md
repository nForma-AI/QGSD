---
phase: 387-implement-scope-contract-commit-time-enf
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - hooks/dist/nf-scope-guard.js
  - package.json
autonomous: true
requirements: [SCOPE-01, SCOPE-02, SCOPE-03]
formal_artifacts: none

must_haves:
  truths:
    - "nf-scope-guard.js PreToolUse hook fires on Edit, Write, MultiEdit and warns when target file is outside declared scope"
    - "Hook is warn-only: exits 0 always and never blocks tool calls"
    - "Hook is a no-op when no scope contract exists for the current branch"
    - "nf-scope-guard.js test suite is included in test:ci and passes"
    - "hooks/dist/nf-scope-guard.js is in sync with hooks/nf-scope-guard.js"
  artifacts:
    - path: "hooks/dist/nf-scope-guard.js"
      provides: "Installed scope guard hook (read by Claude Code via ~/.claude/hooks/)"
      contains: "nf-scope-guard"
    - path: "package.json"
      provides: "test:ci includes nf-scope-guard.test.js"
      contains: "nf-scope-guard.test.js"
  key_links:
    - from: "hooks/nf-scope-guard.js"
      to: "hooks/dist/nf-scope-guard.js"
      via: "npm run build:hooks (scripts/build-hooks.js HOOKS_TO_COPY)"
      pattern: "nf-scope-guard"
    - from: "hooks/dist/nf-scope-guard.js"
      to: "~/.claude/hooks/nf-scope-guard.js"
      via: "node bin/install.js --claude --global"
      pattern: "nf-scope-guard"
---

<objective>
Wire the already-implemented nf-scope-guard.js hook into the CI test suite and install it globally so Claude Code activates it on every Edit/Write/MultiEdit call.

Purpose: The hook source (hooks/nf-scope-guard.js) and tests (hooks/nf-scope-guard.test.js) are complete and registered in build-hooks.js and install.js, but hooks/dist/ has not been synced and the test is not in test:ci. This task closes those gaps and activates the hook.

Output: hooks/dist/nf-scope-guard.js synced, test:ci updated, hook installed globally.
</objective>

<execution_context>
@./.claude/nf/workflows/execute-plan.md
@./.claude/nf/templates/summary.md
</execution_context>

<context>
@hooks/nf-scope-guard.js
@hooks/nf-scope-guard.test.js
@scripts/build-hooks.js
@package.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Sync hook to dist and add test to test:ci</name>
  <files>hooks/dist/nf-scope-guard.js, package.json</files>
  <action>
**Part A — Sync nf-scope-guard.js to hooks/dist/:**

Run the build-hooks script to copy all hooks in HOOKS_TO_COPY (including nf-scope-guard.js) to hooks/dist/:

```bash
npm run build:hooks
```

Verify the file was created:
```bash
ls -la hooks/dist/nf-scope-guard.js
```

Per the git workflow rules: edits to hook source files in `hooks/` MUST be copied to `hooks/dist/` before install. The `npm run build:hooks` script handles this via `scripts/build-hooks.js`.

**Part B — Add nf-scope-guard.test.js to test:ci in package.json:**

In `package.json`, find the `"test:ci"` script (line ~109). It contains a long `node --test` invocation with many test files. Add `hooks/nf-scope-guard.test.js` to this list, following the same pattern as the other guard tests. The destructive-git-guard entry (`hooks/nf-destructive-git-guard.test.js`) is the closest precedent — insert `hooks/nf-scope-guard.test.js` adjacent to it.

The updated test:ci should include:
```
hooks/nf-destructive-git-guard.test.js hooks/nf-scope-guard.test.js
```

Do NOT add a vitest config entry — test:ci uses node --test directly.
  </action>
  <verify>
1. `ls hooks/dist/nf-scope-guard.js` — file exists
2. `diff hooks/nf-scope-guard.js hooks/dist/nf-scope-guard.js` — no differences
3. `grep "nf-scope-guard.test.js" package.json` — returns a match
4. `node --test hooks/nf-scope-guard.test.js` — all 12 tests pass (TC-SG-01 through TC-SG-12)
  </verify>
  <done>
hooks/dist/nf-scope-guard.js exists and matches source. package.json test:ci includes hooks/nf-scope-guard.test.js. All scope guard unit tests pass.
  </done>
</task>

<task type="auto">
  <name>Task 2: Install hook globally and run full CI gate</name>
  <files></files>
  <action>
**Part A — Install the hook globally:**

Per the git workflow rules, after syncing to hooks/dist/, run the installer to activate the hook in Claude Code:

```bash
node bin/install.js --claude --global
```

This copies hooks/dist/nf-scope-guard.js to ~/.claude/hooks/ and registers the PreToolUse entry in ~/.claude.json pointing to nf-scope-guard.js with timeout: 10.

Verify the hook is registered:
```bash
grep "nf-scope-guard" ~/.claude.json
```

Expected: a PreToolUse hooks entry with `"command"` containing `nf-scope-guard.js`.

**Part B — Run full CI gate to confirm no regressions:**

```bash
npm run test:ci
```

The gate runs: lint-isolation → verify-hooks-sync → full node --test suite (now including nf-scope-guard.test.js). All must pass.

If verify-hooks-sync fails, it means a dependency of nf-scope-guard.js is missing from HOOKS_TO_COPY in build-hooks.js. Check: nf-scope-guard.js requires only `./config-loader` which is already in HOOKS_TO_COPY — this should not fail.
  </action>
  <verify>
1. `grep "nf-scope-guard" ~/.claude.json` — PreToolUse entry present
2. `npm run test:ci` — exits 0, all tests pass
  </verify>
  <done>
nf-scope-guard.js is registered as a PreToolUse hook in ~/.claude.json. npm run test:ci passes with no failures. Scope contract enforcement is active for all future Edit/Write/MultiEdit tool calls.
  </done>
</task>

</tasks>

<verification>
1. `diff hooks/nf-scope-guard.js hooks/dist/nf-scope-guard.js` — no diff (files in sync)
2. `grep "nf-scope-guard.test.js" package.json` — test in CI list
3. `node --test hooks/nf-scope-guard.test.js` — 12/12 tests pass
4. `grep "nf-scope-guard" ~/.claude.json` — hook registered globally
5. `npm run test:ci` — full suite passes
</verification>

<success_criteria>
- hooks/dist/nf-scope-guard.js exists and is identical to hooks/nf-scope-guard.js
- test:ci runs nf-scope-guard.test.js and all 12 unit tests pass
- nf-scope-guard.js is registered as a PreToolUse hook in ~/.claude.json
- SCOPE-01: Hook fires on Edit/Write/MultiEdit and checks .claude/scope-contract.json
- SCOPE-02: Hook is warn-only (exits 0, uses additionalContext for advisory output)
- SCOPE-03: Hook is no-op when no scope contract exists for current branch
- npm run test:ci passes with no regressions
</success_criteria>

<output>
After completion, create `.planning/quick/387-implement-scope-contract-commit-time-enf/387-SUMMARY.md`
</output>

---
phase: quick-321
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - hooks/nf-stop.js
  - hooks/dist/nf-stop.js
autonomous: true
formal_artifacts: none
requirements: [QUICK-321]

must_haves:
  truths:
    - "Dirty .planning/formal/ files are auto-committed before session ends"
    - "Auto-commit only fires on non-main/non-protected branches"
    - "Auto-commit is skipped when no .planning/formal/ files are dirty"
    - "Auto-commit failure never blocks the stop hook (fail-open)"
    - "Commit message includes [auto] tag for traceability"
  artifacts:
    - path: "hooks/nf-stop.js"
      provides: "Auto-commit logic for regenerated formal artifacts at session end"
      contains: "autoCommitFormalArtifacts"
    - path: "hooks/dist/nf-stop.js"
      provides: "Installed copy of nf-stop.js with auto-commit logic"
      contains: "autoCommitFormalArtifacts"
  key_links:
    - from: "hooks/nf-stop.js"
      to: "gsd-tools.cjs"
      via: "spawnSync with resolveBin('gsd-tools.cjs')"
      pattern: "gsd-tools\\.cjs.*commit"
    - from: "hooks/nf-stop.js"
      to: ".planning/formal/"
      via: "git diff --name-only check for dirty files"
      pattern: "\\.planning/formal/"
---

<objective>
Add auto-commit of dirty .planning/formal/ files in the Stop hook so regenerated formal artifacts are persisted before session ends.

Purpose: The solve pipeline regenerates formal artifacts (requirements.json, invariants, etc.) but these changes can be lost if the session ends without a manual commit. Auto-committing at session end ensures formal artifacts are always persisted.

Output: Updated nf-stop.js with autoCommitFormalArtifacts function, synced to hooks/dist/ and installed globally.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@hooks/nf-stop.js (full file — add auto-commit after evidence refresh block near line 703)
@hooks/nf-resolve-bin.js (path resolver for gsd-tools.cjs)
@.planning/formal/spec/stop-hook/invariants.md (liveness/fairness — auto-commit does not affect PASS/BLOCK decision path)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add autoCommitFormalArtifacts function to nf-stop.js</name>
  <files>
    hooks/nf-stop.js
  </files>
  <action>
Add a new function `autoCommitFormalArtifacts()` to hooks/nf-stop.js. Place it after the `appendConformanceEvent` function (around line 42) and before the command pattern functions.

The function must:

1. **Check branch safety first** — run `git rev-parse --abbrev-ref HEAD` via spawnSync. If the branch is `main`, `master`, or matches a protected pattern, return early with a stderr log. Use a hardcoded set: `['main', 'master']`. The `child_process` require is already used later in the file (line 689) — hoist it to the top of the function or use a local require.

2. **Detect dirty formal files** — run `git diff --name-only HEAD -- .planning/formal/` via spawnSync. If stdout is empty (no dirty files), return early silently.

3. **Also check untracked files** — run `git ls-files --others --exclude-standard .planning/formal/` via spawnSync. Combine with the dirty list from step 2.

4. **Stage and commit** — use `gsd-tools.cjs commit` via spawnSync for consistency. Resolve the path using `resolveBin('gsd-tools.cjs')`. The commit command format is:
   ```
   node <gsd-tools-path> commit "chore: [auto] sync regenerated formal artifacts" --files <file1> <file2> ...
   ```
   Pass each dirty file path as a separate argument after `--files`.

5. **Fail-open** — wrap the entire function body in try/catch. On any error, write to stderr with `[nf] formal auto-commit failed (fail-open): ` prefix. Never throw, never write to stdout, never call process.exit.

6. **Timeout** — set spawnSync timeout to 10000ms (10s) for all git/node calls.

Then **call** `autoCommitFormalArtifacts()` in the main function. Place the call after the evidence refresh block (after line 703, before `process.exit(0)` on line 705). Wrap the call site in its own try/catch for defense-in-depth:

```javascript
// Auto-commit dirty formal artifacts before session ends.
// Fail-open: never block session exit on commit failure.
try {
  autoCommitFormalArtifacts();
} catch (acErr) {
  process.stderr.write('[nf] formal auto-commit failed (fail-open): ' + (acErr.message || acErr) + '\n');
}
```

IMPORTANT: This code runs AFTER the quorum decision has been made and emitted. It does NOT affect the PASS/BLOCK decision path. The stop-hook invariants (LivenessProperty1-3) govern the decision logic only — this auto-commit is a post-decision side effect that cannot violate those invariants.

Do NOT modify any existing function. Do NOT change the quorum decision logic. The auto-commit is purely additive post-decision cleanup.
  </action>
  <verify>
1. `node -c hooks/nf-stop.js` — syntax check passes
2. `grep 'autoCommitFormalArtifacts' hooks/nf-stop.js` — function exists and is called
3. `grep '\[auto\]' hooks/nf-stop.js` — commit message contains [auto] tag
4. `grep "main.*master" hooks/nf-stop.js` — protected branch check exists
5. `grep 'fail-open' hooks/nf-stop.js | wc -l` — at least 3 fail-open comments (original + 2 new)
  </verify>
  <done>autoCommitFormalArtifacts function added to nf-stop.js. It detects dirty .planning/formal/ files, skips on protected branches, commits via gsd-tools.cjs with [auto] tag, and fails open on any error. Called after evidence refresh, before session exit.</done>
</task>

<task type="auto">
  <name>Task 2: Sync to hooks/dist/ and run installer</name>
  <files>
    hooks/dist/nf-stop.js
  </files>
  <action>
Per project memory (install sync required):

1. Copy the updated source to dist:
   ```
   cp hooks/nf-stop.js hooks/dist/nf-stop.js
   ```

2. Run the installer to deploy to the global hooks directory:
   ```
   node bin/install.js --claude --global
   ```

3. Verify the installed copy at `~/.claude/hooks/nf-stop.js` contains the new function:
   ```
   grep 'autoCommitFormalArtifacts' ~/.claude/hooks/nf-stop.js
   ```

This ensures the auto-commit logic is active in the running Claude Code environment, not just in the repo source.
  </action>
  <verify>
1. `diff hooks/nf-stop.js hooks/dist/nf-stop.js` — no differences (dist is in sync)
2. `grep 'autoCommitFormalArtifacts' ~/.claude/hooks/nf-stop.js` — installed copy has the function
3. `node -c ~/.claude/hooks/nf-stop.js` — installed copy has valid syntax
  </verify>
  <done>hooks/dist/nf-stop.js synced with source. Global install at ~/.claude/hooks/nf-stop.js contains autoCommitFormalArtifacts. Next session will auto-commit dirty formal artifacts.</done>
</task>

</tasks>

<verification>
1. `node -c hooks/nf-stop.js` — valid syntax
2. `grep -c 'autoCommitFormalArtifacts' hooks/nf-stop.js` — at least 2 (definition + call)
3. `diff hooks/nf-stop.js hooks/dist/nf-stop.js` — identical
4. `grep 'autoCommitFormalArtifacts' ~/.claude/hooks/nf-stop.js` — installed
5. Manual verification: on a feature branch with a dirty `.planning/formal/` file, the function would detect and commit it. On main, it would skip.
</verification>

<success_criteria>
- autoCommitFormalArtifacts function exists in hooks/nf-stop.js
- Protected branch guard prevents commits on main/master
- Dirty file detection uses git diff + git ls-files for .planning/formal/ paths only
- Commit uses gsd-tools.cjs with [auto] tag in message
- All errors are caught and logged to stderr (fail-open)
- hooks/dist/nf-stop.js is in sync
- Global install at ~/.claude/hooks/ contains the updated hook
</success_criteria>

<output>
After completion, create `.planning/quick/321-auto-commit-regenerated-formal-artifacts/321-SUMMARY.md`
</output>

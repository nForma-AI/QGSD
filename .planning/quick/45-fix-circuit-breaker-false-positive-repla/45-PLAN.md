---
phase: quick-45
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - hooks/qgsd-circuit-breaker.js
  - hooks/qgsd-circuit-breaker.test.js
autonomous: true
requirements: [QUICK-45]
must_haves:
  truths:
    - "TDD pattern (implement → test → implement → test → implement on same files) does not trigger the circuit breaker"
    - "True oscillation (same lines reverted across commits) still triggers the circuit breaker at depth=3"
    - "The installed hook at ~/.claude/hooks/qgsd-circuit-breaker.js is identical to hooks/qgsd-circuit-breaker.js"
    - "All existing circuit breaker tests still pass"
  artifacts:
    - path: "hooks/qgsd-circuit-breaker.js"
      provides: "diff-based oscillation detection replacing file-set detection"
      contains: "getCommitDiff"
    - path: "hooks/qgsd-circuit-breaker.test.js"
      provides: "regression test for TDD false-positive scenario (CB-TC20)"
      contains: "CB-TC20"
  key_links:
    - from: "detectOscillation()"
      to: "getCommitDiff()"
      via: "called after file-set match confirms candidate, before flagging"
      pattern: "getCommitDiff"
    - from: "hooks/qgsd-circuit-breaker.js"
      to: "~/.claude/hooks/qgsd-circuit-breaker.js"
      via: "fs.copyFileSync or cp"
      pattern: "copyFileSync|cp.*hooks"
---

<objective>
Fix the circuit breaker false positive where TDD patterns (implement → test → implement → test → implement on the same files across different commits) incorrectly trigger oscillation detection.

Purpose: The file-set oscillation algorithm cannot distinguish between "same lines toggled back and forth" (real oscillation) and "same file extended with new lines each time" (TDD progression). Switching to diff-based reversion detection eliminates the false positive while preserving detection of genuine loops.

Output: Updated `hooks/qgsd-circuit-breaker.js` with a `getCommitDiff()` helper and modified `detectOscillation()` that uses line-level reversion analysis; new regression test CB-TC20; installed hook synced.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@hooks/qgsd-circuit-breaker.js
@hooks/qgsd-circuit-breaker.test.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace file-set detection with diff-based reversion check in detectOscillation()</name>
  <files>hooks/qgsd-circuit-breaker.js</files>
  <action>
Add a `getCommitDiff(gitRoot, hash)` helper function that runs `git diff-tree -p --no-commit-id -r <hash>` and returns the raw unified diff string for that commit (empty string on error — fail-open).

Modify `detectOscillation(fileSets, depth, hashes, gitRoot)` to accept two new parameters: `hashes` (the commit hash array, same order as fileSets) and `gitRoot`.

The existing run-group counting logic stays unchanged as the first-pass filter. Only when a file-set key reaches `>= depth` run-groups does the new second-pass reversion check run:

Second-pass reversion check algorithm:
1. Collect all hashes that belong to run-groups for the oscillating file-set key (those are the commits in `hashes` whose corresponding `fileSets[i]` key matches the oscillating key).
2. For each consecutive pair of such commits (commit[0] and commit[1], commit[1] and commit[2], etc.), run `git diff <earlier_hash> <later_hash> -- <each_file_in_oscillating_set>`.
   - Use `spawnSync('git', ['diff', earlierHash, laterHash, '--', ...files], ...)`.
   - Parse the unified diff: count lines starting with `+` (not `+++`) as additions, lines starting with `-` (not `---`) as deletions in `laterHash` relative to `earlierHash`.
3. If ANY consecutive pair shows net deletions (lines removed from the file in the later commit), treat it as a reversion → real oscillation → return `{ detected: true, fileSet }`.
4. If ALL consecutive pairs are purely additive (zero net deletions across the oscillating files), this is TDD progression → return `{ detected: false, fileSet: [] }`.

Note on hashes order: `getCommitHashes()` returns newest-first from `git log`. `fileSets[0]` corresponds to the newest commit. When diffing "consecutive oscillating commits", the earlier hash has a higher index in the array. Always diff `hashes[higherIndex]` → `hashes[lowerIndex]` (i.e., forward in time: `git diff <older> <newer>`).

Update the call site in `main()` to pass `hashes` and `gitRoot` to `detectOscillation()`:
```js
const result = detectOscillation(fileSets, config.circuit_breaker.oscillation_depth, hashes, gitRoot);
```

Fail-open rule: if `getCommitDiff` returns empty string (git error), skip that pair and continue — do not block on git errors. If ALL pairs error out (no diff available), fall back to the original behavior (treat as oscillation) to preserve the safety net.

Keep `getCommitFileSets` and all other existing functions unchanged. Do NOT change `buildBlockReason`, `writeState`, `consultHaiku`, or any enforcement logic.
  </action>
  <verify>node --test hooks/qgsd-circuit-breaker.test.js 2>&1 | tail -20</verify>
  <done>All existing tests pass (CB-TC1 through CB-TC19 + CB-TC-BR1 through CB-TC-BR3). The algorithm change is isolated to detectOscillation().</done>
</task>

<task type="auto">
  <name>Task 2: Add CB-TC20 regression test for TDD false-positive and sync installed hook</name>
  <files>hooks/qgsd-circuit-breaker.test.js</files>
  <action>
Add test CB-TC20 to `hooks/qgsd-circuit-breaker.test.js` that reproduces the exact Phase 18 false positive scenario:

```
test('CB-TC20: TDD pattern — same file extended with new content each time does not trigger oscillation', () => {
  // Simulate: gsd-tools.cjs (new fn A) → gsd-tools.test.cjs (tests A) →
  //           gsd-tools.cjs (new fn B) → gsd-tools.test.cjs (tests B) →
  //           planning file → gsd-tools.cjs (new fn C)
  // Each commit to gsd-tools.cjs ADDS new lines — never reverts previous content.
  // Result: should NOT trigger circuit breaker.
})
```

Implementation: create a temp git repo. For each "implement" commit to `gsd-tools.cjs`, append new content to the file (never truncate/rewrite to earlier state — use `fs.appendFileSync` or write `content-a\ncontent-b` then `content-a\ncontent-b\ncontent-c`). For "test" commits, write to `gsd-tools.test.cjs` (alternating file). Include one commit to a planning file between the 4th and 5th commits. Use `git add <file>` (not `git add .`) to keep commits clean.

Assert that after running the hook with a write command, no state file is written (oscillation NOT detected).

Also add CB-TC21: true reversion test — a commit that re-introduces previously-deleted content DOES trigger detection:

```
test('CB-TC21: True oscillation — lines added then removed then added again triggers detection', () => {
  // Commit 1: write 'function foo() { return 1; }' to app.js
  // Commit 2: write different file (filler)
  // Commit 3: write 'function foo() { return 2; }' to app.js (removes line from commit 1)
  // Commit 4: write different file (filler)
  // Commit 5: write 'function foo() { return 1; }' to app.js (re-adds original line)
  // Result: SHOULD trigger circuit breaker (line was added, removed, re-added = reversion)
})
```

After adding the tests, sync the updated hook to the installed location:
```
cp /Users/jonathanborduas/code/QGSD/hooks/qgsd-circuit-breaker.js /Users/jonathanborduas/.claude/hooks/qgsd-circuit-breaker.js
```

Run the full test suite to confirm all tests pass including CB-TC20 and CB-TC21.
  </action>
  <verify>node --test hooks/qgsd-circuit-breaker.test.js 2>&1 | grep -E "^(ok|not ok|#)" | tail -30</verify>
  <done>CB-TC20 passes (TDD pattern not blocked), CB-TC21 passes (real reversion is blocked), all prior tests still pass, installed hook at ~/.claude/hooks/qgsd-circuit-breaker.js matches source.</done>
</task>

</tasks>

<verification>
1. `node --test hooks/qgsd-circuit-breaker.test.js` — all tests pass (CB-TC1 through CB-TC21 + BR series)
2. `diff hooks/qgsd-circuit-breaker.js ~/.claude/hooks/qgsd-circuit-breaker.js` — no diff (files identical)
3. Manually inspect `detectOscillation()` — confirm hashes/gitRoot params present, diff-based check present, fail-open on git error
</verification>

<success_criteria>
- All 21+ circuit breaker tests pass
- TDD pattern (same file, only additive commits, 3 run-groups) does NOT activate the breaker
- True reversion pattern (content added, removed, re-added) DOES activate the breaker at depth=3
- Installed hook at ~/.claude/hooks/ is identical to hooks/ source
</success_criteria>

<output>
After completion, create `.planning/quick/45-fix-circuit-breaker-false-positive-repla/45-SUMMARY.md`
</output>

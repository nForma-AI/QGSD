---
phase: quick-117
plan: 01
subsystem: hooks
tags: [precompact, context-continuation, hooks, installer]
key-files:
  created:
    - hooks/qgsd-precompact.js
    - hooks/dist/qgsd-precompact.js
  modified:
    - bin/install.js
decisions:
  - "hooks/dist/ is gitignored — dist copy maintained on disk only; source hooks/qgsd-precompact.js is the tracked artifact"
  - "PreCompact hook reads pending task files without consuming them (no atomic rename), unlike qgsd-prompt.js consumePendingTask — safe for PreCompact context"
  - "extractCurrentPosition and readPendingTasks exported via module.exports guard for future unit test coverage"
metrics:
  completed: 2026-02-27T18:56:22Z
  tasks: 2
  files: 3
---

# Quick Task 117: Add PreCompact Hook for Seamless Context Continuation

**One-liner:** PreCompact hook that injects STATE.md current position and pending task as additionalContext so compacted sessions resume with full QGSD context awareness.

## What Was Built

### hooks/qgsd-precompact.js (new)

A PreCompact hook following the same stdin→stdout pattern as `hooks/gsd-context-monitor.js`.

Behavior:
1. Reads stdin JSON `{ cwd }` to locate the project directory.
2. Reads `.planning/STATE.md` and extracts the `## Current Position` section (up to the next `##` header).
3. Reads `.claude/pending-task.txt` and `.claude/pending-task-*.txt` without consuming them (no atomic rename — safe for compaction context).
4. Builds a `QGSD CONTINUATION CONTEXT` block with:
   - Current Position section from STATE.md
   - Pending Task section (if any pending-task files found)
   - Resume Instructions telling Claude to continue the current plan or pending task
5. Outputs JSON: `{ hookSpecificOutput: { hookEventName: 'PreCompact', additionalContext: '...' } }`
6. Falls back to a minimal "run cat .planning/STATE.md" message if STATE.md is absent or unreadable.
7. Uses `process.exit(0)` and try/catch everywhere — fails open, never blocks compaction.
8. Exports `extractCurrentPosition` and `readPendingTasks` via `module.exports` guard for testability.

### hooks/dist/qgsd-precompact.js (new, gitignored)

Exact copy of the source. Created by `cp hooks/qgsd-precompact.js hooks/dist/qgsd-precompact.js` before `node bin/install.js --claude --global`. The installer reads from `hooks/dist/` and copies to `~/.claude/hooks/`.

Note: `hooks/dist/` is gitignored by project design. The tracked source is `hooks/qgsd-precompact.js`.

### bin/install.js (modified)

Two additions:

**Registration block** (after PostToolUse context monitor, around line 1862):
- Creates `settings.hooks.PreCompact` array if absent
- Idempotency check: only pushes if no existing entry includes `qgsd-precompact`
- Prints `Configured QGSD PreCompact hook (phase state injection)` on success

**Uninstall block** (after PostToolUse removal, before "Clean up empty hooks"):
- Filters out entries containing `qgsd-precompact` from `settings.hooks.PreCompact`
- Deletes the `PreCompact` key if array becomes empty
- Prints `Removed QGSD PreCompact hook` when removed

The `cleanupOrphanedHooks` function already iterates all event types generically via `Object.keys(settings.hooks)` — no modification needed.

## Verification Results

**Task 1 — Hook JSON output:**
```
node hooks/qgsd-precompact.js <<< '{"cwd":"/Users/jonathanborduas/code/QGSD"}' | node -e "..."
Task 1 verify: OK
--- additionalContext preview (first 400 chars) ---
QGSD CONTINUATION CONTEXT (auto-injected at compaction)

## Current Position
Phase: v0.19-04 (Enforcement Layer) — COMPLETE (all 3 plans done)
...
```

**Task 1 — Graceful fallback (missing STATE.md):**
```
node hooks/qgsd-precompact.js <<< '{"cwd":"/tmp"}'
graceful fallback: ok
content: QGSD session resumed after compaction. Run `cat .planning/STATE.md` for project state.
```

**Task 2 — PreCompact entry in settings.json after install:**
```
PreCompact hook registered: OK
Entry: {
  "hooks": [
    { "type": "command", "command": "node \"/Users/jonathanborduas/.claude/hooks/qgsd-precompact.js\"" }
  ]
}
```

**npm test:** 6 pre-existing RED test failures (planned for v0.19-05 phase); zero regressions from this change (confirmed by stash comparison).

## Deviations from Plan

### hooks/dist/ is gitignored

The plan's final commit command included `hooks/dist/qgsd-precompact.js`, but `hooks/dist/` is gitignored by project design (per MEMORY.md note: "installer reads from hooks/dist/ NOT hooks/"). The dist copy exists on disk and the installer registered it correctly to `~/.claude/hooks/`. The tracked source `hooks/qgsd-precompact.js` is the canonical artifact.

## Commits

- `e2dc154` — `feat(quick-117): create hooks/qgsd-precompact.js` (Task 1)
- `c835f0d` — `feat(quick-117): register PreCompact hook in installer` (Task 2)

## Self-Check

- [x] hooks/qgsd-precompact.js exists and passes verification
- [x] hooks/dist/qgsd-precompact.js exists on disk (gitignored, installer-managed)
- [x] bin/install.js has registration + uninstall blocks
- [x] ~/.claude/settings.json has PreCompact hook entry
- [x] npm test — no new regressions

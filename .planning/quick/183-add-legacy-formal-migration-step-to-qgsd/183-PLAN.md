---
phase: quick-183
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/migrate-formal-dir.cjs
  - commands/qgsd/solve.md
autonomous: true
requirements: [QUICK-183]
formal_artifacts: none

must_haves:
  truths:
    - "Running /qgsd:solve on a project with .formal/ at root auto-migrates files into .planning/formal/"
    - "Running bin/migrate-formal-dir.cjs standalone detects, merges, and optionally removes legacy .formal/"
    - "If .formal/ does not exist, the migration step is a silent no-op"
    - "Conflicting files preserve .planning/formal/ version (canonical takes precedence)"
    - "Migration logs every file copied/skipped so the user knows what happened"
  artifacts:
    - path: "bin/migrate-formal-dir.cjs"
      provides: "Standalone migration script for legacy .formal/ to .planning/formal/"
      min_lines: 60
    - path: "commands/qgsd/solve.md"
      provides: "Updated solve skill with Step 0: Legacy .formal/ Migration"
      contains: "Step 0"
  key_links:
    - from: "commands/qgsd/solve.md"
      to: "bin/migrate-formal-dir.cjs"
      via: "Step 0 instructs executor to run the migration script"
      pattern: "migrate-formal-dir"
    - from: "bin/migrate-formal-dir.cjs"
      to: ".planning/formal/"
      via: "fs copy/move from .formal/ into .planning/formal/"
      pattern: "\\.formal/"
---

<objective>
Add a legacy `.formal/` migration step to the qgsd:solve skill.

Purpose: Projects that adopted formal verification before the `.planning/formal/` layout consolidation may still have a root-level `.formal/` directory. This migration detects the old layout, merges files into the canonical `.planning/formal/` location, and optionally removes the legacy path -- preventing silent diagnostic misses where models exist but the solver cannot find them.

Output: A standalone `bin/migrate-formal-dir.cjs` script (runnable independently) and an updated `commands/qgsd/solve.md` with a new Step 0 that invokes it before the diagnostic sweep.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@commands/qgsd/solve.md
@bin/qgsd-solve.cjs (lines 30-60: ROOT/project-root handling, lines 418-450: preflight bootstrap)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create bin/migrate-formal-dir.cjs standalone migration script</name>
  <files>bin/migrate-formal-dir.cjs</files>
  <action>
Create a Node.js CJS script at bin/migrate-formal-dir.cjs that migrates a legacy .formal/ directory into .planning/formal/. Follow the same CLI pattern as other bin/ scripts (shebang, 'use strict', --project-root flag, --json flag, TAG logging).

Core logic:

1. **Detect**: Check if `path.join(ROOT, '.formal')` exists. If not, log `"[migrate-formal] No legacy .formal/ found — nothing to migrate"` and exit 0.

2. **Ensure target**: Create `path.join(ROOT, '.planning', 'formal')` recursively if it does not exist (same as preflight() in qgsd-solve.cjs).

3. **Walk and merge**: Recursively walk `.formal/` collecting all files. For each file:
   - Compute its relative path from `.formal/` (e.g., `tla/MyModel.tla`)
   - Check if the same relative path exists under `.planning/formal/`
   - If target does NOT exist: copy the file, log `"[migrate-formal] Copied: {relPath}"`
   - If target DOES exist: skip with log `"[migrate-formal] Skipped (already exists in .planning/formal/): {relPath}"` — canonical location wins on conflicts
   - Create intermediate directories under `.planning/formal/` as needed

4. **Summary**: After walking, log total counts: `"[migrate-formal] Migration complete: {copied} copied, {skipped} skipped (conflicts), {total} total files in legacy .formal/"`

5. **Optional removal**: Accept a `--remove-legacy` flag. If passed AND at least 1 file was processed (copied or skipped), remove the `.formal/` directory recursively with `fs.rmSync(legacyDir, { recursive: true, force: true })` and log `"[migrate-formal] Removed legacy .formal/ directory"`. Without the flag, log `"[migrate-formal] Legacy .formal/ preserved — pass --remove-legacy to remove"`.

6. **JSON mode**: If `--json` flag, output a JSON object: `{ legacy_found: bool, copied: N, skipped: N, total: N, removed: bool, files_copied: [...], files_skipped: [...] }` to stdout instead of human-readable logs.

7. **Error handling**: Fail-open pattern — if any individual file copy fails, log the error and continue. Never abort the entire migration for a single file failure. Exit code: 0 on success, 1 only if the entire operation could not start (e.g., ROOT is invalid).

Make the script executable (chmod +x via shebang).
  </action>
  <verify>
Run: `node bin/migrate-formal-dir.cjs --project-root=$(pwd)` — should report "No legacy .formal/ found" and exit 0.
Run: `node bin/migrate-formal-dir.cjs --json --project-root=$(pwd)` — should output valid JSON with `legacy_found: false`.
Run: `node -e "require('fs').mkdirSync('.formal/tla', {recursive:true}); require('fs').writeFileSync('.formal/tla/test.tla', 'test')"` then `node bin/migrate-formal-dir.cjs --json --project-root=$(pwd)` — should report 1 copied. Clean up: `rm -rf .formal`.
  </verify>
  <done>bin/migrate-formal-dir.cjs exists, handles detect/merge/skip/remove/json modes, exits cleanly when no legacy dir exists, correctly merges when legacy dir is present.</done>
</task>

<task type="auto">
  <name>Task 2: Add Step 0 to solve.md and wire migration into solve process</name>
  <files>commands/qgsd/solve.md</files>
  <action>
Edit commands/qgsd/solve.md to insert a new "Step 0: Legacy .formal/ Migration" before the existing "Step 1: Initial Diagnostic Sweep". Renumber nothing — keep existing step numbers as-is (Step 0 is a new pre-step, Steps 1-7 remain unchanged).

Insert the following section immediately after the `<process>` opening tag and before `## Step 1`:

```markdown
## Step 0: Legacy .formal/ Migration

Before running the diagnostic sweep, check for a legacy `.formal/` directory at the project root (next to `.planning/`). This is the OLD layout from before formal verification was consolidated under `.planning/formal/`.

Run the migration script using absolute paths (or fall back to CWD-relative):

\`\`\`bash
MIGRATE=$(node ~/.claude/qgsd-bin/migrate-formal-dir.cjs --json --project-root=$(pwd) 2>&1)
\`\`\`

If `~/.claude/qgsd-bin/migrate-formal-dir.cjs` does not exist, fall back to `bin/migrate-formal-dir.cjs` (CWD-relative).
If neither exists, skip this step silently — the migration script is optional for projects that never had a legacy layout.

Parse the JSON output:
- If `legacy_found` is `false`: log `"Step 0: No legacy .formal/ found — skipping migration"` and proceed to Step 1.
- If `legacy_found` is `true`: log the migration summary: `"Step 0: Migrated legacy .formal/ — {copied} files copied, {skipped} conflicts (canonical .planning/formal/ preserved)"`. The legacy `.formal/` directory is NOT auto-removed — the user can run `node bin/migrate-formal-dir.cjs --remove-legacy --project-root=$(pwd)` manually after verifying the migration.

**Important:** This step is fail-open. If the migration script errors or is not found, log the issue and proceed to Step 1. Migration failure must never block the diagnostic sweep.
```

Also update the skill description (line 2) to mention the migration capability: change the description to include "with legacy .formal/ migration" — e.g., `description: Orchestrator skill that migrates legacy .formal/ layouts, diagnoses consistency gaps, dispatches to remediation skills for each gap type, and converges via diagnose-remediate-rediagnose loop with before/after comparison`.

Do NOT modify any other steps. The existing Step 1 through Step 7 remain exactly as they are.
  </action>
  <verify>
Grep commands/qgsd/solve.md for "Step 0" — should find the new section.
Grep commands/qgsd/solve.md for "migrate-formal-dir" — should find references to the script.
Grep commands/qgsd/solve.md for "Step 1: Initial Diagnostic Sweep" — should still exist unchanged.
Verify step numbering: Step 0 appears before Step 1, and Steps 1-7 are all present.
  </verify>
  <done>solve.md contains Step 0: Legacy .formal/ Migration before Step 1, references bin/migrate-formal-dir.cjs with absolute path fallback, is fail-open, does not auto-remove the legacy directory, and all existing steps (1-7) are unchanged.</done>
</task>

</tasks>

<verification>
1. `node bin/migrate-formal-dir.cjs --project-root=$(pwd)` exits 0 with "no legacy" message
2. `node bin/migrate-formal-dir.cjs --json --project-root=$(pwd)` outputs valid JSON
3. `grep -c "Step 0" commands/qgsd/solve.md` returns 1
4. `grep -c "Step 1" commands/qgsd/solve.md` returns at least 1 (unchanged)
5. Integration test: create a temp .formal/tla/test.tla, run migration, verify file appears in .planning/formal/tla/test.tla, clean up
</verification>

<success_criteria>
- bin/migrate-formal-dir.cjs is a working standalone script with detect/merge/skip/remove/json modes
- solve.md has Step 0 that invokes migration before diagnostic sweep
- Migration is fail-open (never blocks the solver)
- Canonical .planning/formal/ always wins on conflicts
- Legacy .formal/ is not auto-removed (safety-first; user must pass --remove-legacy explicitly)
</success_criteria>

<output>
After completion, create `.planning/quick/183-add-legacy-formal-migration-step-to-qgsd/183-SUMMARY.md`
</output>

---
phase: quick-256
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/nf-solve.cjs
  - .gitignore
autonomous: true
formal_artifacts: none
must_haves:
  truths:
    - nf-solve.cjs preflight() refuses to create .planning/ when ROOT is not a valid project root
    - .gitignore includes entries for common solve debris patterns
  artifacts:
    - bin/nf-solve.cjs (updated preflight with root validation)
    - .gitignore (updated with debris patterns)
  key_links:
    - bin/nf-solve.cjs:468 (preflight function)
---

<objective>
Fix solve subagent cwd/path bugs that create junk files in project root.

Root cause: `nf-solve.cjs` defaults `ROOT = process.cwd()`. When subagents run with wrong
cwd (e.g., `bin/`), preflight() creates `.planning/` in the wrong location. Additionally,
Alloy model generation and malformed bash commands create debris at project root.
</objective>

<tasks>
<task type="auto">
  <name>Add project root validation to nf-solve.cjs preflight()</name>
  <files>bin/nf-solve.cjs</files>
  <action>
Add a validation check at the top of preflight() that verifies ROOT looks like a valid
project root before creating any directories. Check for at least ONE of:
- ROOT/package.json exists
- ROOT/.planning/ directory already exists
- ROOT/CLAUDE.md exists

If none exist, log an error to stderr and return early WITHOUT creating any directories:
  "[nf-solve] WARNING: ROOT does not look like a project root (no package.json, .planning/, or CLAUDE.md found at {ROOT}). Skipping directory creation. Pass --project-root= to specify the correct path."

This prevents preflight() from creating .planning/ inside bin/ or any other wrong directory.
  </action>
  <verify>Read bin/nf-solve.cjs and confirm the guard is present in preflight()</verify>
  <done>preflight() validates ROOT before mkdirSync calls</done>
</task>

<task type="auto">
  <name>Add solve debris patterns to .gitignore</name>
  <files>.gitignore</files>
  <action>
Add entries to .gitignore to prevent common solve agent debris from being tracked:
- `/=` (from malformed bash assignments)
- `/1` (from malformed bash assignments)
- `/readme-structure/` (from Alloy model generation at wrong cwd)
- `bin/.planning/` (from scripts running with wrong cwd)

Add these under a "# Solve agent debris (cwd bugs)" comment section.
  </action>
  <verify>grep for the new patterns in .gitignore</verify>
  <done>.gitignore contains debris patterns</done>
</task>
</tasks>

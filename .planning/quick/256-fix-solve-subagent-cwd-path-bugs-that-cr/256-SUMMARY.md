# Quick Task 256: Fix solve subagent cwd/path bugs

## Problem
Solve subagents sometimes run with incorrect working directories, causing scripts
to create files/directories in wrong locations:
- `bin/.planning/` — nf-solve.cjs preflight() creating .planning/ inside bin/
- `=` and `1` — 0-byte files from malformed bash variable assignments
- `readme-structure/` — Alloy model generation writing to project root

## Root Cause
`nf-solve.cjs` line 52: `let ROOT = process.cwd()`. When subagents run with wrong
cwd (e.g., `bin/`), ROOT resolves to the wrong directory, and preflight() creates
`.planning/formal/` subdirectories there.

## Changes

### 1. Project root validation guard (bin/nf-solve.cjs)
Added a guard at the top of `preflight()` that checks for at least one project root
marker (package.json, .planning/, or CLAUDE.md) before creating any directories.
If no marker is found, logs a warning and returns early without creating directories.

### 2. .gitignore debris patterns
Added entries for common solve debris patterns as a safety net:
- `/=`, `/1` (malformed bash assignments)
- `/readme-structure/` (Alloy working directory)
- `bin/.planning/` (wrong-cwd script output)

## Verification
- `preflight()` now validates ROOT before any `mkdirSync` calls
- `.gitignore` prevents debris from being tracked even if it recurs

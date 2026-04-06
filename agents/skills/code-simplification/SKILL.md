---
name: nf:code-simplification
description: Guides systematic code simplification — reduce complexity, remove dead code, flatten abstractions, and improve readability without changing behavior.
---

# code-simplification skill

Purpose
-------
Reduce code complexity while preserving all existing behavior. This skill focuses on making code easier to read, understand, and maintain — not on adding features or fixing bugs.

When to use
-----------
- After a feature is complete and working, before merge
- When a module has grown too complex over time
- When reviewing code that is hard to follow
- When consolidating duplicate logic across files
- When the user asks to simplify, clean up, or refactor

When NOT to use
---------------
- During active feature development (finish first, simplify second)
- To add features disguised as refactoring
- On code that is already simple and readable

High-level steps
----------------
1) Ensure test coverage
  - Confirm tests exist for the code being simplified
  - If tests are missing, write them first (use `nf:test-driven-development`)
  - Tests are the safety net that proves behavior is preserved

2) Identify complexity
  - Look for: deeply nested conditionals, long functions (> 50 lines), duplicated logic, premature abstractions, dead code, unclear naming
  - Prioritize by readability impact, not by size

3) Simplify one thing at a time
  - Flatten nested conditionals with early returns
  - Inline single-use abstractions
  - Remove dead code entirely (no commented-out code)
  - Rename unclear variables and functions
  - Extract only when three or more similar blocks exist

4) Verify after each change
  - Run the test suite after every simplification step
  - If tests break, revert and investigate — the behavior changed

5) Stop when readable
  - The goal is clarity, not minimal line count
  - Three similar lines are better than a premature abstraction
  - If the code reads clearly top to bottom, stop

Rules
-----
- Never change behavior during simplification
- Never add features during simplification
- Remove dead code completely — no `// removed` comments or `_unused` renames
- Prefer deleting code over abstracting code
- Inline helpers that are used only once
- Do not add type annotations, docstrings, or comments to code you did not change

Integration with nForma
------------------------
- After simplification, run `nf:code-review-and-quality` for merge review
- For test coverage gaps, use `nf:test-driven-development`
- The `/simplify` plugin skill does similar work — this skill provides the nForma-native process

Licensing / attribution
-----------------------
Adapted for nForma from the MIT-licensed `code-simplification` skill in `addyosmani/agent-skills`.

---
name: nf:test-driven-development
description: Guides the TDD workflow — write a failing test, make it pass, refactor — for new features, bug fixes, and contract changes.
---

# test-driven-development skill

Purpose
-------
Apply the RED → GREEN → REFACTOR cycle to produce well-tested code with clear intent. This skill focuses on the TDD discipline itself, not on fixing existing test failures (use `/nf:fix-tests` for that) or running test suites (use `/nf:quorum-test`).

When to use
-----------
- Building a new feature or module where the behavior can be specified upfront
- Fixing a bug where a regression test should be written first
- Changing a public interface or contract where existing consumers need protection
- When the user explicitly asks for TDD or test-first development

When NOT to use
---------------
- Fixing broken tests → `/nf:fix-tests`
- Running and validating test suites → `/nf:quorum-test`
- Debugging failures → `/nf:debug`

High-level steps
----------------
1) Understand the requirement
  - Restate the expected behavior in plain language
  - Identify inputs, outputs, and edge cases

2) RED — write a failing test
  - Write the smallest test that captures the expected behavior
  - Run it and confirm it fails for the right reason (not a syntax error)
  - Name the test after the behavior: "returns empty array when no slots configured"

3) GREEN — make it pass
  - Write the minimum code to make the test pass
  - Do not add extra logic, optimization, or structure yet
  - Run the test and confirm green

4) REFACTOR — clean up
  - Remove duplication between test and production code
  - Extract helpers only if they reduce real complexity
  - Run the full test suite to confirm no regressions

5) Repeat
  - Pick the next behavior and go back to RED
  - Keep cycles short (5–15 minutes each)

The Prove-It Pattern (for bugs)
-------------------------------
1. Write a test that reproduces the exact failure
2. Confirm it fails
3. Fix the bug
4. Confirm the test passes
5. The test now prevents regression forever

Test quality rules
------------------
- Prefer state-based assertions over interaction-based (mock) assertions
- Each test should test one behavior, not one function
- Tests should be independent — no shared mutable state
- Keep the test pyramid: many unit tests, fewer integration tests, minimal E2E
- Avoid testing implementation details — test the contract
- No `console.log` in test files — use assertions

Anti-patterns to avoid
----------------------
- Writing tests after implementation (that's verification, not TDD)
- Testing private methods directly
- Mocking everything instead of using real implementations where feasible
- Skipping the RED step (if the test passes before you write code, the test is wrong)
- Over-testing obvious code (getters, simple constructors)

Integration with nForma
------------------------
- After TDD cycles complete, use `nf:code-review-and-quality` for merge readiness
- For formal invariant coverage, check `/nf:formal-test-sync`
- Reference `references/testing-patterns.md` for project-specific test conventions

Licensing / attribution
-----------------------
Adapted for nForma from the MIT-licensed `test-driven-development` skill in `addyosmani/agent-skills`.

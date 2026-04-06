# Testing Patterns Checklist

Use this checklist when reviewing or writing tests for nForma changes.

## Unit tests

- [ ] Each public function has at least one test covering the happy path
- [ ] Edge cases are covered: empty input, null/undefined, boundary values
- [ ] Error paths are tested — verify the right error is thrown, not just that something throws
- [ ] Mocks are minimal — prefer real implementations over mocks where feasible
- [ ] Tests are independent — no shared mutable state between test cases
- [ ] Test names describe the behavior, not the implementation ("returns empty array when no slots configured" not "test getSlots")

## Integration tests

- [ ] Cross-module interactions are tested through public interfaces
- [ ] File I/O tests use temporary directories and clean up after themselves
- [ ] Tests that depend on external state (config files, environment) document that dependency
- [ ] Hook tests verify the full hook contract (input → decision → output)

## Verification tests

- [ ] Formal model invariants have corresponding test assertions (see `/nf:formal-test-sync`)
- [ ] Quorum dispatch tests verify parallel Task calls, not sequential MCP calls
- [ ] Install tests verify file presence and content, not just exit code

## Regression tests

- [ ] Every bug fix includes a test that reproduces the original failure
- [ ] Tests pin the fix — they should fail if the fix is reverted

## Test hygiene

- [ ] No `console.log` left in test files (use test framework assertions)
- [ ] No skipped tests without a tracking issue
- [ ] No flaky tests — if timing-dependent, use explicit waits or deterministic alternatives
- [ ] Test suite runs in under 60 seconds locally

## nForma-specific patterns

- [ ] Slot worker tests use file-based output (not stdout parsing)
- [ ] MCP health checks use the `health_check` tool, not `ping`
- [ ] Hook tests cover both allow and block paths
- [ ] Circuit breaker tests verify the run-collapse algorithm with alternating groups

## Attribution

Adapted for nForma from the MIT-licensed testing-patterns reference in [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills).

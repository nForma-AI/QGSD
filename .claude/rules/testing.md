# Testing Rules

- Test files live alongside source in hooks/dist/ (e.g., nf-stop.test.js)
- Run tests with `npm test` -- uses vitest
- Hook tests must verify fail-open behavior (empty input -> exit 0)
- When editing hooks, always run the corresponding test file to verify
- Known pre-existing failures: 11 in secrets.test.cjs (unimplemented patchClaudeJsonForKey), nf-precompact.test.js hangs (stdin listener)
- Test coverage is tracked in .planning/formal/unit-test-coverage.json

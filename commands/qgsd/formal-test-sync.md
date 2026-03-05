---
name: qgsd:formal-test-sync
description: Cross-reference formal model invariants with unit test coverage, validate constants, and generate test stubs
argument-hint: [--report-only] [--dry-run] [--json] [--stubs-dir=<path>]
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
---

<objective>
Cross-reference formal model invariants with unit test coverage. Reports gaps where invariants lack test backing, validates formal model constants against runtime config defaults, generates test stubs for uncovered requirements, and updates the traceability matrix with unit test coverage data.
</objective>

<execution_context>
None required — self-contained script.
</execution_context>

<process>
Run `node bin/formal-test-sync.cjs $ARGUMENTS` and display results.

If no flags are passed, the full sync runs (coverage report + constants validation + stub generation + sidecar update).

Use `--report-only` for read-only analysis without generating stubs or updating sidecar files.

Use `--json` for machine-readable output.

Use `--dry-run` to show what stubs would be generated without writing them.

Use `--stubs-dir=<path>` to override the default stub output directory (.formal/generated-stubs/).
</process>

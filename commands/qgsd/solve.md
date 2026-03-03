---
name: qgsd:solve
description: Run the consistency solver - sweeps Requirements->Formal->Tests->Code, computes residual vector, auto-closes gaps
argument-hint: [--report-only] [--max-iterations=N] [--json] [--verbose]
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
---

<objective>
Run the QGSD consistency solver. Sweeps 5 layer transitions (R->F, F->T, C->F, T->C, F->C), computes a residual vector showing gaps at each boundary, and optionally auto-closes gaps by generating test stubs, regenerating formal specs, and fixing constants. Iterates until residual converges or max iterations reached.
</objective>

<execution_context>
None required -- self-contained orchestrator.
</execution_context>

<process>
Run `node bin/qgsd-solve.cjs $ARGUMENTS` and display results.

Default mode (no flags): runs up to 3 iterations of sweep + auto-close. Generates test stubs for uncovered invariants, updates traceability data.

Use `--report-only` for read-only analysis (single sweep, no mutations).

Use `--json` for machine-readable output.

Use `--max-iterations=N` to control iteration limit (default 3, max 10).

Use `--verbose` for detailed per-step diagnostics.

**Interpreting the residual vector:**
- GREEN (0): Layer transition is fully consistent
- YELLOW (1-3): Minor gaps exist
- RED (4+): Significant gaps requiring attention

**Layer transitions:**
- R->F: Requirements lacking formal model coverage
- F->T: Formal invariants lacking test backing
- C->F: Code constants diverging from formal specs
- T->C: Failing unit tests
- F->C: Failing formal verification checks
</process>

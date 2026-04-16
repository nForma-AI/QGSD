---
name: nf:harden
description: Run an adversarial hardening loop — iteratively generate edge-case tests, fix failures, and converge
argument-hint: "[--area <path>] [--full]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Task
---
<objective>
Run an adversarial test-write-fix loop to harden code against edge cases. An adversarial agent generates tests designed to break the implementation; the executor fixes the failures; the loop repeats until convergence (2 consecutive zero-change iterations) or the iteration cap (10) is reached.

**`--area <path>` flag:** Restrict adversarial testing to the specified file or directory subtree.

**`--full` flag:** Increase adversarial pressure — expand the categories of edge cases the adversarial agent probes (boundary values, type coercion, concurrency, error propagation).
</objective>

<execution_context>
@~/.claude/nf/workflows/harden.md
</execution_context>

<context>
$ARGUMENTS
</context>

<process>
Execute the harden workflow from @~/.claude/nf/workflows/harden.md end-to-end.
</process>

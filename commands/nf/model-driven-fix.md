---
name: model-driven-fix
description: Run the 6-phase prescriptive cycle to create or refine a formal model for a bug and produce a formally-constrained fix
argument-hint: "bug description" [--files=path1,path2] [--formalism=tla|alloy|prism] [--verbose] [--skip-fix]
allowed_tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Agent
execution_context: workflow
---

<objective>
Orchestrate the full model-driven fix cycle: discover existing models, attempt reproduction, refine or create a model that captures the failure, extract constraints, apply constraints to guide fix, and verify the fix resolves the failure.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/model-driven-fix.md
</execution_context>

<process>
Execute the model-driven-fix workflow from @/Users/jonathanborduas/.claude/nf/workflows/model-driven-fix.md end-to-end.
Pass through all --flags from arguments:
  "bug description"            Main argument — describes the bug to model and fix (required)
  --files=path1,path2          Comma-separated affected file paths (optional, helps model discovery)
  --formalism=tla|alloy|prism  Override formalism selection (optional, auto-selects by default)
  --verbose                    Show full model checker output throughout all phases
  --skip-fix                   Stop after constraint extraction (Phase 4), skip Phases 5-6
</process>

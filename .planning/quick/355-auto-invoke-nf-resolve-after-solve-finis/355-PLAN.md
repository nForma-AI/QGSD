---
phase: quick-355
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - commands/nf/solve.md
autonomous: true
requirements: [INTENT-01]
formal_artifacts: none

must_haves:
  truths:
    - "After solve finishes with non-zero residual, nf:resolve is automatically invoked"
    - "After solve finishes with zero residual, nf:resolve is NOT invoked"
    - "Report-only mode does NOT trigger nf:resolve"
    - "Plan-only mode does NOT trigger nf:resolve"
    - "The installed copy at ~/.claude/commands/nf/solve.md matches the repo source"
  artifacts:
    - path: "commands/nf/solve.md"
      provides: "Phase 6 auto-resolve dispatch after convergence loop"
      contains: "Phase 6"
  key_links:
    - from: "commands/nf/solve.md"
      to: "commands/nf/resolve.md"
      via: "Agent tool dispatch in Phase 6"
      pattern: "nf:resolve"
---

<objective>
Add Phase 6 to solve.md that auto-invokes /nf:resolve after the convergence loop completes with non-zero residual. This eliminates the manual step of running /nf:resolve separately after every solve run.

Purpose: Streamline the solve-then-resolve workflow into a single command invocation.
Output: Updated solve.md with Phase 6, synced to installed location.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@commands/nf/solve.md
@commands/nf/resolve.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add Phase 6 auto-resolve dispatch to solve.md</name>
  <files>commands/nf/solve.md</files>
  <action>
Add a new "Phase 6: Auto-Resolve" section to commands/nf/solve.md, inserted AFTER Phase 5 (Auto-Commit Artifacts) and BEFORE the "Important Constraints" section.

Phase 6 logic:

1. Skip conditions — do NOT invoke resolve when ANY of these are true:
   - `--report-only` flag was passed (user only wanted a snapshot)
   - `--plan-only` flag was passed (user only wanted a plan)
   - `post_residual.total == 0` (nothing to resolve — solve converged fully)
   - `baseline_residual.total == 0` (zero residual from the start — bail path)

2. When none of the skip conditions apply (non-zero residual after remediation loop), dispatch resolve:

```
Agent(
  subagent_type="general-purpose",
  description="solve: auto-resolve remaining items",
  prompt="First resolve the sub-skill path: try $HOME/.claude/commands/nf/resolve.md, fall back to commands/nf/resolve.md if not found. Read and follow it end-to-end.
Auto-invoked after /nf:solve completed with {post_residual.total} residual remaining.
Flags: --source solve --limit 20
Process items conversationally as described in the resolve skill."
)
```

3. This dispatch is fail-open — if the Agent errors out, log the failure and continue. The solve report and auto-commit have already completed.

4. Log entry: `"Phase 6: Invoking /nf:resolve for {post_residual.total} remaining items..."` before dispatch, or `"Phase 6: Skipped — {reason}"` when skipping.

Also update the objective tag near the top of the file to mention the auto-resolve phase (Phase 6) in the description of what the orchestrator does.

Do NOT modify any other phases, the convergence loop logic, or the Important Constraints section content. Only ADD the new phase and update the objective text.
  </action>
  <verify>
Verify the file contains the Phase 6 section:
```bash
grep -c "Phase 6" commands/nf/solve.md
```
Should return at least 1.

Verify skip conditions are present:
```bash
grep "report-only" commands/nf/solve.md | grep -c "Phase 6\|auto-resolve\|skip"
```

Verify Agent dispatch references resolve.md:
```bash
grep "resolve.md" commands/nf/solve.md
```
  </verify>
  <done>solve.md contains Phase 6 that dispatches /nf:resolve via Agent tool when post_residual.total > 0, with skip conditions for report-only, plan-only, and zero-residual paths.</done>
</task>

<task type="auto">
  <name>Task 2: Sync installed copy of solve.md</name>
  <files>commands/nf/solve.md</files>
  <action>
Copy the updated solve.md to the installed location so the running system picks up the change immediately:

```bash
cp commands/nf/solve.md ~/.claude/commands/nf/solve.md
```

Per MEMORY.md install sync rules: edits to command files must be synced to their installed locations. The installer reads from repo source, so the repo copy (already updated in Task 1) is the durable copy. This task ensures the installed copy matches immediately without waiting for a full install.
  </action>
  <verify>
```bash
diff commands/nf/solve.md ~/.claude/commands/nf/solve.md
```
Should produce no output (files identical).
  </verify>
  <done>Installed copy at ~/.claude/commands/nf/solve.md is identical to repo source.</done>
</task>

</tasks>

<verification>
1. `grep "Phase 6" commands/nf/solve.md` returns match
2. `grep "resolve.md" commands/nf/solve.md` returns match in Phase 6 context
3. `diff commands/nf/solve.md ~/.claude/commands/nf/solve.md` returns empty (in sync)
4. Phase ordering is correct: Phase 5 (Auto-Commit) -> Phase 6 (Auto-Resolve) -> Important Constraints
</verification>

<success_criteria>
- solve.md has Phase 6 that invokes /nf:resolve when residual > 0
- Phase 6 is skipped for --report-only, --plan-only, and zero-residual cases
- Phase 6 is fail-open (errors logged, not fatal)
- Installed copy matches repo source
</success_criteria>

<output>
After completion, create `.planning/quick/355-auto-invoke-nf-resolve-after-solve-finis/355-SUMMARY.md`
</output>

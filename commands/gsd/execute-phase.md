---
name: gsd:execute-phase
description: Execute all plans in a phase with intelligent parallelization
argument-hint: "<phase-number>"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Task
  - TaskOutput
  - AskUserQuestion
---

<objective>
Execute all unexecuted plans in a phase with parallel agent spawning.

Analyzes plan dependencies to identify independent plans that can run concurrently.
Spawns background agents for parallel execution, orchestrates commits after completion.

Use this command when:
- Phase has 2+ unexecuted plans
- Want "walk away, come back to completed work" execution
- Plans have clear dependency boundaries
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md
@~/.claude/get-shit-done/workflows/execute-phase.md
@~/.claude/get-shit-done/templates/summary.md
@~/.claude/get-shit-done/references/checkpoints.md
</execution_context>

<context>
Phase number: $ARGUMENTS (required)

@.planning/STATE.md
@.planning/config.json
</context>

<process>
1. Validate phase exists in roadmap
2. Find all PLAN.md files without matching SUMMARY.md
3. If 0 or 1 plans: suggest /gsd:execute-plan instead
4. If 2+ plans: follow execute-phase.md workflow
5. Monitor parallel agents until completion
6. Present results and next steps
</process>

<success_criteria>
- [ ] All independent plans executed in parallel
- [ ] Dependent plans executed after dependencies complete
- [ ] All SUMMARY.md files created
- [ ] Commits created by orchestrator
- [ ] Phase progress updated
</success_criteria>

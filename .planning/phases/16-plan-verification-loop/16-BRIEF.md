# Phase 16: Plan Verification Loop

## Problem

Plans are created and executed without validation. The executor verifies task completion, but nothing verifies the plan will achieve the phase goal before execution begins.

Current flow:
```
plan-phase → creates PLAN.md → execute-plan → verifier checks if tasks completed
```

Gap: A plan can have all tasks complete but still fail the phase goal if the tasks were wrong.

## Solution

Add plan verification between planning and execution:

```
plan-phase (orchestrator)
  │
  ├── "Phase 3: Auth — launching planner..."
  │
  ├── Task(gsd-planner)
  │     └── WRITES PLAN.md files to disk
  │     └── Returns summary
  │
  ├── "Planner created 3 plans. Launching checker..."
  │
  ├── Task(gsd-plan-checker)
  │     └── READS PLAN.md files from disk
  │     └── Verifies plans will achieve phase goal
  │     └── Returns passed | issues
  │
  ├── IF issues:
  │    "Checker found issues:
  │     - 03-01 missing password hashing task
  │     - 03-03 has no verification for middleware
  │
  │     Sending back to planner..."
  │
  │    Task(gsd-planner, with checker feedback)
  │     └── READS existing PLAN.md files
  │     └── UPDATES based on feedback
  │     └── Returns what changed
  │
  │    Task(gsd-plan-checker) → re-verify
  │
  └── "Plans verified. Ready for execution."
```

## Key Design Decisions

### Files on disk as handoff mechanism

Each agent reads from and writes to disk. No context passing between agents.

- Checker sees exactly what executor will see
- Planner can make surgical updates
- Nothing lost between spawns
- Fresh perspective each time

### User sees the ping-pong

Orchestrator stays in main context. User sees:
- What phase is being planned
- What planner created
- What checker found
- What planner revised
- Final verification status

Not a black box.

### gsd-plan-checker responsibilities

Goal-backward verification of plan quality:

1. **Requirement coverage** — Every phase requirement has task(s) addressing it
2. **Task completeness** — Every task has Files + Action + Verify + Done
3. **Dependency correctness** — Nothing references future work
4. **Key links planned** — Not just artifacts, but wiring between them
5. **Scope sanity** — Plans within context budget (~50%)
6. **Verification derivation** — must_haves trace back to phase goal

### Loop termination

- Max 3 iterations (plan → check → revise → check → revise → check)
- If still failing after 3, present issues to user for decision
- User can: force proceed, provide guidance, abandon

## Deliverables

### 1. Create `agents/gsd-plan-checker.md`

New agent with plan verification expertise:
- Reads PLAN.md files from disk
- Checks against phase goal and requirements
- Returns structured issues or passed
- ~400-600 lines (similar scope to gsd-verifier)

### 2. Update `commands/gsd/plan-phase.md`

Remove `context: fork` — orchestrator stays in main context.

Add orchestration logic:
- Spawn gsd-planner (existing)
- Present results to user
- Spawn gsd-plan-checker
- If issues, present and spawn planner with feedback
- Loop until passed or max iterations
- Present final status

### 3. Update `agents/gsd-planner.md`

Add revision mode:
- Accept checker feedback in prompt
- Read existing PLAN.md files
- Make targeted updates (not full replan)
- Return what changed

## Architecture Alignment

Follows established patterns:
- `gsd-executor` creates code, `gsd-verifier` checks it
- `gsd-planner` creates plans, `gsd-plan-checker` checks them

Mirrors the verification philosophy:
- Goal-backward thinking
- must_haves as checkable criteria
- Structured gap reporting

## Success Criteria

- [ ] `gsd-plan-checker` agent created
- [ ] `plan-phase.md` orchestrates planner → checker loop
- [ ] User sees status between agent spawns
- [ ] Checker verifies plans against phase goal
- [ ] Planner can revise based on feedback
- [ ] Loop terminates (max 3 iterations or passed)
- [ ] Plans verified before execution available

---
name: gsd:plan-phase
description: Create detailed execution plan for a phase (PLAN.md) with verification loop
argument-hint: "[phase] [--gaps] [--skip-verify]"
agent: gsd-planner
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - Task
  - WebFetch
  - mcp__context7__*
---

<objective>
Create executable phase prompts (PLAN.md files) for a roadmap phase with optional verification loop.

**Orchestrator role:** Parse arguments, validate phase, gather context paths, spawn gsd-planner agent, verify plans with gsd-plan-checker, iterate until plans pass or max iterations reached, present results.

**Why subagent:** Planning burns context fast. Verification uses fresh context. User sees the ping-pong between planner and checker in main context.
</objective>

<context>
Phase number: $ARGUMENTS (optional - auto-detects next unplanned phase if not provided)
Gap closure mode: `--gaps` flag triggers gap closure workflow
Skip verification: `--skip-verify` flag bypasses planner → checker loop

Check for existing plans:

```bash
ls .planning/phases/${PHASE}-*/*-PLAN.md 2>/dev/null
```

</context>

<process>

## 1. Validate Environment

```bash
ls .planning/ 2>/dev/null
```

**If not found:** Error - user should run `/gsd:new-project` first.

## 2. Parse Arguments

Extract from $ARGUMENTS:

- Phase number (integer or decimal like `2.1`)
- `--gaps` flag for gap closure mode
- `--skip-verify` flag to bypass verification loop

**If no phase number:** Detect next unplanned phase from roadmap.

## 3. Validate Phase

```bash
grep -A5 "Phase ${PHASE}:" .planning/ROADMAP.md 2>/dev/null
```

**If not found:** Error with available phases. **If found:** Extract phase number, name, description.

## 4. Check Existing Plans

```bash
ls .planning/phases/${PHASE}-*/*-PLAN.md 2>/dev/null
```

**If exists:** Offer: 1) Continue planning, 2) View existing, 3) Replan. Wait for response.

## 5. Gather Context Paths

Identify context files for the agent:

```bash
# Required
STATE=.planning/STATE.md
ROADMAP=.planning/ROADMAP.md
REQUIREMENTS=.planning/REQUIREMENTS.md

# Optional
PHASE_DIR=$(ls -d .planning/phases/${PHASE}-* 2>/dev/null | head -1)
CONTEXT="${PHASE_DIR}/${PHASE}-CONTEXT.md"
RESEARCH="${PHASE_DIR}/${PHASE}-RESEARCH.md"
VERIFICATION="${PHASE_DIR}/${PHASE}-VERIFICATION.md"
UAT="${PHASE_DIR}/${PHASE}-UAT.md"
```

## 6. Spawn gsd-planner Agent

Display: `Phase {X}: {Name} — launching planner...`

Fill prompt and spawn:

```markdown
<planning_context>

**Phase:** {phase_number}
**Mode:** {standard | gap_closure}

**Project State:**
@.planning/STATE.md

**Roadmap:**
@.planning/ROADMAP.md

**Requirements (if exists):**
@.planning/REQUIREMENTS.md

**Phase Context (if exists):**
@.planning/phases/{phase_dir}/{phase}-CONTEXT.md

**Research (if exists):**
@.planning/phases/{phase_dir}/{phase}-RESEARCH.md

**Gap Closure (if --gaps mode):**
@.planning/phases/{phase_dir}/{phase}-VERIFICATION.md
@.planning/phases/{phase_dir}/{phase}-UAT.md

</planning_context>

<downstream_consumer>
Output consumed by /gsd:execute-phase or /gsd:execute-plan
Plans must be executable prompts with:

- Frontmatter (wave, depends_on, files_modified, autonomous)
- Tasks in XML format
- Verification criteria
- must_haves for goal-backward verification
</downstream_consumer>

<quality_gate>
Before returning PLANNING COMPLETE:

- [ ] PLAN.md files created in phase directory
- [ ] Each plan has valid frontmatter
- [ ] Tasks are specific and actionable
- [ ] Dependencies correctly identified
- [ ] Waves assigned for parallel execution
- [ ] must_haves derived from phase goal
</quality_gate>
```

```
Task(
  prompt=filled_prompt,
  subagent_type="gsd-planner",
  description="Plan Phase {phase}"
)
```

## 7. Handle Planner Return

Parse planner output:

**`## PLANNING COMPLETE`:**
- Display: `Planner created {N} plan(s). Files on disk.`
- If `--skip-verify`: Skip to step 11
- Otherwise: Proceed to step 8

**`## CHECKPOINT REACHED`:**
- Present to user, get response, spawn continuation (see step 10)

**`## PLANNING INCONCLUSIVE`:**
- Show what was attempted
- Offer: Add context, Retry, Manual
- Wait for user response

## 8. Spawn gsd-plan-checker Agent

Display: `Launching plan checker...`

Fill checker prompt and spawn:

```markdown
<verification_context>

**Phase:** {phase_number}
**Phase Goal:** {goal from ROADMAP}

**Plans to verify:**
@.planning/phases/{phase_dir}/*-PLAN.md

**Requirements (if exists):**
@.planning/REQUIREMENTS.md

</verification_context>

<expected_output>
Return one of:
- ## VERIFICATION PASSED — all checks pass
- ## ISSUES FOUND — structured issue list
</expected_output>
```

```
Task(
  prompt=checker_prompt,
  subagent_type="gsd-plan-checker",
  description="Verify Phase {phase} plans"
)
```

## 9. Handle Checker Return

**If `## VERIFICATION PASSED`:**
- Display: `Plans verified. Ready for execution.`
- Proceed to step 11

**If `## ISSUES FOUND`:**
- Display: `Checker found issues:`
- List issues from checker output
- Check iteration count
- Proceed to step 10

## 10. Revision Loop (Max 3 Iterations)

Track: `iteration_count` (starts at 1 after initial plan + check)

**If iteration_count < 3:**

Display: `Sending back to planner for revision... (iteration {N}/3)`

Spawn gsd-planner with revision prompt:

```markdown
<revision_context>

**Phase:** {phase_number}
**Mode:** revision

**Existing plans:**
@.planning/phases/{phase_dir}/*-PLAN.md

**Checker issues:**
{structured_issues_from_checker}

</revision_context>

<instructions>
Read existing PLAN.md files. Make targeted updates to address checker issues.
Do NOT replan from scratch unless issues are fundamental.
Return what changed.
</instructions>
```

```
Task(
  prompt=revision_prompt,
  subagent_type="gsd-planner",
  description="Revise Phase {phase} plans"
)
```

- After planner returns → spawn checker again (step 8)
- Increment iteration_count

**If iteration_count >= 3:**

Display: `Max iterations reached. {N} issues remain:`
- List remaining issues

Offer options:
1. Force proceed (execute despite issues)
2. Provide guidance (user gives direction, retry)
3. Abandon (exit planning)

Wait for user response.

## 11. Present Final Status

```markdown
Phase {X} planned: {N} plan(s) in {M} wave(s)

## Wave Structure
Wave 1 (parallel): {plan-01}, {plan-02}
Wave 2: {plan-03}

## Verification
{Passed | Passed with user override | Skipped (--skip-verify)}

---

## Next Up

**Phase {X}: [Phase Name]** - {N} plan(s)

`/gsd:execute-phase {X}`

<sub>`/clear` first - fresh context window</sub>

---
```

</process>

<success_criteria>

- [ ] .planning/ directory validated
- [ ] Phase validated against roadmap
- [ ] Existing plans checked
- [ ] gsd-planner spawned with context
- [ ] Checkpoints handled correctly
- [ ] User knows next steps (execute or review)
      </success_criteria>

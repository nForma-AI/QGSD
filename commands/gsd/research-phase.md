---
name: gsd:research-phase
description: Research how to implement a phase before planning
argument-hint: "[phase]"
allowed-tools:
  - Read
  - Bash
  - Task
---

<objective>
Research how to implement a phase. Spawns gsd-researcher agent with phase context.

**Orchestrator role:** Parse phase, validate against roadmap, check existing research, gather context, spawn researcher agent, present results.

**Why subagent:** Research burns context fast (WebSearch, Context7 queries, source verification). Fresh 200k context for investigation. Main context stays lean for user interaction.
</objective>

<context>
Phase number: $ARGUMENTS (required)

Check for existing research:
```bash
ls .planning/phases/${PHASE}-*/*RESEARCH.md 2>/dev/null
```
</context>

<process>

## 1. Parse and Validate Phase

```bash
grep -A5 "Phase ${PHASE}:" .planning/ROADMAP.md 2>/dev/null
```

**If not found:** Error and exit. **If found:** Extract phase number, name, description.

## 2. Check Existing Research

```bash
ls .planning/phases/${PHASE}-*/RESEARCH.md 2>/dev/null
```

**If exists:** Offer: 1) Update research, 2) View existing, 3) Skip. Wait for response.

**If doesn't exist:** Continue.

## 3. Gather Phase Context

```bash
grep -A20 "Phase ${PHASE}:" .planning/ROADMAP.md
cat .planning/REQUIREMENTS.md 2>/dev/null
cat .planning/phases/${PHASE}-*/${PHASE}-CONTEXT.md 2>/dev/null
grep -A30 "### Decisions Made" .planning/STATE.md 2>/dev/null
```

Present summary with phase description, requirements, prior decisions.

## 4. Spawn gsd-researcher Agent

Research modes: ecosystem (default), feasibility, implementation, comparison.

```markdown
<objective>
Research implementation approach for Phase {phase_number}: {phase_name}
Mode: ecosystem
</objective>

<context>
**Phase description:** {phase_description}
**Requirements:** {requirements_list}
**Prior decisions:** {decisions_if_any}
**Phase context:** {context_md_content}
</context>

<output>
Write to: .planning/phases/{phase}-{slug}/{phase}-RESEARCH.md
</output>
```

```
Task(
  prompt=filled_prompt,
  subagent_type="gsd-researcher",
  description="Research Phase {phase}"
)
```

## 5. Handle Agent Return

**`## RESEARCH COMPLETE`:** Display summary, offer: Plan phase, Dig deeper, Review full, Done.

**`## CHECKPOINT REACHED`:** Present to user, get response, spawn continuation.

**`## RESEARCH INCONCLUSIVE`:** Show what was attempted, offer: Add context, Try different mode, Manual.

## 6. Spawn Continuation Agent

```markdown
<objective>
Continue research for Phase {phase_number}: {phase_name}
</objective>

<prior_state>
Research file: @.planning/phases/{phase}-{slug}/{phase}-RESEARCH.md
</prior_state>

<checkpoint_response>
**Type:** {checkpoint_type}
**Response:** {user_response}
</checkpoint_response>
```

```
Task(
  prompt=continuation_prompt,
  subagent_type="gsd-researcher",
  description="Continue research Phase {phase}"
)
```

</process>

<success_criteria>
- [ ] Phase validated against roadmap
- [ ] Existing research checked
- [ ] gsd-researcher spawned with context
- [ ] Checkpoints handled correctly
- [ ] User knows next steps
</success_criteria>

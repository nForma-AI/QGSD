---
name: gsd:audit-milestone
description: Audit milestone completion against original intent before archiving
argument-hint: "[version]"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Task
  - Write
---

<objective>
Verify milestone achieved its definition of done. Check requirements coverage, cross-phase integration, and end-to-end flows.

**This command IS the orchestrator.** Spawns verification agents in parallel, collects results, aggregates into MILESTONE-AUDIT.md.
</objective>

<execution_context>
@~/.claude/get-shit-done/references/principles.md
</execution_context>

<context>
Version: $ARGUMENTS (optional — defaults to current milestone)

**Original Intent:**
@.planning/PROJECT.md
@.planning/REQUIREMENTS.md

**Planned Work:**
@.planning/ROADMAP.md
@.planning/config.json (if exists)

**Completed Work:**
Glob: .planning/phases/*/*-SUMMARY.md
Glob: .planning/phases/*/*-VERIFICATION.md
</context>

<process>

## 1. Determine Milestone Scope

```bash
# Get phases in milestone
ls -d .planning/phases/*/ | sort -V
```

- Parse version from arguments or detect current from ROADMAP.md
- Identify all phase directories in scope
- Extract milestone definition of done from ROADMAP.md
- Extract requirements mapped to this milestone from REQUIREMENTS.md

## 2. Spawn Phase Verifiers (Wave 1 - Parallel)

**Spawn gsd-verifier for each phase in a single message:**

```
Task(prompt="Verify phase 1: {goal}\n\nPhase dir: {dir}\nRequirements: {reqs}", subagent_type="gsd-verifier")
Task(prompt="Verify phase 2: {goal}\n\nPhase dir: {dir}\nRequirements: {reqs}", subagent_type="gsd-verifier")
Task(prompt="Verify phase 3: {goal}\n\nPhase dir: {dir}\nRequirements: {reqs}", subagent_type="gsd-verifier")
```

All run in parallel. Wait for all to complete.

## 3. Spawn Integration Checker (Wave 2)

After phase verifications complete:

```
Task(
  prompt="Check cross-phase integration and E2E flows.

Phases: {phase_dirs}
Phase exports: {from SUMMARYs}
API routes: {routes created}

Verify cross-phase wiring and E2E user flows.",
  subagent_type="gsd-integration-checker"
)
```

## 4. Collect Results

Read outputs from all agents:
- Each phase's VERIFICATION.md (status, gaps)
- Integration checker's report (wiring gaps, broken flows)

## 5. Check Requirements Coverage

For each requirement in REQUIREMENTS.md mapped to this milestone:
- Find owning phase
- Check phase verification status
- Determine: satisfied | partial | unsatisfied

## 6. Aggregate into MILESTONE-AUDIT.md

Create `.planning/MILESTONE-AUDIT.md` with:

```yaml
---
milestone: {version}
audited: {timestamp}
status: passed | gaps_found
scores:
  requirements: N/M
  phases: N/M
  integration: N/M
  flows: N/M
gaps:  # Only if gaps_found
  requirements: [...]
  integration: [...]
  flows: [...]
---
```

Plus full markdown report with tables for requirements, phases, integration, flows.

## 7. Present Results

Route by status (see `<offer_next>`).

</process>

<offer_next>
**If passed:**

```markdown
## ✓ Milestone {version} — Audit Passed

**Score:** {N}/{M} requirements satisfied
**Report:** .planning/MILESTONE-AUDIT.md

All requirements covered. Cross-phase integration verified. E2E flows complete.

---

## ▶ Next Up

**Complete milestone** — archive and tag

`/gsd:complete-milestone {version}`

<sub>`/clear` first → fresh context window</sub>
```

---

**If gaps_found:**

```markdown
## ⚠ Milestone {version} — Gaps Found

**Score:** {N}/{M} requirements satisfied
**Report:** .planning/MILESTONE-AUDIT.md

### Unsatisfied Requirements

{For each unsatisfied requirement:}
- **{REQ-ID}: {description}** (Phase {X})
  - {reason}

### Cross-Phase Issues

{For each integration gap:}
- **{from} → {to}:** {issue}

### Broken Flows

{For each flow gap:}
- **{flow name}:** breaks at {step}

---

## ▶ Next Up

**Plan gap closure** — create phases to complete milestone

`/gsd:plan-milestone-gaps`

<sub>`/clear` first → fresh context window</sub>

---

**Also available:**
- `cat .planning/MILESTONE-AUDIT.md` — see full report
- `/gsd:complete-milestone {version}` — proceed anyway (accept tech debt)
```
</offer_next>

<success_criteria>
- [ ] Milestone scope identified
- [ ] gsd-milestone-auditor spawned with full context
- [ ] MILESTONE-AUDIT.md created
- [ ] Results presented with actionable next steps
</success_criteria>

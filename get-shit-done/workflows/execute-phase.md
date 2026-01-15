<purpose>
Execute all plans in a phase using wave-based parallel execution. Orchestrator stays lean by delegating plan execution to subagents.
</purpose>

<core_principle>
The orchestrator's job is coordination, not execution. Orchestrator discovers plans, groups into waves, spawns `gsd-executor` agents, handles checkpoints, collects results.

**Subagent:** `gsd-executor` — dedicated plan execution agent with all execution logic baked in.
</core_principle>

<required_reading>
Read STATE.md before any operation to load project context.
</required_reading>

<process>

<step name="load_project_state" priority="first">
Before any operation, read project state:

```bash
cat .planning/STATE.md 2>/dev/null
```

**If file exists:** Parse and internalize:
- Current position (phase, plan, status)
- Accumulated decisions (constraints on this execution)
- Blockers/concerns (things to watch for)

**If file missing but .planning/ exists:**
```
STATE.md missing but planning artifacts exist.
Options:
1. Reconstruct from existing artifacts
2. Continue without project state (may lose accumulated context)
```

**If .planning/ doesn't exist:** Error - project not initialized.
</step>

<step name="validate_phase">
Confirm phase exists and has plans:

```bash
PHASE_DIR=$(ls -d .planning/phases/${PHASE_ARG}* 2>/dev/null | head -1)
if [ -z "$PHASE_DIR" ]; then
  echo "ERROR: No phase directory matching '${PHASE_ARG}'"
  exit 1
fi

PLAN_COUNT=$(ls -1 "$PHASE_DIR"/*-PLAN.md 2>/dev/null | wc -l | tr -d ' ')
if [ "$PLAN_COUNT" -eq 0 ]; then
  echo "ERROR: No plans found in $PHASE_DIR"
  exit 1
fi
```

Report: "Found {N} plans in {phase_dir}"
</step>

<step name="discover_plans">
List all plans and extract metadata:

```bash
# Get all plans
ls -1 "$PHASE_DIR"/*-PLAN.md 2>/dev/null | sort

# Get completed plans (have SUMMARY.md)
ls -1 "$PHASE_DIR"/*-SUMMARY.md 2>/dev/null | sort
```

For each plan, read frontmatter to extract:
- `wave: N` - Execution wave (pre-computed)
- `autonomous: true/false` - Whether plan has checkpoints

Build plan inventory:
- Plan path
- Plan ID (e.g., "03-01")
- Wave number
- Autonomous flag
- Completion status (SUMMARY exists = complete)

Skip completed plans. If all complete, report "Phase already executed" and exit.
</step>

<step name="group_by_wave">
Read `wave` from each plan's frontmatter and group by wave number:

```bash
# For each plan, extract wave from frontmatter
for plan in $PHASE_DIR/*-PLAN.md; do
  wave=$(grep "^wave:" "$plan" | cut -d: -f2 | tr -d ' ')
  autonomous=$(grep "^autonomous:" "$plan" | cut -d: -f2 | tr -d ' ')
  echo "$plan:$wave:$autonomous"
done
```

**Group plans:**
```
waves = {
  1: [plan-01, plan-02],
  2: [plan-03, plan-04],
  3: [plan-05]
}
```

**No dependency analysis needed.** Wave numbers are pre-computed during `/gsd:plan-phase`.

Report wave structure with context:
```
## Execution Plan

**Phase {X}: {Name}** — {total_plans} plans across {wave_count} waves

| Wave | Plans | What it builds |
|------|-------|----------------|
| 1 | 01-01, 01-02 | {from plan objectives} |
| 2 | 01-03 | {from plan objectives} |
| 3 | 01-04 [checkpoint] | {from plan objectives} |

```

The "What it builds" column comes from skimming plan names/objectives. Keep it brief (3-8 words).
</step>

<step name="execute_waves">
Execute each wave in sequence. Autonomous plans within a wave run in parallel.

**For each wave:**

1. **Describe what's being built (BEFORE spawning):**

   Read each plan's `<objective>` section. Extract what's being built and why it matters.

   **Output:**
   ```
   ---

   ## Wave {N}

   **{Plan ID}: {Plan Name}**
   {2-3 sentences: what this builds, key technical approach, why it matters in context}

   **{Plan ID}: {Plan Name}** (if parallel)
   {same format}

   Spawning {count} agent(s)...

   ---
   ```

   **Examples:**
   - Bad: "Executing terrain generation plan"
   - Good: "Procedural terrain generator using Perlin noise — creates height maps, biome zones, and collision meshes. Required before vehicle physics can interact with ground."

2. **Spawn all agents in wave simultaneously using gsd-executor:**

   Use Task tool with multiple parallel calls. Each agent is `gsd-executor` with minimal prompt:

   ```
   Task(
     prompt="Execute plan at {plan_path}

Plan: @{plan_path}
Project state: @.planning/STATE.md
Config: @.planning/config.json (if exists)",
     subagent_type="gsd-executor",
     description="Execute {phase}-{plan}"
   )
   ```

   The `gsd-executor` subagent has all execution logic baked in:
   - Deviation rules
   - Checkpoint protocols
   - Commit formatting
   - Summary creation
   - State updates

   No template filling needed. Just pass the plan path.

   Task tool blocks until each agent finishes. All parallel agents return together.

4. **Report completion and what was built:**

   For each completed agent:
   - Verify SUMMARY.md exists at expected path
   - Read SUMMARY.md to extract what was built
   - Note any issues or deviations

   **Output:**
   ```
   ---

   ## Wave {N} Complete

   **{Plan ID}: {Plan Name}**
   {What was built — from SUMMARY.md deliverables}
   {Notable deviations or discoveries, if any}

   **{Plan ID}: {Plan Name}** (if parallel)
   {same format}

   {If more waves: brief note on what this enables for next wave}

   ---
   ```

   **Examples:**
   - Bad: "Wave 2 complete. Proceeding to Wave 3."
   - Good: "Terrain system complete — 3 biome types, height-based texturing, physics collision meshes. Vehicle physics (Wave 3) can now reference ground surfaces."

5. **Handle failures:**

   If any agent in wave fails:
   - Report which plan failed and why
   - Ask user: "Continue with remaining waves?" or "Stop execution?"
   - If continue: proceed to next wave (dependent plans may also fail)
   - If stop: exit with partial completion report

6. **Execute checkpoint plans between waves:**

   See `<checkpoint_handling>` for details.

7. **Proceed to next wave**

</step>

<step name="checkpoint_handling">
Plans with `autonomous: false` require user interaction.

**Detection:** Check `autonomous` field in frontmatter.

**Execution flow for checkpoint plans:**

1. **Spawn gsd-executor for checkpoint plan:**
   ```
   Task(
     prompt="Execute plan at {plan_path}

Plan: @{plan_path}
Project state: @.planning/STATE.md",
     subagent_type="gsd-executor",
     description="Execute {phase}-{plan}"
   )
   ```

2. **Agent runs until checkpoint:**
   - Executes auto tasks normally
   - Reaches checkpoint task or auth gate
   - Agent returns with structured checkpoint (format baked into gsd-executor)

3. **Agent return includes (structured format):**
   - Completed Tasks table with commit hashes and files
   - Current task name and blocker
   - Checkpoint type and details for user
   - What's awaited from user

4. **Orchestrator presents checkpoint to user:**

   Extract and display the "Checkpoint Details" and "Awaiting" sections from agent return:
   ```
   ## Checkpoint: [Type]

   **Plan:** 03-03 Dashboard Layout
   **Progress:** 2/3 tasks complete

   [Checkpoint Details section from agent return]

   [Awaiting section from agent return]
   ```

5. **User responds:**
   - "approved" / "done" → spawn continuation agent
   - Description of issues → spawn continuation agent with feedback
   - Decision selection → spawn continuation agent with choice

6. **Spawn continuation agent (NOT resume):**

   Spawn fresh `gsd-executor` with continuation context:
   ```
   Task(
     prompt="Continue executing plan at {plan_path}

<completed_tasks>
{completed_tasks_table from checkpoint return}
</completed_tasks>

<resume_point>
Resume from: Task {N} - {task_name}
User response: {user_response}
{resume_instructions based on checkpoint type}
</resume_point>

Plan: @{plan_path}
Project state: @.planning/STATE.md",
     subagent_type="gsd-executor",
     description="Continue {phase}-{plan}"
   )
   ```

   The `gsd-executor` has continuation handling baked in — it will verify previous commits and resume correctly.

7. **Continuation agent executes:**
   - Verifies previous commits exist
   - Continues from resume point
   - May hit another checkpoint (repeat from step 4)
   - Or completes plan

8. **Repeat until plan completes or user stops**

**Why fresh agent instead of resume:**
Resume relies on Claude Code's internal serialization which breaks with parallel tool calls.
Fresh agents with explicit state are more reliable and maintain full context.

**Checkpoint in parallel context:**
If a plan in a parallel wave has a checkpoint:
- Spawn as normal
- Agent pauses at checkpoint and returns with structured state
- Other parallel agents may complete while waiting
- Present checkpoint to user
- Spawn continuation agent with user response
- Wait for all agents to finish before next wave
</step>

<step name="aggregate_results">
After all waves complete, aggregate results:

```markdown
## Phase {X}: {Name} Execution Complete

**Waves executed:** {N}
**Plans completed:** {M} of {total}

### Wave Summary

| Wave | Plans | Status |
|------|-------|--------|
| 1 | plan-01, plan-02 | ✓ Complete |
| CP | plan-03 | ✓ Verified |
| 2 | plan-04 | ✓ Complete |
| 3 | plan-05 | ✓ Complete |

### Plan Details

1. **03-01**: [one-liner from SUMMARY.md]
2. **03-02**: [one-liner from SUMMARY.md]
...

### Issues Encountered
[Aggregate from all SUMMARYs, or "None"]
```
</step>

<step name="verify_phase_goal">
**Verify the phase GOAL was achieved, not just that tasks completed.**

This step catches the common failure: tasks done but goal not met (stubs, placeholders, unwired code).

**1. Spawn gsd-verifier subagent:**

```
Task(
  prompt="Verify phase {phase_number} goal achievement

Phase: {phase_number} - {phase_name}
Phase goal: {phase_goal_from_roadmap}
Phase directory: @.planning/phases/{phase_dir}/

Project context:
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md (if exists)",
  subagent_type="gsd-verifier",
  description="Verify phase {phase_number}"
)
```

The `gsd-verifier` subagent has all verification logic baked in:
- Establishes must-haves (from frontmatter or derived)
- Verifies observable truths against codebase
- Checks artifacts exist and are substantive (not stubs)
- Traces key links (wiring between components)
- Scans for anti-patterns
- Creates VERIFICATION.md report
- Returns status to orchestrator

**2. Verification subagent returns** with status and report path.

**3. Handle verification result:**

**If status = "passed":**
```
## ✓ Phase Verification Passed

All {N} must-haves verified:
- {truth 1} ✓
- {truth 2} ✓
- {truth 3} ✓

Phase goal achieved. Proceeding to update roadmap.
```

Continue to update_roadmap step.

**If status = "gaps_found":**
```
## ⚠️ Phase Verification Found Gaps

{M} of {N} must-haves incomplete:

| Must-Have | Status | Issue |
|-----------|--------|-------|
| {truth 1} | ✓ VERIFIED | - |
| {truth 2} | ✗ FAILED | API route returns placeholder |
| {truth 3} | ✗ FAILED | Component not wired to API |

### Recommended Fix Plans

1. **{phase}-{next}-PLAN.md**: {description}
2. **{phase}-{next+1}-PLAN.md**: {description}

Creating fix plans and executing...
```

Then:
1. Generate fix PLAN.md files from recommendations
2. Execute fix plans (loop back to execute_waves)
3. Re-verify (loop back to verify_phase_goal)
4. Repeat until all must-haves pass

**If status = "human_needed":**
```
## 👤 Human Verification Required

Automated checks passed. These items need manual testing:

### 1. {Test Name}
**Test:** {what to do}
**Expected:** {what should happen}

### 2. {Test Name}
**Test:** {what to do}
**Expected:** {what should happen}

After testing, type "verified" or describe issues found.
```

Wait for user response:
- "verified" / "pass" / "ok" → Continue to update_roadmap
- Description of issues → Generate fix plans, execute, re-verify

**4. Fix plan generation:**

When gaps are found, generate fix plans:

```bash
# Create fix plan from verification recommendations
NEXT_PLAN_NUM=$(ls "$PHASE_DIR"/*-PLAN.md | wc -l)
NEXT_PLAN_NUM=$((NEXT_PLAN_NUM + 1))
```

Fix plans:
- Use standard PLAN.md template
- Include must_haves (same as original, for re-verification)
- Tasks target specific gaps (not entire feature)
- Wave 99 (runs after all original plans)

**5. Re-verification loop:**

After fix plans execute:
1. Spawn verification subagent again
2. Check same must-haves
3. If still gaps → more fix plans
4. If passed → continue

Limit: 3 fix cycles. If still failing after 3 rounds, present to user:
```
## ⚠️ Verification Still Failing After 3 Fix Attempts

Remaining gaps:
- {gap 1}
- {gap 2}

Options:
1. Continue anyway (manual fixes later)
2. Stop and investigate
```

**Why this matters:**

Without verification:
- Phase 3 "complete" but chat doesn't work
- Phase 4 builds on broken foundation
- Phase 8: "nothing works, start over"

With verification:
- Phase 3 verified before moving on
- Gaps caught and fixed immediately
- Each phase delivers real value
</step>

<step name="update_roadmap">
Update ROADMAP.md to reflect phase completion:

```bash
# Mark phase complete
# Update completion date
# Update status
```

Commit roadmap update:
```bash
git add .planning/ROADMAP.md
git commit -m "docs(phase-{X}): complete phase execution"
```
</step>

<step name="offer_next">
Present next steps based on milestone status:

**If more phases remain:**
```
## Next Up

**Phase {X+1}: {Name}** — {Goal}

`/gsd:plan-phase {X+1}`

<sub>`/clear` first for fresh context</sub>
```

**If milestone complete:**
```
MILESTONE COMPLETE!

All {N} phases executed.

`/gsd:complete-milestone`
```
</step>

</process>

<context_efficiency>
**Why this works:**

Orchestrator context usage: ~10-15%
- Read plan frontmatter (small)
- Group by wave (logic, no heavy reads)
- Spawn Task calls with minimal prompts
- Collect results

Each `gsd-executor` subagent: Fresh 200k context
- Execution logic baked into subagent prompt (cached)
- Only plan-specific context varies
- Executes plan with full capacity
- Creates SUMMARY, commits

**Prompt caching benefit:** The `gsd-executor` subagent prompt is stable across all invocations. Only the plan path varies. 90% cost reduction on cached portion.

**No polling.** Task tool blocks until completion. No TaskOutput loops.

**No context bleed.** Orchestrator never reads execution internals. Just paths and results.
</context_efficiency>

<failure_handling>
**Subagent fails mid-plan:**
- SUMMARY.md won't exist
- Orchestrator detects missing SUMMARY
- Reports failure, asks user how to proceed

**Dependency chain breaks:**
- Wave 1 plan fails
- Wave 2 plans depending on it will likely fail
- Orchestrator can still attempt them (user choice)
- Or skip dependent plans entirely

**All agents in wave fail:**
- Something systemic (git issues, permissions, etc.)
- Stop execution
- Report for manual investigation

**Checkpoint fails to resolve:**
- User can't approve or provides repeated issues
- Ask: "Skip this plan?" or "Abort phase execution?"
- Record partial progress in STATE.md
</failure_handling>

<resumption>
**Resuming interrupted execution:**

If phase execution was interrupted (context limit, user exit, error):

1. Run `/gsd:execute-phase {phase}` again
2. discover_plans finds completed SUMMARYs
3. Skips completed plans
4. Resumes from first incomplete plan
5. Continues wave-based execution

**STATE.md tracks:**
- Last completed plan
- Current wave
- Any pending checkpoints
</resumption>

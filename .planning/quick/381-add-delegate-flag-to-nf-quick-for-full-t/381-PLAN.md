---
phase: quick-381
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - core/workflows/quick.md
  - ~/.claude/nf/workflows/quick.md
autonomous: true
requirements: [INTENT-01]
formal_artifacts: none

must_haves:
  truths:
    - "User can pass --delegate {slot-name} to /nf:quick and the task is dispatched to the named external agent CLI"
    - "Step 2.7 scope contract still runs for delegate mode (local tracking preserved)"
    - "Steps 5-6 local planning/execution are skipped when --delegate is active"
    - "Delegate result (status, filesModified, summary) is recorded in STATE.md"
    - "Invalid or unavailable slot names produce a clear error message"
  artifacts:
    - path: "core/workflows/quick.md"
      provides: "Updated workflow with --delegate flag parsing and Mode C dispatch branch"
      contains: "--delegate"
    - path: "~/.claude/nf/workflows/quick.md"
      provides: "Installed copy synced from repo source"
      contains: "--delegate"
  key_links:
    - from: "core/workflows/quick.md"
      to: "bin/coding-task-router.cjs"
      via: "Mode C dispatch using routeCodingTask API"
      pattern: "coding-task-router"
    - from: "core/workflows/quick.md"
      to: "bin/providers.json"
      via: "Slot name validation against providers array"
      pattern: "providers.json"
---

<objective>
Add a `--delegate {slot-name}` flag to the `/nf:quick` workflow that bypasses local planning and execution, instead dispatching the entire task to a named external agent CLI slot via Mode C (coding-task-router.cjs).

Purpose: Enable full task delegation to external agent CLIs (e.g., Codex) that have nForma installed and can run `/nf:quick --full` themselves. The orchestrator's role becomes: dispatch, track, record.

Output: Updated `core/workflows/quick.md` with delegate branch, synced to installed copy.
</objective>

<execution_context>
@./.claude/nf/workflows/execute-plan.md
@./.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@core/workflows/quick.md
@bin/coding-task-router.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add --delegate flag parsing and Mode C dispatch branch to quick.md</name>
  <files>core/workflows/quick.md</files>
  <action>
Modify `core/workflows/quick.md` to add the `--delegate {slot-name}` flag. The changes span three areas of the workflow:

**1. Step 1 — Parse --delegate flag:**

In the argument parsing section (Step 1), add:
- `--delegate {slot-name}` flag -> store as `$DELEGATE_SLOT` (string or null). The value is the next token after `--delegate`.
- If `--delegate` is present without a value, error: "Error: --delegate requires a slot name (e.g., --delegate codex-1)"
- `--delegate` is mutually exclusive with `--full`. If both are passed, error: "Error: --delegate and --full cannot be used together. --delegate performs full delegation to the external agent."

Add to the display banner section a delegate-specific banner:
```
If `$DELEGATE_SLOT`:

  nForma > QUICK TASK (DELEGATE MODE)

  Delegating to: ${DELEGATE_SLOT}
```

**2. Step 2.8 (NEW) — Validate delegate slot:**

Insert a new step between Step 2.7 and Step 3. This step only runs when `$DELEGATE_SLOT` is set.

- Read `bin/providers.json`, parse the `providers` array
- Find the entry where `name === $DELEGATE_SLOT`
- If not found: error with list of valid subprocess slot names: "Error: Unknown slot '${DELEGATE_SLOT}'. Available slots: codex-1, gemini-1, ..."
- If found but `type !== 'subprocess'` or `has_file_access !== true`: error: "Error: Slot '${DELEGATE_SLOT}' is not a file-access subprocess provider. Delegation requires a full CLI agent."
- Store the validated slot as `$VALIDATED_DELEGATE_SLOT`

**3. Step 5-6 delegate branch — Replace local planning/execution with Mode C dispatch:**

After Step 4.5 (formal scope scan), add a conditional branch:

```
**If `$DELEGATE_SLOT` is set:** Skip Steps 5, 5.5, 5.7, 5.8, 6, 6.3, 6.5, 6.7. Instead:
```

**Step 5D: Dispatch to external agent via Mode C**

Display:
```
  nForma > DELEGATING TO ${DELEGATE_SLOT}

  Task: ${DESCRIPTION}
  Repo: ${absolute path to project root}
  Timeout: 300000ms
```

Build the delegation prompt using coding-task-router.cjs's `buildCodingPrompt` format. The task description should include:
- The original `$DESCRIPTION`
- The derived approach from `$APPROACH_BLOCK.approach`
- Instruction: "You are a full Claude Code instance with nForma installed. Execute this task completely: implement, test, and commit. Return your result in the structured format."

Dispatch via CLI:
```bash
DELEGATE_RESULT=$(node bin/coding-task-router.cjs \
  --slot "${DELEGATE_SLOT}" \
  --task "${DESCRIPTION}. Approach: ${APPROACH_BLOCK.approach}" \
  --cwd "$(pwd)" \
  --timeout 300000 2>&1)
DELEGATE_EXIT=$?
```

Parse the JSON result. Extract: `status`, `filesModified`, `summary`, `latencyMs`.

**Route on status:**

| Status | Action |
|--------|--------|
| SUCCESS | Display success banner, proceed to recording |
| PARTIAL | Display partial banner with summary, proceed to recording |
| FAILED | Display failure with summary, proceed to recording (do NOT retry) |
| UNAVAIL | Display error: "Slot ${DELEGATE_SLOT} is unavailable: ${summary}". Proceed to recording |

**Step 6D: Record delegate result**

- Create `${QUICK_DIR}/${next_num}-SUMMARY.md` with delegate-specific template:
  ```markdown
  # Quick Task ${next_num} Summary (Delegated)

  ## Task
  ${DESCRIPTION}

  ## Delegation
  - Slot: ${DELEGATE_SLOT}
  - Status: ${status}
  - Latency: ${latencyMs}ms
  - Files modified: ${filesModified.join(', ') || 'none reported'}

  ## Result
  ${summary}
  ```

- Update STATE.md "Quick Tasks Completed" table with status mapped from delegate result:
  - SUCCESS -> "Delegated (OK)"
  - PARTIAL -> "Delegated (Partial)"
  - FAILED -> "Delegated (Failed)"
  - UNAVAIL -> "Delegated (Unavail)"

- Commit PLAN.md + SUMMARY.md + STATE.md atomically:
  ```bash
  node ~/.claude/nf/bin/gsd-tools.cjs commit "docs(quick-${next_num}): delegate ${DESCRIPTION}" \
    --files ${QUICK_DIR}/${next_num}-PLAN.md ${QUICK_DIR}/${next_num}-SUMMARY.md .planning/STATE.md
  ```

- Display completion banner:
  ```
  nForma > QUICK TASK COMPLETE (DELEGATED)

  Quick Task ${next_num}: ${DESCRIPTION}
  Delegated to: ${DELEGATE_SLOT}
  Status: ${status}
  Latency: ${latencyMs}ms
  Summary: ${QUICK_DIR}/${next_num}-SUMMARY.md
  Commit: ${commit_hash}
  Branch: ${CREATED_BRANCH || current_branch}
  ```

- Run: `node ~/.claude/nf/bin/gsd-tools.cjs activity-clear`

**Important implementation notes:**
- Steps 2 (init), 2.5 (branching), 2.7 (scope contract), 3 (task dir), 4 (quick dir) all still run for delegate mode. This ensures local tracking is preserved.
- Step 4.5 (formal scope scan) is skipped for delegate mode (the external agent handles its own formal checks).
- Step 5.7 (quorum review of plan) is skipped because there is no local plan to review -- the external agent does its own planning.
- The delegate branch rejoins after Step 6 for any shared cleanup, but since quick.md has no shared post-Step-6 cleanup, the delegate branch terminates with the completion banner.

**Invariant compliance:**
- EventualConsensus (quorum): Not violated -- quorum is skipped because there is no local plan artifact to review. The delegate is a full agent that runs its own quorum if needed.
- RouteCLiveness (planningstate): Not affected -- delegate mode creates STATE.md entries just like normal mode.
- No direct MCP calls are made -- delegation goes through coding-task-router.cjs which uses call-quorum-slot.cjs subprocess dispatch (R3.2 compliant).

Also update the `success_criteria` section at the bottom of quick.md to add:
```
- [ ] `--delegate` flag parsed from arguments when present
- [ ] `--delegate` and `--full` are mutually exclusive
- [ ] Delegate slot validated against providers.json (subprocess + has_file_access)
- [ ] Mode C dispatch via coding-task-router.cjs for delegate tasks
- [ ] Delegate result recorded in SUMMARY.md and STATE.md
- [ ] Steps 5-6 skipped for delegate mode (no local plan, no local execution)
```
  </action>
  <verify>
Read `core/workflows/quick.md` and confirm:
1. Step 1 parses `--delegate {slot-name}` with mutual exclusivity check against `--full`
2. Step 2.8 validates slot against providers.json
3. Delegate branch (Steps 5D/6D) dispatches via coding-task-router.cjs CLI
4. Result recording creates SUMMARY.md and updates STATE.md
5. Success criteria section includes delegate items
6. `grep -c 'delegate' core/workflows/quick.md` returns 15+ matches (flag present throughout)
  </verify>
  <done>
quick.md contains complete --delegate flag support: parsing, validation, Mode C dispatch via coding-task-router.cjs, result recording, and completion banner. Steps 2-2.7 preserved for local tracking. Steps 5-6 bypassed with delegate-specific 5D/6D.
  </done>
</task>

<task type="auto">
  <name>Task 2: Sync workflow to installed location and verify</name>
  <files>~/.claude/nf/workflows/quick.md</files>
  <action>
Copy the updated workflow from repo source to the installed location per project install sync rules:

```bash
cp core/workflows/quick.md ~/.claude/nf/workflows/quick.md
```

Then run the installer to ensure hooks and workflows are fully synced:

```bash
node bin/install.js --claude --global
```

Verify the installed copy matches the repo source by checking that the delegate flag content is present in both locations.
  </action>
  <verify>
Run:
1. `grep --delegate ~/.claude/nf/workflows/quick.md` returns matches
2. `diff core/workflows/quick.md ~/.claude/nf/workflows/quick.md` shows no differences (or only expected installer-applied differences)
3. Installer completes without errors
  </verify>
  <done>
Installed workflow at `~/.claude/nf/workflows/quick.md` contains the --delegate flag support, synced from repo source. Installer ran successfully.
  </done>
</task>

</tasks>

<verification>
1. `core/workflows/quick.md` contains --delegate flag parsing in Step 1
2. Step 2.8 validates slot name against providers.json subprocess providers
3. Delegate branch dispatches via `node bin/coding-task-router.cjs --slot ... --task ...`
4. SUMMARY.md template includes delegation metadata (slot, status, latency)
5. STATE.md recording uses "Delegated (OK/Partial/Failed/Unavail)" status
6. `~/.claude/nf/workflows/quick.md` matches repo source
7. No invariant violations: no direct MCP calls, STATE.md tracking preserved, quorum skip is valid (no local artifact to review)
</verification>

<success_criteria>
- `/nf:quick --delegate codex-1 "implement feature X"` would parse the flag, validate codex-1 as a subprocess slot, skip local planning, dispatch via coding-task-router.cjs, and record the result
- `/nf:quick --delegate --full "task"` produces a mutual exclusivity error
- `/nf:quick --delegate nonexistent-slot "task"` produces an error listing valid slots
- Installed workflow copy is in sync with repo source
</success_criteria>

<output>
After completion, create `.planning/quick/381-add-delegate-flag-to-nf-quick-for-full-t/381-SUMMARY.md`
</output>

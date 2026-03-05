---
phase: quick-171
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - commands/qgsd/solve.md
autonomous: true
formal_artifacts: none
requirements: [SOLVE-PERF]

must_haves:
  truths:
    - "F->T remediation writes PLAN.md files and spawns parallel qgsd-executor agents instead of sequential /qgsd:quick batches"
    - "R->D remediation writes a single PLAN.md and spawns one qgsd-executor instead of sequential /qgsd:quick batches"
    - "No 50-stub cap exists — all stubs are processed every iteration"
    - "execution_context block documents the bulk remediation pattern"
    - "Constraint #5 reflects direct executor dispatch for F->T and R->D"
  artifacts:
    - path: "commands/qgsd/solve.md"
      provides: "Updated solve orchestrator with direct parallel executor dispatch"
      contains: "qgsd-executor"
  key_links:
    - from: "commands/qgsd/solve.md"
      to: "agents/qgsd-executor.md"
      via: "Task(subagent_type=qgsd-executor) dispatch in Step 3b and 3f"
      pattern: "subagent_type.*qgsd-executor"
    - from: "commands/qgsd/solve.md"
      to: ".planning/quick/solve-ft-batch-*/PLAN.md"
      via: "PLAN.md file generation before executor spawn"
      pattern: "solve-ft-batch"
---

<objective>
Modify the solve skill to use direct parallel executor dispatch for F->T stub implementation and R->D doc generation, replacing sequential /qgsd:quick batches. Remove the 50-stub cap per iteration.

Purpose: Eliminate per-batch quorum overhead that makes solve impractical at scale (233 F->T gaps = 16 sequential quick tasks = 48+ agent spawns). Direct executor dispatch runs all batches in parallel with no quorum gate.

Output: Updated commands/qgsd/solve.md with parallel executor pattern
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@commands/qgsd/solve.md
@/Users/jonathanborduas/.claude/plans/dynamic-toasting-goose.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace F->T and R->D dispatch with direct parallel executor pattern</name>
  <files>commands/qgsd/solve.md</files>
  <action>
Apply all 5 changes from the approved implementation plan (dynamic-toasting-goose.md) to commands/qgsd/solve.md:

**Change 1 — Replace Step 3b Phase 2 (lines 122-146):**

Replace the current "Phase 2 — Implement stubs via /qgsd:quick batches" section with a direct parallel executor dispatch pattern:

1. Load context: Parse `.formal/formal-test-sync-report.json` for each stub's requirement_id, formal_properties[].model_file, formal_properties[].property. Cross-reference `.formal/requirements.json` for requirement text.

2. Group into batches by category prefix (ACT-*, CONF-*, etc.), max 15 stubs per batch. **No cap per iteration** — process ALL stubs.

3. Write PLAN.md files directly to `.planning/quick/solve-ft-batch-{iteration}-{B}/PLAN.md`. Include YAML frontmatter (autonomous: true, requirements, files_modified) and a task block per batch with action/verify/done. Include the PLAN.md template from the approved plan showing the exact structure.

4. Spawn all executors in parallel using:
   ```
   Task(subagent_type="qgsd-executor", description="F->T stubs batch {B}: {category prefixes}")
   ```
   Wait for ALL to complete.

5. Run tests once: `node --test hooks/generated-stubs/*.stub.test.js`. Log pass/fail. Failed stubs handled by T->C next iteration.

6. Log: "F->T phase 2: spawned {N} parallel executors for {M} stubs (no quorum overhead)"

Remove the old batching strategy section (lines 141-146) including the 50-stub cap entirely.

**Change 2 — Replace Step 3f R->D dispatch (lines 228-251):**

Replace the sequential `/qgsd:quick` dispatch with:

1. Write ONE PLAN.md to `.planning/quick/solve-rd-{iteration}/PLAN.md` covering all undocumented requirements (up to 100). Include multiple task blocks (one per group of ~15 IDs).

2. Spawn ONE qgsd-executor to generate all doc entries into docs/dev/requirements-coverage.md.

3. Remove the "Wait for each batch to complete before dispatching the next" sequential constraint.

4. Log: "R->D: spawned 1 executor for {N} requirements (no quorum overhead)"

**Change 3 — Remove 50-stub cap:**

Delete the sentence on line 146: "If more than 50 stubs exist, cap at 50 per iteration to avoid unbounded work. The iteration loop will handle the remainder."

This is already handled by Change 1 which removes the entire old batching section.

**Change 4 — Update execution_context block (after line 26):**

Add this paragraph to the execution_context section:

```
BULK REMEDIATION: For F->T and R->D gaps, the solve skill writes PLAN.md files
directly and dispatches qgsd-executor agents in parallel — it does NOT invoke
/qgsd:quick for bulk remediation. This avoids per-batch quorum overhead while
maintaining quality through the convergence loop's before/after verification.
The solve skill IS the planner for these mechanical remediation tasks.
```

**Change 5 — Update constraint #5 (line 401-406):**

Replace the bullet list in constraint #5 with:
```
- close-formal-gaps --batch for missing formal models (R->F), then run model checkers
- formal-test-sync to generate stubs (F->T phase 1), then direct parallel executor
  dispatch to implement real test logic (F->T phase 2)
- fix-tests for failing tests (T->C)
- quick for constant mismatches (C->F), syntax/scope errors, conformance divergences (F->C)
- direct executor dispatch for R->D documentation generation
```

IMPORTANT: Do NOT modify any other steps (1, 2, 3a, 3c, 3d, 3e, 3g, 4, 5, 6, 7). Only touch Step 3b Phase 2, Step 3f, execution_context, and constraint #5.
  </action>
  <verify>
1. Grep for "/qgsd:quick" in solve.md — should appear ONLY in Steps 3d (C->F) and 3e (F->C), NOT in Steps 3b or 3f
2. Grep for "qgsd-executor" in solve.md — should appear in Step 3b Phase 2 and Step 3f
3. Grep for "cap at 50" in solve.md — should return zero matches
4. Grep for "BULK REMEDIATION" in solve.md — should appear in execution_context
5. Grep for "direct parallel executor" in solve.md constraint #5 area — should appear
6. Verify the file still has valid markdown structure (frontmatter intact, all 7 steps present)
  </verify>
  <done>
- Step 3b Phase 2 dispatches parallel qgsd-executor agents via PLAN.md files, not /qgsd:quick
- Step 3f dispatches a single qgsd-executor via one PLAN.md, not /qgsd:quick batches
- No 50-stub cap exists anywhere in the file
- execution_context documents the bulk remediation pattern
- Constraint #5 lists direct executor dispatch for F->T and R->D
- All other steps (1, 2, 3a, 3c, 3d, 3e, 3g, 4, 5, 6, 7) remain unchanged
  </done>
</task>

</tasks>

<verification>
1. `grep -c "qgsd:quick" commands/qgsd/solve.md` — count should be lower than before (removed from 3b and 3f, kept in 3d and 3e)
2. `grep "qgsd-executor" commands/qgsd/solve.md` — should find matches in Steps 3b and 3f
3. `grep "cap at 50" commands/qgsd/solve.md` — should return nothing
4. `grep "BULK REMEDIATION" commands/qgsd/solve.md` — should return one match
5. Full file reads cleanly with no broken markdown structure
</verification>

<success_criteria>
The solve skill commands/qgsd/solve.md uses direct parallel executor dispatch for F->T and R->D remediation, eliminating per-batch quorum overhead. The 50-stub cap is removed. All other solve behavior is preserved unchanged.
</success_criteria>

<output>
After completion, create `.planning/quick/171-modify-solve-skill-to-use-direct-paralle/171-SUMMARY.md`
</output>

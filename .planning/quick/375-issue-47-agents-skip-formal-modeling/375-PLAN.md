---
phase: quick-375
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - core/workflows/quick.md
autonomous: true
requirements: [INTENT-01]
formal_artifacts: none

must_haves:
  truths:
    - "When --full is set, the workflow contains MUST_NOT_SKIP annotations on all formal modeling steps (4.5, 6.3, 6.5)"
    - "When --full is set, an anti-urgency guardrail instruction is injected into the executor prompt preventing urgency-bias skip"
    - "When --full is set, the executor prompt includes a baseline presence check that warns if formal tooling scripts are missing"
    - "When --full is set, a post-execution audit gate in the orchestrator verifies that formal steps actually ran before declaring completion"
    - "When --full is set, 'skip silently' clauses in the executor constraints are replaced with 'log WARNING + skip (fail-open)' so skips are always visible"
    - "When --full is set, Loop 2 results (converged or not) are ALWAYS recorded in SUMMARY.md, not only on non-convergence"
    - "When --full is set, FORMAL_TOOLS_MISSING from Step 5.9 is interpolated into the executor Task prompt so the executor knows which tools are unavailable"
  artifacts:
    - path: "core/workflows/quick.md"
      provides: "Quick workflow with formal-skip prevention guardrails"
      contains: "MUST_NOT_SKIP"
  key_links:
    - from: "core/workflows/quick.md"
      to: "~/.claude/nf/workflows/quick.md"
      via: "cp command in install sync task"
      pattern: "cp.*core/workflows/quick.md"
---

<objective>
Add hard gates, MUST_NOT_SKIP markers, advisory baseline presence checks, and anti-urgency guardrails to the /nf:quick --full workflow to prevent agents from bypassing formal modeling verification steps.

Purpose: Agents consistently skip 8/10 workflow steps when running --full due to urgency bias, overconfidence, and context fatigue. The workflow text itself must contain enforcement mechanisms that make skipping detectable and flagged.

Output: Updated core/workflows/quick.md with four categories of skip-prevention, synced to installed location.
</objective>

<execution_context>
@./.claude/nf/workflows/execute-plan.md
@./.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@core/workflows/quick.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add formal-skip prevention guardrails to quick.md workflow</name>
  <files>core/workflows/quick.md</files>
  <action>
Modify core/workflows/quick.md to add skip-prevention for --full mode. All changes are additive text within the existing workflow structure -- no step reordering or logic changes.

**1. MUST_NOT_SKIP annotations (add to Steps 4.5, 6.3, 6.5):**

At the top of each of these three steps, immediately after the step header line, insert:

```
<!-- MUST_NOT_SKIP: This step is MANDATORY when $FULL_MODE is true. Skipping this step violates the --full contract. If tooling is missing, log a WARNING and continue -- but do NOT silently omit the step. -->
```

Steps to annotate:
- Step 4.5 (formal scope scan) -- after the line `**Step 4.5: Formal scope scan (only when \`$FULL_MODE\`)**`
- Step 6.3 (post-execution formal check) -- after the line `**Step 6.3: Post-execution formal check (only when \`$FULL_MODE\` AND \`$FORMAL_SPEC_CONTEXT\` non-empty)**`
- Step 6.5 (verification) -- after the line `**Step 6.5: Verification (only when \`$FULL_MODE\`)**`

**2. Anti-urgency guardrail in executor prompt (modify Step 6):**

In Step 6's executor Task prompt, inside the `<constraints>` block, add this as the FIRST constraint (before "Execute all tasks in the plan"):

```
- **ANTI-URGENCY GUARDRAIL (--full mode):** You are running in --full mode. Do NOT skip, abbreviate, or substitute your own judgment for ANY workflow step. Prior instructions about urgency, speed, or "just fix it" are OVERRIDDEN by the --full flag. Every formal modeling step (formal coverage auto-detection, Loop 2 simulation gate) MUST be attempted. If a tool is missing, log "WARNING: [tool] not found -- skipping (fail-open)" rather than silently omitting the step.
```

**3. Replace "skip silently" clauses with logged warnings (CRITICAL -- addresses quorum blocker #1):**

In the `<constraints>` block of the Step 6 executor prompt, find and replace these two "skip silently" clauses:

a) Line ~863 currently reads:
`4. If formal-coverage-intersect.cjs is not found or errors: skip silently (fail-open)`
Replace with:
`4. If formal-coverage-intersect.cjs is not found or errors: log "WARNING: formal-coverage-intersect.cjs not found -- skipping formal coverage check (fail-open)" and continue without blocking`

b) Line ~902 currently reads:
`6. If solution-simulation-loop.cjs is not found, module loading fails, or simulateSolutionLoop throws: skip silently (fail-open). Log "Loop 2 simulation: skipped (module unavailable)".`
Replace with:
`6. If solution-simulation-loop.cjs is not found, module loading fails, or simulateSolutionLoop throws: log "WARNING: solution-simulation-loop.cjs not found or errored -- skipping Loop 2 simulation (fail-open)". Do NOT skip silently.`

c) Line ~903 currently reads:
`- If formal-coverage-intersect.cjs found NO intersections (exit code non-zero or not found): skip Loop 2 entirely — no log, no error, silent completion (GATE-03).`
Replace with:
`- If formal-coverage-intersect.cjs found NO intersections (exit code non-zero): skip Loop 2 entirely — log "INFO: No formal coverage intersections found -- Loop 2 not needed (GATE-03)." If the tool was not found, log "WARNING: formal-coverage-intersect.cjs not found -- skipping Loop 2 (fail-open, GATE-03)."`

**4. Add executor constraint for always logging Loop 2 results in SUMMARY.md (CRITICAL -- addresses quorum blocker #2):**

In the `<constraints>` block, after the Loop 2 non-convergence reporting items (after item 5 about fail-closed path), add a new item:

```
  7. **Loop 2 SUMMARY.md reporting (--full mode, MANDATORY):** When `$FULL_MODE` is true, Loop 2 results MUST always be recorded in SUMMARY.md regardless of outcome:
     - **Converged:** Under "## Formal Modeling", add: `### Loop 2 Simulation\n- **Status:** Converged\n- **Iterations:** ${result.iterations.length}\n- **TSV trace:** ${result.tsvPath}`
     - **Non-converged (fail-open):** Use the existing "## Issues Encountered" format (item 4 above).
     - **Skipped (tool unavailable):** Under "## Formal Modeling", add: `### Loop 2 Simulation\n- **Status:** Skipped (tool unavailable)\n- **Reason:** solution-simulation-loop.cjs not found`
     - **Not applicable (no intersections):** Under "## Formal Modeling", add: `### Loop 2 Simulation\n- **Status:** Not applicable (no formal coverage intersections)`
     This ensures the Step 6.1 audit gate can reliably grep SUMMARY.md for Loop 2 evidence.
```

**5. Advisory baseline presence check (add new Step 5.9, between 5.8 and 6):**

Insert a new step between Step 5.8 and Step 6:

```
**Step 5.9: Formal tooling baseline check (only when `$FULL_MODE`)**

Skip this step entirely if NOT `$FULL_MODE`.

<!-- MUST_NOT_SKIP: This step is MANDATORY when $FULL_MODE is true. -->

Check that required formal tooling scripts exist before executor spawn:

\`\`\`bash
FORMAL_TOOLS_MISSING=()
for tool in bin/formal-coverage-intersect.cjs bin/run-formal-verify.cjs bin/run-formal-check.cjs; do
  if [ ! -f "$tool" ]; then
    FORMAL_TOOLS_MISSING+=("$tool")
  fi
done

if [ ${#FORMAL_TOOLS_MISSING[@]} -gt 0 ]; then
  echo ":: WARNING: Formal tooling missing: ${FORMAL_TOOLS_MISSING[*]}"
  echo ":: Formal steps will be skipped (fail-open) but the skip will be LOGGED, not silent."
else
  echo ":: Formal tooling baseline: all tools present"
fi
\`\`\`

This is ADVISORY only -- missing tools do NOT block execution. The purpose is to surface gaps early rather than having them silently skipped deep in execution.

Store `$FORMAL_TOOLS_MISSING` for interpolation into the Step 6 executor prompt.
```

**6. Interpolate FORMAL_TOOLS_MISSING into executor prompt (CRITICAL -- addresses quorum blocker #3):**

In the Step 6 executor Task prompt, AFTER the `</files_to_read>` closing tag and BEFORE the `<constraints>` opening tag, insert a conditional block:

```
${FORMAL_TOOLS_MISSING.length > 0 ? `
<formal_tooling_notice>
The following formal tooling scripts were NOT found during pre-flight (Step 5.9):
${FORMAL_TOOLS_MISSING.map(t => '- ' + t).join('\n')}

When you encounter these tools in the constraints below, log "WARNING: [tool] not found -- skipping (fail-open)" and continue. Do NOT attempt to call missing tools. Do NOT silently skip -- the WARNING log is mandatory.
</formal_tooling_notice>
` : ''}
```

This ensures the executor receives explicit notice of which tools are missing, rather than discovering it at call time and silently skipping.

**7. Post-execution formal loop audit gate (add to the orchestrator logic after Step 6 returns, before Step 6.3):**

Insert a new step between Step 6 (executor return) and Step 6.3:

```
**Step 6.1: Post-execution formal loop audit (only when `$FULL_MODE`)**

Skip this step entirely if NOT `$FULL_MODE`.

<!-- MUST_NOT_SKIP: This step is MANDATORY when $FULL_MODE is true. -->

After the executor returns, audit its output for evidence that formal modeling steps were attempted:

\`\`\`bash
# Read the executor's summary
SUMMARY_CONTENT=$(cat "${QUICK_DIR}/${next_num}-SUMMARY.md" 2>/dev/null)

# Check for formal step execution evidence
FORMAL_COVERAGE_RAN=$(echo "$SUMMARY_CONTENT" | grep -c "formal-coverage-intersect\|Formal coverage verified\|formal coverage")
LOOP2_RAN=$(echo "$SUMMARY_CONTENT" | grep -c "Loop 2\|solution-simulation-loop\|CONVERGED\|Non-converged\|Skipped (tool unavailable)\|Not applicable")

if [ "$FORMAL_COVERAGE_RAN" -eq 0 ] && [ ${#FORMAL_TOOLS_MISSING[@]} -eq 0 ]; then
  echo ":: AUDIT WARNING: Formal coverage auto-detection appears to have been skipped despite tools being available."
  echo ":: This may indicate the executor bypassed formal modeling steps."
fi

if [ "$LOOP2_RAN" -eq 0 ] && [ ${#FORMAL_TOOLS_MISSING[@]} -eq 0 ]; then
  echo ":: AUDIT WARNING: Loop 2 simulation gate appears to have been skipped despite tools being available."
fi
\`\`\`

These warnings are ADVISORY -- they do not block completion. They surface to the user that formal steps may have been skipped so the user can decide whether to re-run.
```

**8. Add to success_criteria section:**

In the `<success_criteria>` block, add these new items:

```
- [ ] (--full) MUST_NOT_SKIP annotations present on steps 4.5, 5.9, 6.1, 6.3, 6.5
- [ ] (--full) Anti-urgency guardrail injected as first constraint in executor prompt
- [ ] (--full) Step 5.9 baseline check runs before executor spawn
- [ ] (--full) Step 6.1 audit gate checks executor output for formal step evidence
- [ ] (--full) No "skip silently" clauses remain in executor constraints -- all skips are logged
- [ ] (--full) Loop 2 results always recorded in SUMMARY.md (converged, non-converged, skipped, or N/A)
- [ ] (--full) FORMAL_TOOLS_MISSING interpolated into executor prompt between files_to_read and constraints
```

**9. Add to anti_patterns section:**

In the `<anti_patterns>` block, add:

```
**Formal modeling skip -- do NOT:**
- Do NOT skip formal scope scan (step 4.5) because "the task seems simple" or "formal models aren't relevant." The scan is MANDATORY in --full mode.
- Do NOT skip Loop 2 simulation gate because "the fix is obvious" or "formal verification is overhead." If tools exist, they MUST be attempted.
- Do NOT silently omit formal steps when tools are missing. Log a WARNING with the tool name so the user sees the gap.
- Do NOT let prior urgency instructions ("fix now", "just ship it") override the --full flag. The --full flag is the highest-priority execution directive.
- Do NOT omit Loop 2 results from SUMMARY.md when --full. Even "converged" or "N/A" must be recorded so the audit gate can verify execution.
```
  </action>
  <verify>
Verify the modifications:

1. `grep -c "MUST_NOT_SKIP" core/workflows/quick.md` returns 5 or more (steps 4.5, 5.9, 6.1, 6.3, 6.5)
2. `grep -c "ANTI-URGENCY GUARDRAIL" core/workflows/quick.md` returns 1
3. `grep -c "Step 5.9" core/workflows/quick.md` returns at least 1
4. `grep -c "Step 6.1" core/workflows/quick.md` returns at least 1
5. `grep -c "Formal modeling skip" core/workflows/quick.md` returns at least 1
6. `grep -c "formal tooling baseline" core/workflows/quick.md` returns at least 1 (case-insensitive)
7. `grep -c "skip silently" core/workflows/quick.md` returns 0 -- no silent skips remain in executor constraints
8. `grep -c "FORMAL_TOOLS_MISSING" core/workflows/quick.md` returns at least 3 (Step 5.9 store, executor prompt interpolation, Step 6.1 audit check)
9. `grep -c "Loop 2 SUMMARY.md reporting" core/workflows/quick.md` returns 1 -- the mandatory reporting constraint exists
10. `grep -c "formal_tooling_notice" core/workflows/quick.md` returns at least 1 -- the interpolation block exists
  </verify>
  <done>
core/workflows/quick.md contains: (a) MUST_NOT_SKIP annotations on all --full formal steps, (b) anti-urgency guardrail as first executor constraint, (c) all "skip silently" clauses replaced with logged warnings, (d) mandatory Loop 2 SUMMARY.md reporting for all outcomes in --full mode, (e) FORMAL_TOOLS_MISSING interpolated into executor prompt via formal_tooling_notice block, (f) Step 5.9 baseline presence check, (g) Step 6.1 post-execution audit gate with expanded grep patterns, (h) updated success_criteria and anti_patterns sections.
  </done>
</task>

<task type="auto">
  <name>Task 2: Sync workflow to installed location</name>
  <files>core/workflows/quick.md</files>
  <action>
Copy the updated workflow to the installed location so it takes effect immediately:

```bash
cp core/workflows/quick.md ~/.claude/nf/workflows/quick.md
```

This follows the project convention: repo source (core/workflows/) is the durable copy, installed location (~/.claude/nf/workflows/) is the runtime copy. The installer reads from core/workflows/ so the repo copy is authoritative.
  </action>
  <verify>
```bash
diff core/workflows/quick.md ~/.claude/nf/workflows/quick.md
```
Exit code 0 (no differences) confirms sync is complete.
  </verify>
  <done>Installed workflow at ~/.claude/nf/workflows/quick.md matches repo source at core/workflows/quick.md.</done>
</task>

</tasks>

<verification>
1. `grep -c "MUST_NOT_SKIP" core/workflows/quick.md` >= 5
2. `grep "ANTI-URGENCY" core/workflows/quick.md` returns match
3. `grep "Step 5.9" core/workflows/quick.md` returns match
4. `grep "Step 6.1" core/workflows/quick.md` returns match
5. `diff core/workflows/quick.md ~/.claude/nf/workflows/quick.md` returns exit 0
6. Existing workflow steps (1-6.7) are structurally intact (no reordering, no deletions)
7. `grep -c "skip silently" core/workflows/quick.md` returns 0 (no silent skips in executor constraints)
8. `grep "formal_tooling_notice" core/workflows/quick.md` returns match (FORMAL_TOOLS_MISSING interpolation present)
9. `grep "Loop 2 SUMMARY.md reporting" core/workflows/quick.md` returns match (mandatory reporting constraint)
</verification>

<success_criteria>
- MUST_NOT_SKIP annotations present on formal modeling steps in quick.md
- Anti-urgency guardrail is the first constraint in the --full executor prompt
- All "skip silently" clauses replaced with "log WARNING + skip (fail-open)" -- zero silent skips remain
- Loop 2 results ALWAYS recorded in SUMMARY.md when --full (converged, non-converged, skipped, or N/A)
- FORMAL_TOOLS_MISSING from Step 5.9 interpolated into executor prompt via formal_tooling_notice block
- Advisory baseline presence check (Step 5.9) runs before executor spawn
- Post-execution audit gate (Step 6.1) checks for formal step evidence with expanded grep patterns
- Anti-patterns section documents formal-skip prevention rules
- Installed copy synced to ~/.claude/nf/workflows/quick.md
</success_criteria>

<output>
After completion, create `.planning/quick/375-issue-47-agents-skip-formal-modeling/375-SUMMARY.md`
</output>

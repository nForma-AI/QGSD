---
phase: quick-142
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - commands/qgsd/solve.md
autonomous: true
formal_artifacts: none
requirements: [QUICK-142]

must_haves:
  truths:
    - "Running /qgsd:solve with no flags performs a diagnostic sweep, dispatches remediation skills for non-zero gaps (R->F, F->T, T->C, F->C), re-diagnoses, and presents a before/after residual comparison"
    - "Running /qgsd:solve --report-only performs a single diagnostic sweep and displays the residual vector without dispatching any remediation skills"
    - "The skill dispatches to the correct remediation target for each gap type: close-formal-gaps for R->F, formal-test-sync for F->T, fix-tests for T->C, run-formal-verify.cjs for F->C, and logs C->F for manual review"
    - "The skill converges by re-diagnosing after each remediation round and stopping when residual is zero or unchanged"
  artifacts:
    - path: "commands/qgsd/solve.md"
      provides: "Orchestrator skill that diagnoses, remediates, and converges the consistency solver"
      contains: "close-formal-gaps"
  key_links:
    - from: "commands/qgsd/solve.md"
      to: "bin/qgsd-solve.cjs"
      via: "Runs diagnostic sweep with --json --report-only to get machine-readable residual vector"
      pattern: "qgsd-solve.cjs.*--json.*--report-only"
    - from: "commands/qgsd/solve.md"
      to: "commands/qgsd/close-formal-gaps.md"
      via: "Dispatches R->F gap remediation via /qgsd:close-formal-gaps"
      pattern: "close-formal-gaps"
    - from: "commands/qgsd/solve.md"
      to: "commands/qgsd/formal-test-sync.md"
      via: "Dispatches F->T gap remediation via /qgsd:formal-test-sync"
      pattern: "formal-test-sync"
    - from: "commands/qgsd/solve.md"
      to: "commands/qgsd/fix-tests.md"
      via: "Dispatches T->C gap remediation via /qgsd:fix-tests"
      pattern: "fix-tests"
---

<objective>
Rewrite `commands/qgsd/solve.md` from a thin "run script" wrapper into a full orchestrator skill that diagnoses consistency gaps, dispatches to the appropriate remediation skills for each gap type, and converges via a diagnose-remediate-rediagnose loop with before/after residual comparison.

Purpose: Currently the solver can only auto-close F->T gaps (test stubs) and marks everything else as "manual fix required." The remediation skills already exist (close-formal-gaps, formal-test-sync, fix-tests) but are never invoked. This enhancement wires them into the solver's convergence loop so running `/qgsd:solve` actually closes gaps across all layers automatically.

Output: Rewritten `commands/qgsd/solve.md` with orchestration logic, convergence loop, and before/after reporting.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@commands/qgsd/solve.md
@bin/qgsd-solve.cjs
@commands/qgsd/close-formal-gaps.md
@commands/qgsd/formal-test-sync.md
@commands/qgsd/fix-tests.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Rewrite solve.md as orchestrator skill with convergence loop</name>
  <files>
    commands/qgsd/solve.md
  </files>
  <action>
Rewrite `commands/qgsd/solve.md` completely. The new skill definition transforms from a simple "run script" into a multi-step orchestrator. Key design decisions:

**Frontmatter changes:**
- Keep `name: qgsd:solve`
- Update description to reflect orchestration role
- Keep existing `argument-hint: [--report-only] [--max-iterations=N] [--json] [--verbose]`
- Expand `allowed-tools` to include: Read, Write, Edit, Bash, Glob, Grep, Agent, Skill, AskUserQuestion (needed because remediation sub-skills like close-formal-gaps and fix-tests require write access and agent spawning)

**Process section — replace the current single-line "run script" with this orchestration logic:**

**Step 1: Initial Diagnostic Sweep**
- Run `node bin/qgsd-solve.cjs --json --report-only` to get the baseline residual vector
- Parse the JSON output. Extract `residual_vector` object with fields: `r_to_f`, `f_to_t`, `c_to_f`, `t_to_c`, `f_to_c`, and `total`
- Store this as `baseline_residual` for the before/after comparison
- Display the baseline residual table to the user (use the human-readable format: layer name, residual count, health color)

**Step 2: Report-only mode gate**
- If `--report-only` was passed: display the residual vector and STOP. Do not proceed to remediation. This preserves the read-only diagnostic mode.

**Step 3: Remediation dispatch (ordered by dependency — R->F must come before F->T since new formal specs create new invariants needing test backing)**

For each gap type with residual > 0, dispatch in this order:

1. **R->F gaps (residual_vector.r_to_f.residual > 0):**
   - Extract the list of uncovered requirement IDs from `residual_vector.r_to_f.detail.uncovered_requirements`
   - If the list has 10 or fewer IDs: run `/qgsd:close-formal-gaps --ids={comma-separated-ids}`
   - If the list has more than 10 IDs: run `/qgsd:close-formal-gaps --all`
   - Log: "Dispatching R->F remediation: close-formal-gaps for {N} uncovered requirements"

2. **F->T gaps (residual_vector.f_to_t.residual > 0):**
   - Run `node bin/formal-test-sync.cjs` (the full sync, not --report-only — this generates test stubs and updates sidecars)
   - Do NOT dispatch /qgsd:formal-test-sync as a skill — the Node.js script is sufficient and faster. The script already handles stub generation.
   - Log: "Dispatching F->T remediation: formal-test-sync for {N} uncovered invariants"

3. **T->C gaps (residual_vector.t_to_c.residual > 0):**
   - Run `/qgsd:fix-tests` to discover and fix failing tests
   - Log: "Dispatching T->C remediation: fix-tests for {N} failing tests"

4. **C->F gaps (residual_vector.c_to_f.residual > 0):**
   - Do NOT auto-remediate. Log the mismatches with this message: "C->F: {N} constant mismatch(es) require manual review (formal value vs config value divergence is intentional-or-not judgment)"
   - Display each mismatch: constant name, formal value, config value
   - These are skipped because constant mismatches may be intentional divergences

5. **F->C gaps (residual_vector.f_to_c.residual > 0):**
   - Run `node bin/run-formal-verify.cjs` and capture the exit code
   - If the exit code is non-zero, report the number of failing checks
   - Log: "Dispatching F->C remediation: run-formal-verify for {N} failing checks"

**Step 4: Re-diagnostic sweep**
- After all remediations complete, run `node bin/qgsd-solve.cjs --json --report-only` again
- Parse the JSON output as `post_residual`

**Step 5: Convergence check**
- Compare `baseline_residual.total` vs `post_residual.total`
- If `post_residual.total` is 0: report "All layers converged to zero. System is fully consistent."
- If `post_residual.total` < `baseline_residual.total`: report improvement and note remaining gaps
- If `post_residual.total` >= `baseline_residual.total`: report that residual did not decrease, remaining gaps may need manual attention
- If `--max-iterations` was passed and N > 1: repeat Steps 3-5 up to N times, stopping early if residual reaches zero or stops decreasing between iterations

**Step 6: Before/After Summary**
- Display a side-by-side comparison table:
```
Layer Transition       Before  After   Delta
R -> F (Req->Formal)     {N}    {M}    {diff}
F -> T (Formal->Test)    {N}    {M}    {diff}
C -> F (Code->Formal)    {N}    {M}    {diff}
T -> C (Test->Code)      {N}    {M}    {diff}
F -> C (Formal->Code)    {N}    {M}    {diff}
Total                    {N}    {M}    {diff}
```
- If any C->F gaps were skipped, remind the user they need manual review

**Important constraints:**
- The `bin/qgsd-solve.cjs` script is NOT modified — it remains the diagnostic engine. The skill uses it with `--json --report-only` to get data, then orchestrates remediation at the skill level.
- The convergence loop in the skill replaces the script's internal loop. When the skill dispatches, it always uses `--report-only` for the sweep (no auto-close by the script) because the skill handles remediation via richer sub-skills.
- Each remediation dispatch should be wrapped in a try/catch-style approach: if a sub-skill fails, log the failure and continue to the next gap type. Do not let one failure abort the entire solve cycle.
  </action>
  <verify>
    1. Read `commands/qgsd/solve.md` and confirm the frontmatter contains `allowed-tools` that includes: Read, Write, Edit, Bash, Glob, Grep, Agent, Skill, AskUserQuestion
    2. Confirm the process section contains conditional dispatch logic for all 5 gap types: R->F (close-formal-gaps), F->T (formal-test-sync.cjs), T->C (fix-tests), C->F (manual log), F->C (run-formal-verify.cjs)
    3. Confirm `--report-only` short-circuits after the diagnostic sweep (no remediation dispatches)
    4. Confirm the process describes a convergence loop with re-diagnosis after remediation
    5. Confirm the process includes a before/after residual comparison table
    6. Confirm the frontmatter `name` is still `qgsd:solve` and the `argument-hint` still includes `--report-only`, `--max-iterations`, `--json`, `--verbose`
    7. `grep -c 'close-formal-gaps' commands/qgsd/solve.md` returns at least 1
    8. `grep -c 'fix-tests' commands/qgsd/solve.md` returns at least 1
    9. `grep -c 'formal-test-sync' commands/qgsd/solve.md` returns at least 1
    10. `grep -c 'run-formal-verify' commands/qgsd/solve.md` returns at least 1
    11. `grep -c 'report-only' commands/qgsd/solve.md` returns at least 2 (one in argument-hint, one in the report-only gate logic)
  </verify>
  <done>
    The solve.md skill is a complete orchestrator: it runs the diagnostic sweep via qgsd-solve.cjs --json --report-only, interprets the residual vector, dispatches to the correct remediation skill/script for each gap type (R->F: close-formal-gaps, F->T: formal-test-sync.cjs, T->C: fix-tests, F->C: run-formal-verify.cjs, C->F: manual log), re-diagnoses to measure improvement, converges via loop, and presents a before/after residual comparison. The --report-only flag preserves read-only diagnostic mode.
  </done>
</task>

</tasks>

<verification>
1. `head -20 commands/qgsd/solve.md` — shows updated frontmatter with expanded allowed-tools
2. `grep -c 'close-formal-gaps\|formal-test-sync\|fix-tests\|run-formal-verify' commands/qgsd/solve.md` — returns 4+ (all remediation targets referenced)
3. `grep 'report-only' commands/qgsd/solve.md` — appears in both argument-hint and gate logic
4. `grep 'convergence\|before.*after\|re-diagnos\|residual' commands/qgsd/solve.md` — confirms convergence loop and before/after comparison are described
5. The skill file is valid YAML frontmatter + XML structure (no syntax errors)
</verification>

<success_criteria>
- solve.md frontmatter has expanded allowed-tools (Write, Edit, Agent, Skill, AskUserQuestion added)
- solve.md process section dispatches to 4 remediation targets (close-formal-gaps, formal-test-sync.cjs, fix-tests, run-formal-verify.cjs) and logs C->F for manual review
- --report-only mode short-circuits after diagnostic sweep (no remediation)
- Convergence loop re-diagnoses after remediation and compares before/after residuals
- Before/after comparison table is included in the output format
- Remediation order respects dependencies: R->F before F->T (new formal specs create new invariants)
</success_criteria>

<output>
After completion, create `.planning/quick/142-enhance-qgsd-solve-to-orchestrate-remedi/142-SUMMARY.md`
</output>

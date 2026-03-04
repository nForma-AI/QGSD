---
name: qgsd:solve
description: Orchestrator skill that diagnoses consistency gaps, dispatches to remediation skills for each gap type, and converges via diagnose-remediate-rediagnose loop with before/after comparison
argument-hint: [--report-only] [--max-iterations=N] [--json] [--verbose]
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Agent
  - Skill
---

<objective>
Run the QGSD consistency solver as a full orchestrator. Sweeps 7 layer transitions (R->F, F->T, C->F, T->C, F->C, R->D, D->C), computes a residual vector showing gaps at each boundary, and automatically dispatches to the correct remediation skill/script for each gap type. Re-diagnoses after each remediation round and iterates until convergence or max iterations reached. Returns before/after residual comparison.
</objective>

<execution_context>
AUTONOMY REQUIREMENT: This skill runs FULLY AUTONOMOUSLY. Do NOT ask the user
any questions. Do NOT stop for human input. If a sub-skill fails, log the
failure and continue to the next gap. The only valid reason to stop is:
all iterations exhausted, or total residual is zero.

This is a self-contained orchestrator skill. It runs the diagnostic engine (bin/qgsd-solve.cjs) and orchestrates higher-level remediation via sub-skills and scripts. No external quorum dispatch is needed — quorum enforcement, if required, is the responsibility of the sub-skills being called.
</execution_context>

<process>

## Step 1: Initial Diagnostic Sweep

Run the diagnostic solver using absolute paths (or fall back to CWD-relative):

```bash
BASELINE=$(node ~/.claude/qgsd-bin/qgsd-solve.cjs --json --report-only --project-root=$(pwd))
```

If ~/.claude/qgsd-bin/qgsd-solve.cjs does not exist, fall back to bin/qgsd-solve.cjs (CWD-relative).
If neither exists, error with: "QGSD solve scripts not installed. Run `node bin/install.js --claude --global` from the QGSD repo."

Parse the JSON output to extract the `residual_vector` object. Key fields:
- `residual_vector.r_to_f.residual` — count of requirements lacking formal coverage
- `residual_vector.f_to_t.residual` — count of formal invariants lacking test backing
- `residual_vector.c_to_f.residual` — count of constant mismatches (Code vs Formal)
- `residual_vector.t_to_c.residual` — count of failing unit tests
- `residual_vector.f_to_c.residual` — count of failing formal checks
- `residual_vector.r_to_d.residual` — count of requirements not documented in developer docs
- `residual_vector.d_to_c.residual` — count of stale structural claims in docs
- `residual_vector.total` — total residual across all layers

Store the parsed baseline residual as `baseline_residual` for the before/after comparison at the end.

Display the baseline residual in human-readable format:
```
Layer Transition         Baseline  Health
────────────────────────────────────────
R -> F (Req->Formal)        N      [status]
F -> T (Formal->Test)       N      [status]
C -> F (Code->Formal)       N      [status]
T -> C (Test->Code)         N      [status]
F -> C (Formal->Code)       N      [status]
R -> D (Req->Docs)          N      [status]
D -> C (Docs->Code)         N      [status]
Total                       N
```

Health status: GREEN (0), YELLOW (1-3), RED (4+), or UNKNOWN (error).

## Step 2: Report-Only Gate

If `--report-only` flag was passed:
- Display the baseline residual vector only
- STOP — do not proceed to remediation
- Exit with status based on whether residual is zero (0) or non-zero (1)

This preserves the read-only diagnostic mode.

## Step 3: Remediation Dispatch (Ordered by Dependency)

**Important:** Dispatch remediation in this strict order because R->F coverage is a prerequisite for F->T test stubs. New formal specs create new invariants needing test backing.

For each gap type with `residual > 0`, dispatch in this exact order:

### 3a. R->F Gaps (residual_vector.r_to_f.residual > 0)

Extract the list of uncovered requirement IDs from `residual_vector.r_to_f.detail.uncovered_requirements`.

If the list has 10 or fewer IDs, dispatch:
```
/qgsd:close-formal-gaps --batch --ids=REQ-01,REQ-02,...
```

If the list has more than 10 IDs, dispatch:
```
/qgsd:close-formal-gaps --batch --all
```

Log: `"Dispatching R->F remediation: close-formal-gaps for {N} uncovered requirements"`

Wait for the skill to complete. If it fails, log the failure and continue to the next gap type.

### 3b. F->T Gaps (residual_vector.f_to_t.residual > 0)

Run the formal-test-sync script directly using absolute paths:
```bash
node ~/.claude/qgsd-bin/formal-test-sync.cjs --project-root=$(pwd)
```

If ~/.claude/qgsd-bin/formal-test-sync.cjs does not exist, fall back to bin/formal-test-sync.cjs (CWD-relative).

This will generate test stubs for all uncovered invariants and update traceability sidecars.

Log: `"Dispatching F->T remediation: formal-test-sync for {N} uncovered invariants"`

If the script fails (exit code non-zero), log the failure and continue.

### 3c. T->C Gaps (residual_vector.t_to_c.residual > 0)

Dispatch the fix-tests skill:
```
/qgsd:fix-tests
```

This will discover and autonomously fix failing tests.

Log: `"Dispatching T->C remediation: fix-tests for {N} failing tests"`

If it fails, log the failure and continue.

### 3d. C->F Gaps (residual_vector.c_to_f.residual > 0)

Constant mismatches between code and formal specs. Display the mismatch table, then dispatch `/qgsd:quick` to align them:

```
C->F: {N} constant mismatch(es) — dispatching quick task to align
```

Display detail table:
```
Constant        Source            Formal Value    Config Value
─────────────────────────────────────────────────────────────
constant_name   formal_spec_file  formal_val      config_val
```

Dispatch:
```
/qgsd:quick Fix C->F constant mismatches: update formal specs OR code config to align these values: {mismatch_summary}
```

If the mismatch has `intentional_divergence: true`, skip it and log as intentional.

### 3e. F->C Gaps (residual_vector.f_to_c.residual > 0)

First, run the formal verification using absolute paths to get fresh failure data:
```bash
node ~/.claude/qgsd-bin/run-formal-verify.cjs --project-root=$(pwd)
```

If ~/.claude/qgsd-bin/run-formal-verify.cjs does not exist, fall back to bin/run-formal-verify.cjs (CWD-relative).

Then parse `.formal/check-results.ndjson` and classify each failure:

| Classification | Criteria | Dispatch |
|---------------|----------|----------|
| **Syntax error** | Summary contains "Syntax error", "parse error" | `/qgsd:quick Fix Alloy/TLA+ syntax error in {model_file}: {error_detail}` |
| **Scope error** | Summary contains "scope", "sig" | `/qgsd:quick Fix scope declaration in {model_file}: {error_detail}` |
| **Conformance divergence** | check_id contains "conformance" | `/qgsd:quick Fix conformance trace divergences in {model_file}: {error_detail}` |
| **Verification failure** | Counterexample found | `/qgsd:quick Fix formal verification counterexample in {check_id}: {summary}` |
| **Missing tool** | "not found", "not installed" | Log as infrastructure gap, skip |
| **Inconclusive** | result = "inconclusive" | Skip — not a failure |

Dispatch each fixable failure to the appropriate skill. Process syntax/scope errors first (they're usually quick fixes), then conformance/verification failures (require deeper investigation).

Log: `"F->C: {total} checks, {pass} pass, {fail} fail — dispatching {syntax_count} to quick, {debug_count} to debug, {skip_count} skipped"`

Each dispatch is independent — if one fails, continue to the next.

### 3f. R->D Gaps (residual_vector.r_to_d.residual > 0)

Requirements that shipped but are not mentioned in developer docs. This is a manual-review-only gap — there is no automated remediation because documentation must be authored by humans.

Display the undocumented requirement IDs from `residual_vector.r_to_d.detail.undocumented_requirements`:

```
R->D: {N} requirement(s) undocumented in developer docs:
  - REQ-01
  - REQ-02
  ...
```

Log: `"R->D: {N} requirement(s) undocumented in developer docs — manual review required"`

Do NOT dispatch any skill — this is informational only.

### 3g. D->C Gaps (residual_vector.d_to_c.residual > 0)

Stale structural claims in documentation — file paths, CLI commands, or dependencies referenced in docs that no longer exist in the codebase. This is a manual-review-only gap.

Display the broken claims table from `residual_vector.d_to_c.detail.broken_claims`:

```
D->C: {N} stale structural claim(s) in docs:
  Doc File              Line  Type         Value                    Reason
  ──────────────────────────────────────────────────────────────────────────
  README.md             42    file_path    bin/old-script.cjs       file not found
  docs/setup.md         15    cli_command  node bin/missing.cjs     script not found
  docs/deps.md          8     dependency   old-package              not in package.json
```

Log: `"D->C: {N} stale structural claim(s) in docs — manual review required"`

Do NOT dispatch any skill — this is informational only.

## Step 4: Re-Diagnostic Sweep

After all remediations in Step 3 complete, run the diagnostic again using absolute paths:
```bash
POST=$(node ~/.claude/qgsd-bin/qgsd-solve.cjs --json --report-only --project-root=$(pwd))
```

If ~/.claude/qgsd-bin/qgsd-solve.cjs does not exist, fall back to bin/qgsd-solve.cjs (CWD-relative).

Parse the result as `post_residual`.

## Step 5: Convergence Check

Compare the baseline total residual against the post-remediation total:

- If `post_residual.total == 0`: Report `"✓ All layers converged to zero. System is fully consistent."` and EXIT.
- If `post_residual.total < baseline_residual.total`: Report improvement `"✓ Improvement: {baseline} → {post} gaps remaining"` and continue to Step 6.
- If `post_residual.total >= baseline_residual.total`: Report stasis `"⚠ Residual did not decrease. {baseline} → {post}. Remaining gaps may need manual attention."` and continue to Step 6.

### Iteration Loop (if --max-iterations > 1)

If `--max-iterations=N` was passed and N > 1:
- Increment iteration counter
- If iterations < max_iterations AND residual decreased AND residual > 0: loop back to Step 3 (re-dispatch remediation)
- If iterations >= max_iterations OR residual unchanged OR residual == 0: proceed to Step 6

Default behavior (no `--max-iterations` flag): max iterations = 5.

## Step 6: Before/After Summary

Display a comprehensive before/after comparison table:

```
Layer Transition         Before  After   Delta     Status
─────────────────────────────────────────────────────────
R -> F (Req→Formal)        {N}    {M}    {delta}   [GREEN|YELLOW|RED]
F -> T (Formal→Test)       {N}    {M}    {delta}   [GREEN|YELLOW|RED]
C -> F (Code→Formal)       {N}    {M}    {delta}   [GREEN|YELLOW|RED]
T -> C (Test→Code)         {N}    {M}    {delta}   [GREEN|YELLOW|RED]
F -> C (Formal→Code)       {N}    {M}    {delta}   [GREEN|YELLOW|RED]
R -> D (Req→Docs)          {N}    {M}    {delta}   [MANUAL]
D -> C (Docs→Code)         {N}    {M}    {delta}   [MANUAL]
──────────────────────────────────────────────────────────
Total                      {N}    {M}    {delta}
```

**IMPORTANT — Expand non-zero layers:** For any layer with residual > 0, display the full detail below the table. The residual number alone hides severity. For example, F→C residual=1 might mean "1 check failed with 7,086 individual divergences." Always show:

- **R→F**: List all uncovered requirement IDs
- **F→T**: Count of formal properties without test backing
- **T→C**: List failing test names and error summaries
- **C→F**: Table of each constant mismatch (name, formal value, config value)
- **F→C**: For each failing check: check_id, summary (including counts like "7086 divergences"), affected requirement IDs. Also list inconclusive checks separately.
- **R→D**: List all undocumented requirement IDs
- **D→C**: Table of each broken claim (doc_file, line, type, value, reason)

Example F→C expansion:
```
F → C Detail:
  ✗ ci:conformance-traces — 7086 divergence(s) in 20199 traces
  ⚠ ci:liveness-fairness-lint — fairness declarations missing for 10 properties
```

If any gaps remain after convergence, append a summary of what couldn't be auto-fixed and why.

Note: R->D and D->C gaps require manual review. R->D gaps mean shipped requirements are undiscoverable in docs. D->C gaps mean docs reference files, commands, or dependencies that no longer exist.

## Step 7: Full Formal Verification Detail Table

**ALWAYS display this table** — it shows every individual check from `run-formal-verify.cjs`, not just the solver-tracked layer residuals. The solver layer table (Step 6) can show all-green while real formal model failures hide underneath.

After the before/after table, run the full formal verification using absolute paths if not already run during Step 3e:
```bash
node ~/.claude/qgsd-bin/run-formal-verify.cjs --project-root=$(pwd)
```

If ~/.claude/qgsd-bin/run-formal-verify.cjs does not exist, fall back to bin/run-formal-verify.cjs (CWD-relative).

Parse `.formal/check-results.ndjson` and display **every check** grouped by result:

```
Formal Verification Detail ({pass}/{total} passed):
─────────────────────────────────────────────────────────
CHECK                          RESULT     DETAIL
─────────────────────────────────────────────────────────
✓ check_id                     PASS       (optional note)
...
✗ check_id                     FAIL       summary of failure
...
⚠ check_id                     INCONC     reason for inconclusive
...
─────────────────────────────────────────────────────────
```

Rules for the detail column:
- **PASS**: Leave blank unless there's a notable caveat (e.g., "low-confidence — 0 traces", "empirical timing only")
- **FAIL**: Show the full summary from the check result (e.g., "7271 divergence(s) in 20651 traces", "MCMCPEnv model check failed", "tp_rate=0.49, unavail=0.45")
- **INCONCLUSIVE**: Show the reason (e.g., "fairness missing: PropertyName1, PropertyName2", "verifyta not installed")

Display checks in this order: PASS first (alphabetical), then FAIL (alphabetical), then INCONCLUSIVE (alphabetical). This puts failures and inconclusives at the bottom where they're visually prominent.

After the table, if there are any FAIL or INCONCLUSIVE checks, add a brief actionability note:
```
{fail_count} check(s) failing, {inconc_count} inconclusive.
Failing checks need investigation — use /qgsd:quick to dispatch fixes for syntax/scope errors or conformance divergences.
Inconclusive checks are not failures but indicate incomplete verification (usually missing fairness declarations or tools).
```

This table is mandatory even when the solver layer residuals are all zero — because formal model failures (Alloy, TLA+, PRISM) may exist outside the solver's tracked CI checks.

## Important Constraints

1. **bin/qgsd-solve.cjs is NOT modified** — it remains the diagnostic engine. This skill orchestrates remediation at the skill/script level.

2. **Convergence loop is at skill level** — when the skill calls diagnostic again in Step 4, it uses `--json --report-only` to get fresh data. The skill then decides whether to loop back to Step 3 or exit. The script's internal auto-close loop is bypassed.

3. **Error handling** — each remediation dispatch is wrapped in error handling. If a sub-skill or script fails, log the failure and continue to the next gap type. Do not let one failure abort the entire solve cycle.

4. **Ordering** — remediation order is strict because R→F must precede F→T (new formal specs create new invariants needing test backing). T→C fixes must happen before F→C verification (tests must pass before checking formal properties against code).

5. **Full skill arsenal** — the solver dispatches to the right skill for each gap type. It never stops at "manual review required" if a skill exists that can attempt the fix. The hierarchy is:
   - **close-formal-gaps --batch** for missing formal models (R→F)
   - **formal-test-sync** for missing test backing (F→T)
   - **fix-tests** for failing tests (T→C)
   - **quick** for constant mismatches (C→F), syntax/scope errors, conformance divergences, and verification counterexamples in formal models (F→C)

6. **Cascade awareness** — fixing one layer often creates gaps in the next (e.g., new formal models → new F→T gaps → new stubs → new T→C gaps). The iteration loop handles this naturally. Expect the total to fluctuate between iterations before converging.

</process>

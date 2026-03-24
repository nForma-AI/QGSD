---
phase: 337-fast-path-initial-diagnostic
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - commands/nf/solve.md
autonomous: true
formal_artifacts: none
requirements:
  - INTENT-01

must_haves:
  truths:
    - "Running /nf:solve without --verbose uses direct Bash call to nf-solve.cjs for Phase 1 baseline instead of Agent dispatch"
    - "Running /nf:solve with --verbose dispatches the full Agent path to solve-diagnose.md as before"
    - "Fast-path Phase 1 output is parsed identically to the Agent path (same baseline_residual, open_debt, status handling)"
    - "Phase 1b (Classify) is skipped in fast-path mode since classification depends on full diagnostic context"
  artifacts:
    - path: "commands/nf/solve.md"
      provides: "Fast-path conditional dispatch for Phase 1"
      contains: "nf-solve.cjs --json --report-only"
  key_links:
    - from: "commands/nf/solve.md"
      to: "nf-solve.cjs"
      via: "direct Bash call in fast-path"
      pattern: "node.*nf-solve\\.cjs.*--json.*--report-only"
    - from: "commands/nf/solve.md"
      to: "solve-diagnose.md"
      via: "Agent dispatch in verbose path"
      pattern: "verbose.*solve-diagnose"
---

<objective>
Replace the Phase 1 diagnostic Agent dispatch in solve.md with a direct Bash call to nf-solve.cjs for the initial baseline, cutting ~27 minutes of Agent overhead down to ~60 seconds. The full Agent path (solve-diagnose.md with all sub-steps) is preserved when --verbose is passed.

Purpose: The initial diagnostic sweep is the #1 time cost in /nf:solve. The Agent dispatch loads solve-diagnose.md which runs 7+ sub-steps (legacy migration, config audit, observe refresh, debt load, hypothesis measurement, quorum vote, then the actual nf-solve.cjs call). For typical runs, the baseline from nf-solve.cjs alone is sufficient to drive the convergence loop. The verbose path preserves full diagnostic fidelity when needed.

Output: Modified commands/nf/solve.md with conditional fast-path/verbose dispatch
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@commands/nf/solve.md
@commands/nf/solve-diagnose.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add fast-path conditional dispatch to Phase 1 in solve.md</name>
  <files>commands/nf/solve.md</files>
  <action>
Modify `commands/nf/solve.md` Phase 1 and Phase 1b sections to add a conditional fast-path:

**Flag Extraction section** — add `--verbose` to the existing flag parsing. After the focusPhrase extraction, add:
```
Extract `--verbose` flag. Store as `verboseMode` (boolean, default false).
```

**Phase 1: Diagnose** — wrap the existing Agent dispatch in a conditional:

Replace the current Phase 1 content with:

```
## Phase 1: Diagnose

### Fast-path (default — no --verbose)

When `verboseMode` is false, run the diagnostic sweep directly via Bash instead of dispatching an Agent to solve-diagnose.md. This skips legacy migration, config audit, observe refresh, debt load, hypothesis measurement, and quorum vote — producing the baseline residual in ~60s instead of ~27min.

```bash
BASELINE=$(node ~/.claude/nf-bin/nf-solve.cjs --json --report-only --project-root=$(pwd)${focusPhrase:+ --focus="$focusPhrase"} 2>&1)
```

If `~/.claude/nf-bin/nf-solve.cjs` does not exist, fall back to `bin/nf-solve.cjs` (CWD-relative).

Parse the JSON output to extract:
- `baseline_residual` from `residual_vector`
- `status`: set to `"ok"` if JSON parsed successfully, `"error"` if script failed
- If `residual_vector.total == 0`: set `status = "bail"`, `reason = "zero_residual"`

Set defaults for fields that only the full Agent path produces:
- `open_debt = []`
- `heatmap = null`
- `issues = null`
- `fsm_candidates = []`
- `targets = null`
- `hypothesis_measurements = null`
- `root_cause_verdict = "SKIPPED_FAST_PATH"`

Display the baseline residual table (same format as current — the unified table from solve-diagnose Step 1).

Skip Phase 1b (Classify) entirely in fast-path — classification depends on the full diagnostic context that fast-path omits.

### Verbose path (--verbose)

When `verboseMode` is true, dispatch the full Agent to solve-diagnose.md (existing behavior, unchanged):

```
Agent(
  subagent_type="general-purpose",
  description="solve: diagnostic sweep",
  prompt="First resolve the sub-skill path: try $HOME/.claude/commands/nf/solve-diagnose.md, fall back to commands/nf/solve-diagnose.md if not found. Read and follow it end-to-end.
CLI flags from orchestrator: {flags}
After completing all steps, output ONLY the JSON result object described in the output_contract section of solve-diagnose.md."
)
```

Parse the Agent's JSON output (existing logic, unchanged):
- If `status == "error"`: log reason, exit gracefully
- If `status == "bail"` (zero residual): skip to Phase 4 (Report) with baseline as post_residual
- Store: `baseline_residual`, `open_debt`, `heatmap`, `issues`, `targets`

Then run Phase 1b (Classify) — existing logic, unchanged.
```

**Phase 1b: Classify** — wrap the entire existing section with a guard:
```
## Phase 1b: Classify (verbose mode only)

Skip this phase when `verboseMode` is false (fast-path produces no classification context).

When `verboseMode` is true:
[... existing classify content unchanged ...]
```

**All other sections (Phase 2, 3, 3a-3c, 4, 5, constraints)** remain UNCHANGED. The convergence loop in Phase 3 already uses direct Bash for re-diagnostic (Step 3b), so it is unaffected.

IMPORTANT: Do NOT modify the Phase 3b re-diagnostic bash command, Phase 4 report dispatch, Phase 5 auto-commit, or any of the Important Constraints. Only Phase 1 and Phase 1b change.

Also update the `argument-hint` in the YAML frontmatter if `--verbose` is not already listed (it is already listed, so just verify it remains).
  </action>
  <verify>
1. `grep -c 'Fast-path' commands/nf/solve.md` returns 1 (fast-path section exists)
2. `grep -c 'verboseMode' commands/nf/solve.md` returns at least 3 (flag extraction + Phase 1 conditional + Phase 1b guard)
3. `grep -c 'Verbose path' commands/nf/solve.md` returns 1 (verbose section exists)
4. `grep 'SKIPPED_FAST_PATH' commands/nf/solve.md` returns a match (fast-path sets this verdict)
5. `grep -c 'solve-diagnose' commands/nf/solve.md` returns at least 1 (verbose path still references solve-diagnose)
6. Phase 3b re-diagnostic bash command is unchanged: `grep 'POST=.*nf-solve.cjs.*--json.*--report-only.*--fast' commands/nf/solve.md` still matches
7. Phase 4, 5, and Important Constraints sections are unchanged (spot check: `grep 'Auto-Commit Artifacts' commands/nf/solve.md` matches)
  </verify>
  <done>
solve.md has conditional Phase 1 dispatch: fast-path (direct Bash to nf-solve.cjs) by default, full Agent path (solve-diagnose.md) when --verbose is passed. Phase 1b Classify is gated to verbose-only. All other phases unchanged.
  </done>
</task>

</tasks>

<verification>
- Read the modified solve.md end-to-end and confirm:
  1. Flag extraction parses --verbose into verboseMode boolean
  2. Phase 1 has two clear branches: fast-path (default) and verbose path (--verbose)
  3. Fast-path calls nf-solve.cjs directly with --json --report-only and sets sensible defaults for omitted fields
  4. Verbose path is identical to the pre-change Agent dispatch
  5. Phase 1b is gated behind verboseMode == true
  6. Phases 2-5 and Important Constraints are untouched
  7. The --verbose flag was already in the argument-hint frontmatter
</verification>

<success_criteria>
- solve.md Phase 1 has a fast-path that calls nf-solve.cjs directly (no Agent dispatch)
- solve.md Phase 1 preserves the full Agent path when --verbose is passed
- Phase 1b (Classify) is skipped in fast-path mode
- All other phases (2, 3, 4, 5) and constraints are unchanged
- The convergence loop re-diagnostic (Phase 3b) is unaffected
</success_criteria>

<output>
After completion, create `.planning/quick/337-fast-path-initial-diagnostic/337-SUMMARY.md`
</output>

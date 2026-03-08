---
phase: quick-221
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - commands/nf/solve-diagnose.md
  - commands/nf/solve-remediate.md
  - commands/nf/solve-report.md
  - commands/nf/solve.md
autonomous: true
requirements: [QUICK-221]
formal_artifacts: none

must_haves:
  truths:
    - "solve.md is under 120 lines and only contains orchestration logic"
    - "Running /nf:solve produces identical diagnostic output and remediation behavior as before"
    - "Each sub-skill can be invoked independently via Agent tool (internal dispatch only — NOT user-invocable via /nf: prefix)"
    - "Each sub-skill output includes a structured status field (ok|bail|error) with reason for orchestrator branching"
    - "The convergence loop (Steps 4-5) remains in the orchestrator"
    - "All 13 remediation dispatches (3a-3m) are preserved in solve-remediate.md"
    - "Report-only gate (--report-only) still works from solve.md"
  artifacts:
    - path: "commands/nf/solve-diagnose.md"
      provides: "Diagnostic phase: Steps 0-1 (migration, config audit, observe, debt, diagnostic sweep, heatmap, classification)"
      min_lines: 200
    - path: "commands/nf/solve-remediate.md"
      provides: "Remediation phase: Steps 3a-3m (all 13 layer remediation dispatches)"
      min_lines: 400
    - path: "commands/nf/solve-report.md"
      provides: "Reporting phase: Steps 6-8 (before/after table, formal detail, gate maturity, quorum context, sensitivity)"
      min_lines: 150
    - path: "commands/nf/solve.md"
      provides: "Thin orchestrator dispatching Agent calls to sub-skills"
      min_lines: 80
  key_links:
    - from: "commands/nf/solve.md"
      to: "commands/nf/solve-diagnose.md"
      via: "Agent tool dispatch"
      pattern: "solve-diagnose"
    - from: "commands/nf/solve.md"
      to: "commands/nf/solve-remediate.md"
      via: "Agent tool dispatch"
      pattern: "solve-remediate"
    - from: "commands/nf/solve.md"
      to: "commands/nf/solve-report.md"
      via: "Agent tool dispatch"
      pattern: "solve-report"
---

<objective>
Refactor the monolithic commands/nf/solve.md (971 lines) into 3 sub-skill files plus a thin orchestrator (~100 lines). This reduces top-level context bloat by ensuring each Agent call loads only the relevant sub-skill into its context window, rather than the entire 971-line file.

Purpose: solve.md currently consumes massive context on every invocation. By decomposing into sub-skills dispatched via Agent tool, each agent only loads the ~200-470 lines relevant to its phase, not the full 971 lines. The orchestrator holds only the convergence loop and dispatch logic.

Output: 4 files — solve-diagnose.md, solve-remediate.md, solve-report.md (new sub-skills), and solve.md (rewritten as thin orchestrator)
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@commands/nf/solve.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create solve-diagnose.md sub-skill (Steps 0-1)</name>
  <files>commands/nf/solve-diagnose.md</files>
  <action>
Create commands/nf/solve-diagnose.md containing the diagnostic phase extracted from solve.md.

**Frontmatter:** Operational frontmatter (NOT full skill routing frontmatter) with name `nf:solve-diagnose`, description about diagnostic sweep, allowed-tools: Read, Write, Edit, Bash, Glob, Grep. Do NOT include Agent or Skill — this sub-skill does not dispatch sub-agents. This is an internal-only sub-skill dispatched by the orchestrator via Agent tool prompts — it is NOT user-invocable via `/nf:solve-diagnose`. It does not need skill routing registration, only operational frontmatter for the Agent to read.

**Content to extract from solve.md (preserve ALL logic exactly):**
- Step 0: Legacy .formal/ Migration (lines ~42-59)
- Step 0b: Config Audit (lines ~61-76)
- Step 0c: Load Observe Targets (lines ~78-100)
- Step 0d: Inline Observe Refresh + Debt Load (lines ~102-159)
- Step 1: Initial Diagnostic Sweep (lines ~161-233) including the residual table format, git churn heatmap, and issue classification

**Execution context block:** Add the same AUTONOMY REQUIREMENT from solve.md. This sub-skill runs fully autonomously.

**Input/Output contract:** The sub-skill receives the same CLI flags as solve.md (--targets, --skip-observe, --json, --verbose). It MUST output a compact JSON result to stdout at the end:
```json
{
  "baseline_residual": { /* full residual_vector from nf-solve.cjs */ },
  "open_debt": [ /* array from readOpenDebt */ ],
  "heatmap": { /* from git-heatmap.cjs */ },
  "issues": { /* from issue-classifier.cjs */ },
  "targets": null | { /* from observe-solve-pipe.cjs */ }
}
```

The orchestrator (solve.md) will read this JSON to pass into solve-remediate.md and for convergence checks.

**Error contract:** The output JSON MUST include a top-level status field for structured bail-out signaling:
```json
{
  "status": "ok" | "bail" | "error",
  "reason": null | "zero_residual" | "diagnostic_script_failed" | "...",
  "baseline_residual": { ... },
  ...
}
```
When `status` is `"bail"` (e.g., zero residual — nothing to remediate), the orchestrator skips remediation and goes straight to reporting. When `status` is `"error"`, the orchestrator logs the reason and exits gracefully.

**CRITICAL:** Preserve every code block, every bash command, every error handling pattern, every log message exactly as written in solve.md. This is a move, not a rewrite. The only additions are the skill frontmatter, the JSON output contract, and adapting the prose to be self-contained (the sub-skill should not reference "Step 3" or "later steps" — it ends after diagnostics).
  </action>
  <verify>
grep -c "Step 0:" commands/nf/solve-diagnose.md && grep -c "Step 1:" commands/nf/solve-diagnose.md && grep "baseline_residual" commands/nf/solve-diagnose.md && wc -l commands/nf/solve-diagnose.md | awk '{if ($1 >= 200) print "OK: "$1" lines"; else print "FAIL: too short ("$1" lines)"}'
  </verify>
  <done>solve-diagnose.md exists with Steps 0-1 fully extracted, JSON output contract defined, 200+ lines, all migration/config/observe/debt/diagnostic/heatmap/classification logic preserved verbatim</done>
</task>

<task type="auto">
  <name>Task 2: Create solve-remediate.md and solve-report.md sub-skills</name>
  <files>commands/nf/solve-remediate.md, commands/nf/solve-report.md</files>
  <action>
**Part A — Create commands/nf/solve-remediate.md (Steps 3a-3m):**

Frontmatter: Operational frontmatter (internal-only, NOT user-invocable) with name `nf:solve-remediate`, allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent, Skill (it dispatches /nf:close-formal-gaps, /nf:fix-tests, /nf:quick, and nf-executor agents). Like solve-diagnose, this sub-skill is dispatched by the orchestrator via Agent tool prompts and does not need full skill routing registration.

Content to extract from solve.md (preserve ALL logic exactly):
- Step 3 intro paragraph about dependency ordering (lines ~244-258, debt transition logic)
- Step 3a: R->F Gaps (lines ~262-286)
- Step 3b: F->T Gaps (lines ~288-406) — this is the largest section with the bulk executor dispatch pattern
- Step 3c: T->C Gaps (lines ~408-424)
- Step 3d: C->F Gaps (lines ~426-447)
- Step 3e: F->C Gaps (lines ~448-488)
- Step 3f: R->D Gaps (lines ~490-529)
- Step 3g: D->C Gaps (lines ~531-548)
- Step 3h: Git Heatmap Risk Prioritization (lines ~550-578)
- Step 3i: Reverse Traceability Discovery (lines ~580-633)
- Step 3j: Hazard Model Refresh (lines ~635-645)
- Step 3k: Gate A Remediation (lines ~647-668)
- Step 3l: Gate B Remediation (lines ~670-691)
- Step 3m: Gate C Remediation (lines ~693-724)

Input contract: The sub-skill receives a JSON object (passed as argument or read from a temp file):
```json
{
  "residual_vector": { /* from diagnostic sweep */ },
  "open_debt": [ /* from debt load */ ],
  "heatmap": { /* from heatmap analysis */ },
  "targets": null | { /* observe targets */ },
  "iteration": 1
}
```

Output contract: Returns JSON:
```json
{
  "status": "ok" | "bail" | "error",
  "reason": null | "convergence_stall" | "all_layers_skipped" | "...",
  "remediation_report": {
    "dispatched": [ /* list of { layer, skill, status } */ ],
    "skipped": [ /* layers with 0 residual */ ],
    "failed": [ /* dispatches that errored */ ]
  }
}
```
When `status` is `"bail"` (e.g., all layers skipped or convergence stall detected), the orchestrator breaks the loop early. When `status` is `"error"`, the orchestrator logs the reason and exits gracefully.

Execution context: Same AUTONOMY REQUIREMENT + RAM BUDGET (3 concurrent Tasks max) from solve.md.

Each of the 13 remediation steps (3a-3m) should be dispatched as its own Agent call internally within solve-remediate to prevent context accumulation. Add a wrapper pattern at the top:
```
For each gap type with residual > 0, dispatch an Agent call to handle that specific remediation.
Each Agent call receives only the relevant residual detail and returns a compact status.
```

**Part B — Create commands/nf/solve-report.md (Steps 6-8):**

Frontmatter: Operational frontmatter (internal-only, NOT user-invocable) with name `nf:solve-report`, allowed-tools: Read, Bash, Glob, Grep. No Write/Edit needed — reporting is read-only display. Like the other sub-skills, dispatched by the orchestrator via Agent tool prompts only.

Content to extract from solve.md:
- Step 6: Before/After Summary (lines ~777-848) — the full comparison table, detail expansion rules, cross-layer dashboard
- State Candidate Discovery (lines ~850-858)
- Step 7: Full Formal Verification Detail Table (lines ~860-901)
- Step 8: Post-Convergence Actions (lines ~903-944) — gate maturity, quorum context, sensitivity sweep

Input contract: Receives JSON:
```json
{
  "baseline_residual": { /* from initial diagnostic */ },
  "post_residual": { /* from re-diagnostic */ },
  "iteration_count": N,
  "flags": { "verbose": bool, "json": bool }
}
```

Output: Formatted terminal output (no JSON return needed — this is display-only). Error contract: if reporting fails (e.g., missing residual data), write a structured error to stderr `{"status": "error", "reason": "..."}` and exit gracefully so the orchestrator can surface it.

**CRITICAL for both files:** Preserve every code block, bash command, error handling pattern, table format, log message, and constraint note exactly as in solve.md. Also preserve the "Important Constraints" section (lines ~948-971) — split relevant constraints into each sub-skill. Constraints 1-3 go in orchestrator, constraint 4 (ordering) goes in solve-remediate, constraints 5-8 go in solve-remediate.
  </action>
  <verify>
echo "--- solve-remediate.md ---" && wc -l commands/nf/solve-remediate.md | awk '{if ($1 >= 400) print "OK: "$1" lines"; else print "FAIL: too short ("$1" lines)"}' && grep -c "3a\.\|3b\.\|3c\.\|3d\.\|3e\.\|3f\.\|3g\.\|3h\.\|3i\.\|3j\.\|3k\.\|3l\.\|3m\." commands/nf/solve-remediate.md && echo "--- solve-report.md ---" && wc -l commands/nf/solve-report.md | awk '{if ($1 >= 150) print "OK: "$1" lines"; else print "FAIL: too short ("$1" lines)"}' && grep "Before/After\|Formal Verification Detail\|Gate Maturity" commands/nf/solve-report.md
  </verify>
  <done>solve-remediate.md has all 13 remediation steps (3a-3m) with Agent-per-layer dispatch pattern, 400+ lines. solve-report.md has Steps 6-8 with all table formats and post-convergence actions, 150+ lines. All logic preserved verbatim from solve.md.</done>
</task>

<task type="auto">
  <name>Task 3: Rewrite solve.md as thin orchestrator</name>
  <files>commands/nf/solve.md</files>
  <action>
Rewrite commands/nf/solve.md to be a thin orchestrator (~100 lines) that dispatches Agent calls to the 3 sub-skills. The orchestrator retains ONLY:

**Keep in solve.md:**
1. Frontmatter (same as current — name, description, argument-hint, allowed-tools including Agent)
2. Objective (condensed to ~3 lines referencing sub-skill decomposition)
3. Execution context (AUTONOMY REQUIREMENT, RAM BUDGET — kept for the orchestrator's own behavior)
4. **Step 2: Report-only gate (--report-only check, ~5 lines) — this gate stays in the orchestrator, NOT in any sub-skill. It runs after Phase 1 (diagnose) returns and before Phase 2 (remediate) begins.**
5. Step 4: Re-diagnostic sweep (~5 lines — just the bash command and JSON parse)
6. Step 5: Convergence check (~20 lines — compare totals, iteration loop logic, debt resolution)
7. Agent dispatch logic (~30 lines)
8. Error handling: orchestrator reads `status` field from each sub-skill's output JSON and branches on `"ok"` / `"bail"` / `"error"` accordingly

**Orchestrator flow (the core of the rewrite):**

```markdown
## Orchestration Flow

### Phase 1: Diagnose
Dispatch Agent to run solve-diagnose:
- Pass: all CLI flags (--targets, --skip-observe, --json, --verbose)
- Read: the compact JSON result (includes `status` field)
- If `status` == `"error"`: log reason, exit gracefully
- If `status` == `"bail"` (zero residual): skip to Phase 3 (Report)
- Store: baseline_residual, open_debt, heatmap, targets

### Report-Only Gate
If --report-only: display baseline table from diagnose output and STOP.
(This gate lives in the orchestrator, not in any sub-skill.)

### Phase 2: Remediate (loop)
For iteration = 1 to max_iterations (default 5):

  Dispatch Agent to run solve-remediate:
  - Pass: residual_vector, open_debt, heatmap, targets, iteration number
  - Read: remediation output JSON (includes `status` field)
  - If `status` == `"bail"` or `"error"`: break loop, proceed to Report

  Re-diagnose (Step 4): run nf-solve.cjs --json --report-only
  Parse post_residual.

  Convergence check (Step 5):
  - If post_residual.total == 0: break
  - Compute automatable_residual (exclude d_to_c)
  - If automatable_residual == 0 OR no layer changed: break
  - Else: update residual_vector = post_residual, continue loop

### Phase 3: Report
Dispatch Agent to run solve-report:
- Pass: baseline_residual, post_residual, iteration_count, flags

### Phase 4: Session Persistence
(Keep the existing session persistence logic if any — check if solve.md currently has it at the end)
```

**Important constraints to keep in solve.md (from lines 948-971):**
- Constraint 1: bin/nf-solve.cjs is NOT modified
- Constraint 2: Convergence loop is at skill level
- Constraint 3: Error handling — each dispatch wrapped in error handling
- Constraint 6: Cascade awareness note
- Constraint 7: Reverse flows are discovery-only (affects convergence check)

**Reference the sub-skill files explicitly:**
```
@commands/nf/solve-diagnose.md
@commands/nf/solve-remediate.md
@commands/nf/solve-report.md
```

**CRITICAL:** The rewritten solve.md must be under 120 lines. It should feel like a dispatch table, not a process document. All implementation detail lives in the sub-skills.

**Session persistence:** Check if the current solve.md references session persistence (from quick-220). If so, keep that logic in the orchestrator (it runs after reporting).
  </action>
  <verify>
wc -l commands/nf/solve.md | awk '{if ($1 <= 120) print "OK: "$1" lines"; else print "WARNING: "$1" lines (target <=120)"}' && grep "solve-diagnose" commands/nf/solve.md && grep "solve-remediate" commands/nf/solve.md && grep "solve-report" commands/nf/solve.md && grep "Agent" commands/nf/solve.md && grep "convergence\|Convergence" commands/nf/solve.md
  </verify>
  <done>solve.md is under 120 lines, dispatches Agent calls to solve-diagnose/solve-remediate/solve-report, retains convergence loop and report-only gate, references all 3 sub-skills</done>
</task>

</tasks>

<verification>
1. `wc -l commands/nf/solve.md` — must be under 120 lines
2. `wc -l commands/nf/solve-diagnose.md` — must be 200+ lines
3. `wc -l commands/nf/solve-remediate.md` — must be 400+ lines
4. `wc -l commands/nf/solve-report.md` — must be 150+ lines
5. Combined line count of all 4 files should be roughly similar to original 971 lines (some overhead for frontmatter/contracts, but no logic should be lost)
6. `grep -r "Step 0\|Step 1\|Step 3\|Step 4\|Step 5\|Step 6\|Step 7\|Step 8" commands/nf/solve*.md` — all steps accounted for across files
7. `grep "nf-solve.cjs" commands/nf/solve-diagnose.md` — diagnostic script referenced in diagnose sub-skill
8. `grep "close-formal-gaps\|fix-tests\|nf:quick" commands/nf/solve-remediate.md` — remediation dispatches preserved
9. `grep "check-results.ndjson\|cross-layer-dashboard\|promote-gate-maturity" commands/nf/solve-report.md` — reporting tools preserved
</verification>

<success_criteria>
- solve.md reduced from 971 lines to under 120 lines (thin orchestrator)
- All diagnostic logic (Steps 0-1) preserved in solve-diagnose.md
- All 13 remediation dispatches (Steps 3a-3m) preserved in solve-remediate.md
- All reporting logic (Steps 6-8) preserved in solve-report.md
- Convergence loop (Steps 4-5) retained in orchestrator
- Report-only gate retained in orchestrator
- Each sub-skill has clear JSON input/output contracts with structured error/bail status fields
- Sub-skills use operational frontmatter only (internal dispatch, not user-invocable)
- Report-only gate (Step 2) explicitly owned by orchestrator
- No logic lost — total content across 4 files covers everything in original solve.md
</success_criteria>

<output>
After completion, create `.planning/quick/221-refactor-nf-solve-into-sub-skills-to-red/221-SUMMARY.md`
</output>

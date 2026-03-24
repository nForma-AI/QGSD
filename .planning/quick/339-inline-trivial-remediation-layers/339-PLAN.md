---
phase: quick-339
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/solve-inline-dispatch.cjs
  - bin/solve-inline-dispatch.test.cjs
  - commands/nf/solve.md
  - commands/nf/solve-remediate.md
autonomous: true
formal_artifacts: none
requirements: [QUICK-339]

must_haves:
  truths:
    - "Orchestrator pre-runs hazard_model and d_to_c before dispatching remediation Agent"
    - "Remediation Agent skips hazard_model and d_to_c when --skip-inline-layers flag is present"
    - "solve-inline-dispatch.cjs returns structured JSON with layer results"
    - "Pre-run gate scripts (test-recipe-gen, gate-c-validation) for l3_to_tc feed results to Agent so it skips re-running them"
  artifacts:
    - path: "bin/solve-inline-dispatch.cjs"
      provides: "Pre-run trivial layers + gate script pre-computation"
      exports: ["main"]
    - path: "bin/solve-inline-dispatch.test.cjs"
      provides: "Tests for inline dispatch script"
  key_links:
    - from: "commands/nf/solve.md"
      to: "bin/solve-inline-dispatch.cjs"
      via: "Bash node call in Phase 3a before Agent dispatch"
      pattern: "solve-inline-dispatch"
    - from: "commands/nf/solve-remediate.md"
      to: "skip-inline-layers"
      via: "Flag check at top of inline layer sections"
      pattern: "skip-inline-layers"
  consumers:
    - artifact: "bin/solve-inline-dispatch.cjs"
      consumed_by: "commands/nf/solve.md"
      integration: "Bash call in Phase 3a before Agent dispatch"
      verify_pattern: "solve-inline-dispatch"
---

<objective>
Inline trivial remediation layers to avoid burning an Agent dispatch for work that requires no Agent tools. Create bin/solve-inline-dispatch.cjs that the orchestrator (solve.md) calls before the remediation Agent to pre-run hazard_model refresh, d_to_c display, and l3_to_tc gate scripts. The remediation Agent then skips these pre-handled layers.

Purpose: Reduce Agent spawn overhead by ~15-30s per remediation iteration for layers that are just bash commands or display-only.
Output: bin/solve-inline-dispatch.cjs, updated solve.md Phase 3a, updated solve-remediate.md with skip-inline-layers awareness.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@commands/nf/solve.md
@commands/nf/solve-remediate.md
@bin/solve-wave-dag.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create bin/solve-inline-dispatch.cjs with tests</name>
  <files>bin/solve-inline-dispatch.cjs, bin/solve-inline-dispatch.test.cjs</files>
  <action>
Create bin/solve-inline-dispatch.cjs — a Node.js script that pre-runs trivial remediation layers.

**Input:** Takes residual_vector JSON via stdin (piped) or --input=path file arg. Also accepts --project-root=path (default cwd).

**Output:** JSON to stdout with structure:
```json
{
  "inline_results": {
    "hazard_model": { "status": "ok"|"skipped"|"error", "summary": "...", "total_hazards": N, "high_rpn_count": N },
    "d_to_c": { "status": "ok"|"skipped", "summary": "...", "broken_claims_count": N, "table": "..." },
    "l3_to_tc_preflight": { "status": "ok"|"skipped"|"error", "summary": "...", "unvalidated_after_regen": N }
  },
  "skip_layers": ["hazard_model", "d_to_c"],
  "preflight_data": {
    "l3_to_tc_unvalidated": N
  }
}
```

**Layer logic:**

1. **hazard_model** (always run if residual_vector.hazard_model exists):
   - Use portable path resolution: `const _nfBin = (n) => { const p = require('path').join(require('os').homedir(), '.claude/nf-bin', n); return require('fs').existsSync(p) ? p : './bin/' + n; };`
   - Run hazard-model.cjs --json via require('child_process').execFileSync (NOT exec/execSync — use execFileSync with array args to avoid shell injection per codebase convention)
   - Parse JSON output, extract total_hazards and high_rpn_count
   - On failure: status "error", continue (fail-open)
   - Add "hazard_model" to skip_layers array on success

2. **d_to_c** (run if residual_vector.d_to_c.residual > 0):
   - Extract broken_claims from residual_vector.d_to_c.detail.broken_claims
   - Format the display table (same format as solve-remediate.md section 3g)
   - This is display-only — no mutation, no Agent needed
   - Add "d_to_c" to skip_layers array (always — it is never Agent-dispatched)

3. **l3_to_tc_preflight** (run if residual_vector.l3_to_tc.residual > 0):
   - Run test-recipe-gen.cjs via execFileSync to regenerate test recipes
   - Run gate-c-validation.cjs --json via execFileSync to get updated gap count
   - Store unvalidated_after_regen count in preflight_data
   - Do NOT add l3_to_tc to skip_layers (it still needs Agent for /nf:quick dispatch if gaps remain)
   - On failure of either script: status "error", continue (fail-open)

**Error handling:** Wrap each layer in try/catch. Never let one layer failure prevent others from running. Exit 0 always (fail-open). Errors reported in the JSON output per-layer.

**Test file (bin/solve-inline-dispatch.test.cjs):**
- Test with zero residual (all layers skipped)
- Test with hazard_model residual > 0 (mock execFileSync to return hazard JSON)
- Test with d_to_c residual > 0 and broken_claims array
- Test with l3_to_tc residual > 0 (mock gate scripts)
- Test error handling (mock script failures)
- Test --input=path file loading
- Use the same test patterns as bin/solve-debt-bridge.test.cjs for mocking child_process
  </action>
  <verify>
Run: `node bin/solve-inline-dispatch.test.cjs` — all tests pass.
Run: `echo '{"hazard_model":{"residual":0},"d_to_c":{"residual":0},"l3_to_tc":{"residual":0}}' | node bin/solve-inline-dispatch.cjs` — outputs valid JSON with all layers skipped.
Verify the script uses execFileSync (not exec/execSync) and portable _nfBin path resolution.
  </verify>
  <done>
bin/solve-inline-dispatch.cjs accepts residual_vector JSON, pre-runs hazard_model refresh + d_to_c display + l3_to_tc gate preflight, returns structured JSON with results and skip_layers list. All tests pass.
  </done>
</task>

<task type="auto">
  <name>Task 2: Wire inline dispatch into solve.md and add skip awareness to solve-remediate.md</name>
  <files>commands/nf/solve.md, commands/nf/solve-remediate.md</files>
  <action>
**Part A — Modify commands/nf/solve.md Phase 3a:**

Insert a new step between the current "3a. Dispatch remediation" heading and the Agent call. The new step runs the inline dispatch script BEFORE the Agent:

Add a "3a-pre. Pre-run inline layers:" step that:
- Writes the residual_vector JSON to a temp file
- Runs: `node ~/.claude/nf-bin/solve-inline-dispatch.cjs --input=/tmp/nf-solve-residual.json --project-root=$(pwd)`
- Falls back to `bin/solve-inline-dispatch.cjs` if nf-bin path does not exist
- On failure: defaults to `{"inline_results":{},"skip_layers":[],"preflight_data":{}}`
- Parses JSON output, displays any d_to_c table from inline_results.d_to_c.table, logs hazard_model summary if present
- Stores skip_layers and preflight_data for forwarding to Agent

Then modify the existing Agent prompt in 3a to add skip context:
- Add to the JSON input: `"skip_inline_layers": [...skip_layers], "preflight_data": {...preflight_data}`
- This tells the remediation Agent which layers are already handled

Keep the existing Agent dispatch structure unchanged. The only modification is: (1) the new pre-step, (2) the additional fields in the JSON input to the Agent.

**Part B — Modify commands/nf/solve-remediate.md:**

1. In the input_contract section (around line 38-48), add two new optional fields to the JSON schema:
   - `"skip_inline_layers": ["hazard_model", "d_to_c"]` — layers already handled by orchestrator
   - `"preflight_data": { "l3_to_tc_unvalidated": N }` — pre-computed gate results

2. In the wave dispatch loop (around line 131-142), add a check at step 3 (inline layers):
   Replace the instruction about inline layers with:
   "For **inline layers** (d_to_c, hazard_model): if layer is in `skip_inline_layers` input array, log `"{layer}: already handled by orchestrator inline dispatch -- skipping"` and record as dispatched with status "skipped-inline". Otherwise, execute the section directly as before."

3. In section 3g (D->C Gaps, around line 499-516): Add a skip check at the top:
   "If `d_to_c` is in `skip_inline_layers`: Log `"D->C: skipped (handled by orchestrator inline dispatch)"` and return `{"layer": "d_to_c", "status": "skipped-inline"}`. Do NOT display the table again."

4. In section 3j (Hazard Model Refresh, around line 600-610): Add a skip check at the top:
   "If `hazard_model` is in `skip_inline_layers`: Log `"Hazard model: skipped (handled by orchestrator inline dispatch)"` and return `{"layer": "hazard_model", "status": "skipped-inline"}`. Do NOT re-run hazard-model.cjs."

5. In section 3m (Gate C, around line 651-682): Add a preflight check:
   "If `preflight_data.l3_to_tc_unvalidated` is present and is a number, skip the test-recipe-gen.cjs and gate-c-validation.cjs runs. Use the preflight value directly as unvalidated_count. Log `"Gate C: using preflight data (unvalidated={N}) -- skipping gate script re-runs"`. Still dispatch /nf:quick if unvalidated > 0."

All modifications use the existing fail-open pattern — if skip_inline_layers is missing or not an array, treat as empty (backward compatible with older orchestrator versions).
  </action>
  <verify>
Verify solve.md: `grep 'solve-inline-dispatch' commands/nf/solve.md` returns match in Phase 3a.
Verify solve.md: `grep 'skip_inline_layers' commands/nf/solve.md` returns match in the Agent prompt JSON.
Verify solve-remediate.md: `grep 'skip_inline_layers' commands/nf/solve-remediate.md` returns matches in input_contract, wave loop, 3g, and 3j sections.
Verify solve-remediate.md: `grep 'preflight_data' commands/nf/solve-remediate.md` returns matches in input_contract and 3m section.
Verify backward compat: solve-remediate.md has fail-open guard for missing skip_inline_layers.
  </verify>
  <done>
solve.md Phase 3a calls solve-inline-dispatch.cjs before the remediation Agent and forwards skip_layers + preflight_data. solve-remediate.md skips hazard_model and d_to_c when told they are pre-handled, and uses preflight gate data for l3_to_tc. All changes are backward compatible.
  </done>
</task>

</tasks>

<verification>
1. `node bin/solve-inline-dispatch.test.cjs` — all tests pass
2. `grep 'solve-inline-dispatch' commands/nf/solve.md` — wired into Phase 3a
3. `grep 'skip_inline_layers' commands/nf/solve-remediate.md` — skip awareness in input_contract + 3 layer sections
4. `grep 'preflight_data' commands/nf/solve-remediate.md` — preflight in input_contract + 3m
5. No modifications to bin/nf-solve.cjs (constraint respected)
</verification>

<success_criteria>
- bin/solve-inline-dispatch.cjs exists and passes all tests
- solve.md pre-runs inline layers before Agent dispatch in Phase 3a
- solve-remediate.md skips pre-handled layers when skip_inline_layers is provided
- solve-remediate.md uses preflight gate data for l3_to_tc when available
- All changes are backward compatible (missing fields default to empty/no-op)
</success_criteria>

<output>
After completion, create `.planning/quick/339-inline-trivial-remediation-layers/339-SUMMARY.md`
</output>

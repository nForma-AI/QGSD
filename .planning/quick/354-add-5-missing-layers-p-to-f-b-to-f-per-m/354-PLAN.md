---
phase: quick-354
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - commands/nf/solve-report.md
autonomous: true
requirements: []
user_setup: []

must_haves:
  truths:
    - "Table renderer displays all 20 LAYER_KEYS from layer-constants.cjs"
    - "Each missing layer (p_to_f, b_to_f, per_model_gates, git_history, formal_lint) appears in the before/after table with name and description"
    - "Layers are grouped in correct sections (Forward, Reverse Discovery, Alignment, Informational Signals)"
    - "Table still parses residual data correctly and displays delta/status columns"
  artifacts:
    - path: commands/nf/solve-report.md
      provides: "Render all 20 LAYER_KEYS in before/after table, not hardcoded 15"
      contains: "p_to_f, b_to_f, per_model_gates, git_history, formal_lint"
  key_links:
    - from: "commands/nf/solve-report.md"
      to: "bin/layer-constants.cjs"
      via: "Table references LAYER_KEYS canonical array"
      pattern: "Per LAYER_KEYS array"
  consumers:
    - artifact: "commands/nf/solve-report.md"
      consumed_by: "/nf:solve orchestrator"
      integration: "Agent prompt dispatch in nf-prompt.js"
      verify_pattern: "nf:solve-report internal dispatch"
---

<objective>
Update solve-report.md table renderer to display all 20 layers from LAYER_KEYS canonical array instead of hardcoded 15 rows.

Purpose: Verify all formal model diagnostic layers in the before/after table, including production/bug analysis and per-model gate scores.

Output: Updated solve-report.md with complete table covering all 20 layers
</objective>

<execution_context>
@.planning/quick/354-add-5-missing-layers-p-to-f-b-to-f-per-m/354-PLAN.md
</execution_context>

<context>
@.planning/STATE.md
@bin/layer-constants.cjs — Source of truth for 20 LAYER_KEYS
@commands/nf/solve-report.md — File to modify
</context>

<tasks>

<task type="auto">
  <name>Add 5 missing layers to before/after table in Step 6</name>
  <files>commands/nf/solve-report.md</files>
  <action>
Update the table in Step 6 (Before/After Summary, starting at line 59) to render all 20 LAYER_KEYS from bin/layer-constants.cjs instead of hardcoded 15 rows.

Current table shows 18 rows (counts hardcoded). Needs to add these 5 missing layers:

1. **p_to_f (Production → Formal)** — Already listed at line 68, KEEP IN PLACE
2. **b_to_f (Bug → Formal)** — Add after P->F line, in Forward section. Short name: "B -> F", display: "Bug->Formal"
3. **per_model_gates (Per-Model Gate Scores)** — Add in Informational Signals section (after current git layers). Short name: "PMG", display: "Per-Model Gates"
4. **git_history (Git History Trends)** — Already shown as "GitHist (TLA+ drift)" at line 82, VERIFY this line exists and references git_history correctly
5. **formal_lint (Formal Model Lint)** — Add in Informational Signals section (after per_model_gates). Short name: "F-Lint", display: "Formal Model Lint"

Additionally, verify h_to_m and hazard_model are included as the last two signal rows before the Grand total.

**Reference mapping (from LAYER_KEYS in bin/layer-constants.cjs):**
```
'r_to_f', 'f_to_t', 'c_to_f', 't_to_c', 'f_to_c',  // Forward 1
'r_to_d', 'd_to_c', 'p_to_f', 'c_to_r', 't_to_r',  // Forward 2 (includes p_to_f at position 8)
'd_to_r', 'l1_to_l3', 'l3_to_tc',                   // Alignment
'per_model_gates', 'git_heatmap', 'git_history',   // Signals 1
'formal_lint', 'hazard_model', 'h_to_m',           // Signals 2
'b_to_f',                                          // Bug analysis (20th)
```

**Updated table structure:**
- Lines 61-68: Forward section (r_to_f through d_to_c) — 7 layers
- Line 68: P -> F — EXISTING
- NEW Line 69: B -> F (bug_to_formal) — INSERT HERE
- Line 70: Forward subtotal
- Lines 71-73: Reverse Discovery (c_to_r, t_to_r, d_to_r) — 3 layers
- Line 74: Discovery subtotal
- Lines 75-79: Layer Alignment (l1_to_l3, l3_to_tc, VERIFY gate naming) — 3 layers
- Line 80: Alignment subtotal
- Lines 81-86: Informational Signals section — ADD per_model_gates, git_heatmap, git_history, formal_lint, hazard_model, h_to_m (6 signal rows)
- Line 87: Signal count subtotal
- Line 88: Grand total

**Action details:**
1. After line 68 (P -> F), insert: `B -> F (Bug->Formal)        {N}    {M}    {delta}   [status]`
2. In the Informational Signals section (currently lines 81-84), expand to include all 6 signal layers:
   - G -> H (Git Heatmap)
   - GitHist (TLA+ drift) [verify this references git_history correctly]
   - PMG (Per-Model Gates) — NEW
   - Formal-Lint (Formal Model Lint) — NEW
   - Hazard (FMEA high-RPN)
   - H -> M (Hazard->Model) — VERIFY exists
3. Update section separators and subtotal labels if needed
4. Keep all {N}, {M}, {delta} and [status]/[signal] placeholders — these are filled at render time
5. Ensure line references in later steps (Step 7, Step 8) still point to correct sections
  </action>
  <verify>
1. Read commands/nf/solve-report.md and confirm all 20 layer names appear in the table:
   - r_to_f, f_to_t, c_to_f, t_to_c, f_to_c
   - r_to_d, d_to_c, p_to_f, b_to_f
   - c_to_r, t_to_r, d_to_r
   - l1_to_l3, l3_to_tc
   - per_model_gates, git_heatmap, git_history, formal_lint, hazard_model, h_to_m

2. Count table data rows (excluding subtotals and separators): should be 20 rows total

3. Grep for "b_to_f" or "Bug->Formal" to confirm b_to_f added

4. Grep for "per_model_gates" or "Per-Model" to confirm per_model_gates added

5. Grep for "formal_lint" or "Formal-Lint" or "Formal Model Lint" to confirm formal_lint added

6. Verify section structure:
   - Forward Discovery section clearly marked
   - Reverse Discovery section clearly marked
   - Layer Alignment section clearly marked
   - Informational Signals section clearly marked
   - Each section has a subtotal row
   - Grand total row at the end

7. Verify placeholder syntax unchanged: all {N}, {M}, {delta}, [status], [signal] placeholders still present and in correct columns
  </verify>
  <done>
All 20 layers from LAYER_KEYS appear in before/after table grouped by section. Table structure matches canonical layer array. Render placeholders intact.
  </done>
</task>

</tasks>

<verification>
After completing the task:

1. The table in Step 6 should display all 20 LAYER_KEYS from bin/layer-constants.cjs in order
2. No layer names should be duplicated
3. Section headers (Forward, Reverse, Alignment, Signals) should clearly delineate logical groups
4. Subtotal and Grand total rows should be present and correctly labeled
5. All placeholder columns ({N}, {M}, {delta}, [status]/[signal]) should be intact
</verification>

<success_criteria>
- commands/nf/solve-report.md updated with all 20 layer rows in the before/after table
- Missing layers (b_to_f, per_model_gates, formal_lint) now appear with descriptive names
- Table structure groups layers logically by section
- All verify checks pass
- No syntax errors in markdown (table alignment, placeholder references)
</success_criteria>

<output>
After completion, create `.planning/quick/354-add-5-missing-layers-p-to-f-b-to-f-per-m/354-SUMMARY.md` containing:
- Which 5 layers were added/verified
- Line numbers where they appear in the updated table
- Confirmation that all 20 LAYER_KEYS are now rendered
</output>

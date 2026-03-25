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
    - "Each missing layer (b_to_f, per_model_gates, formal_lint) appears in the before/after table with name and description"
    - "Alignment section shows exactly 2 gate rows (l1_to_l3, l3_to_tc) — L2 collapsed per STRUCT-01"
    - "Signals section shows exactly 6 signal rows (per_model_gates, git_heatmap, git_history, formal_lint, hazard_model, h_to_m)"
    - "Layers are grouped in correct sections (Forward, Reverse Discovery, Alignment, Signals)"
    - "Table still parses residual data correctly and displays delta/status columns"
  artifacts:
    - path: commands/nf/solve-report.md
      provides: "Render all 20 LAYER_KEYS in before/after table, not hardcoded 15"
      contains: "p_to_f, b_to_f, per_model_gates, git_history, formal_lint, h_to_m, hazard_model"
  key_links:
    - from: "commands/nf/solve-report.md"
      to: "bin/layer-constants.cjs"
      via: "Table references LAYER_KEYS canonical array"
      pattern: "Per LAYER_KEYS array of 20 keys"
  consumers:
    - artifact: "commands/nf/solve-report.md"
      consumed_by: "/nf:solve orchestrator"
      integration: "Agent prompt dispatch in nf-prompt.js"
      verify_pattern: "nf:solve-report internal dispatch"
---

<objective>
Update solve-report.md table renderer to display all 20 layers from LAYER_KEYS canonical array instead of current 17 rows, with correct alignment section (2 gates, not 3) and complete signals section (6 rows, not 3).

Purpose: Verify all formal model diagnostic layers in the before/after table, including production/bug analysis and per-model gate scores, with accurate gate alignment matching STRUCT-01 L2 collapse.

Output: Updated solve-report.md with complete table covering all 20 layers, properly aligned.
</objective>

<execution_context>
@.planning/quick/354-add-5-missing-layers-p-to-f-b-to-f-per-m/354-PLAN.md
</execution_context>

<context>
@.planning/STATE.md
@bin/layer-constants.cjs — Source of truth for 20 LAYER_KEYS (2 alignment keys, 6 signal keys)
@commands/nf/solve-report.md — File to modify (currently 17 data rows, needs adjustment to 20)
</context>

<tasks>

<task type="auto">
  <name>Update table structure and layer mappings in before/after summary</name>
  <files>commands/nf/solve-report.md</files>
  <action>
Revision targets:

1. **LAYER_KEY → Display Name Mapping (Complete 20-Key Registry)**
   Add this mapping as a comment block above or within Step 6 for reference:

   Forward Discovery (8 layers):
   - r_to_f → "R -> F (Req->Formal)"
   - f_to_t → "F -> T (Formal->Test)"
   - c_to_f → "C -> F (Code->Formal)"
   - t_to_c → "T -> C (Test->Code)"
   - f_to_c → "F -> C (Formal->Code)"
   - r_to_d → "R -> D (Req->Docs)"
   - d_to_c → "D -> C (Docs->Code)"
   - p_to_f → "P -> F (Prod->Formal)"

   Reverse Discovery (3 layers):
   - c_to_r → "C -> R (Code->Req)"
   - t_to_r → "T -> R (Test->Req)"
   - d_to_r → "D -> R (Docs->Req)"

   Alignment (2 layers — L2 collapsed per STRUCT-01):
   - l1_to_l3 → "L1 -> L3 (Gate A)"
   - l3_to_tc → "L3 -> TC (Gate C)"

   Informational Signals (6 layers):
   - per_model_gates → "PMG (Per-Model Gates)"
   - git_heatmap → "G -> H (Git Heatmap)"
   - git_history → "GitHist (TLA+ drift)"
   - formal_lint → "F-Lint (Formal Model Lint)"
   - hazard_model → "Hazard (FMEA high-RPN)"
   - h_to_m → "H -> M (Hazard->Model)"

   Bug Analysis (1 layer):
   - b_to_f → "B -> F (Bug->Formal)"

2. **Fix Alignment Section (Issue #1)**
   Current table at lines 75-79 shows 3 gate rows. CORRECT to 2 rows:
   - REMOVE "L2 -> L3 (Gate B)" line entirely (L2 collapsed — Gate A (l1_to_l3) evaluates L1→L3 directly)
   - RENAME "L1 -> L2 (Gate A)" to "L1 -> L3 (Gate A)" (matches l1_to_l3 key)
   - KEEP "L3 -> TC (Gate C)" as-is
   Result: 2 gate rows instead of 3.

3. **Expand Signals Section (Issue #2)**
   Current table at lines 81-84 shows only 3 signal rows. EXPAND to 6 rows:
   - Existing: "G -> H (Git Heatmap)", "GitHist (TLA+ drift)", "Hazard (FMEA high-RPN)"
   - Add (in this order):
     a. "PMG (Per-Model Gates)" — BEFORE git_heatmap
     b. "F-Lint (Formal Model Lint)" — AFTER git_history
     c. "H -> M (Hazard->Model)" — AFTER hazard_model

   New Signals section (6 rows):
   ```
   PMG (Per-Model Gates)         {N}    {M}    {delta}   [signal]
   G -> H (Git Heatmap)          {N}    {M}    {delta}   [signal]
   GitHist (TLA+ drift)          {N}    {M}    {delta}   [signal]
   F-Lint (Formal Model Lint)    {N}    {M}    {delta}   [signal]
   Hazard (FMEA high-RPN)        {N}    {M}    {delta}   [signal]
   H -> M (Hazard->Model)        {N}    {M}    {delta}   [signal]
   ```

4. **Add Bug Analysis Row (Issue #2 — b_to_f)**
   After the "P -> F (Prod->Formal)" row (line 68), add:
   ```
   B -> F (Bug->Formal)          {N}    {M}    {delta}   [status]
   ```
   This is part of Forward Discovery (brings total to 8 forward rows instead of 7).

5. **Update Section Subtotal Labels**
   - Forward subtotal: Now sums 8 rows (after adding B -> F), not 7
   - Alignment subtotal: Now sums 2 rows (after removing Gate B), not 3
   - Signal count: Now sums 6 rows (after adding PMG, F-Lint, H -> M), not 3
   - Grand total: Verify final row count is 20 layers (8+3+2+6+1=20) ✓

6. **Verify Line References in Later Steps**
   After making table edits:
   - Step 6 detail expansions (lines 89-111) may shift — verify they reference correct layer names and sections
   - Step 7 formal verification detail (line 195+) is independent, no changes needed
   - Step 8 post-convergence (line 238+) is independent, no changes needed

**Action Summary:**
- Correct Alignment from 3→2 gates (remove L2 gate row, rename L1->L2 to L1->L3)
- Expand Signals from 3→6 rows (add PMG, F-Lint, H->M in order)
- Add B -> F row to Forward section
- Update all subtotal row sums and Grand total to reflect 20 layers
- Preserve all {N}, {M}, {delta}, [status], [signal] placeholders
  </action>
  <verify>
1. Read commands/nf/solve-report.md and confirm Section structure:

   **Forward Discovery Section:** 8 rows
   - R -> F, F -> T, C -> F, T -> C, F -> C, R -> D, D -> C, P -> F
   - NEW: B -> F row added after P -> F

   **Reverse Discovery Section:** 3 rows
   - C -> R, T -> R, D -> R

   **Layer Alignment Section:** 2 rows (NOT 3)
   - L1 -> L3 (Gate A) — RENAMED from "L1 -> L2"
   - L3 -> TC (Gate C)
   - NO "L2 -> L3 (Gate B)" row

   **Informational Signals Section:** 6 rows (NOT 3)
   - PMG (Per-Model Gates)
   - G -> H (Git Heatmap)
   - GitHist (TLA+ drift)
   - F-Lint (Formal Model Lint)
   - Hazard (FMEA high-RPN)
   - H -> M (Hazard->Model)

2. Grep for all 20 layer names to confirm each appears exactly once:
   ```bash
   grep -E "(R -> F|F -> T|C -> F|T -> C|F -> C|R -> D|D -> C|P -> F|B -> F)" commands/nf/solve-report.md
   grep -E "(C -> R|T -> R|D -> R)" commands/nf/solve-report.md
   grep -E "(L1 -> L3|L3 -> TC)" commands/nf/solve-report.md
   grep -E "(PMG|Git Heatmap|TLA\+|F-Lint|Hazard \(FMEA|H -> M)" commands/nf/solve-report.md
   ```
   Count: should be 20 total, no duplicates.

3. Verify subtotal rows:
   - "Forward subtotal" row sums 8 rows
   - "Discovery subtotal" row sums 3 rows
   - "Alignment subtotal" row sums 2 rows
   - "Signal count" row sums 6 rows
   - Grand total row present and references full 20-layer sum

4. Verify placeholders intact:
   - All {N}, {M}, {delta} markers present in data rows
   - Status column uses [status] for Forward/Reverse/Alignment layers
   - Status column uses [signal] for Informational Signal layers

5. Verify Step 6 detail expansion text (lines 89-111) still references correct layer names.
  </verify>
  <done>
All 20 layers from LAYER_KEYS appear in before/after table. Alignment section reduced to 2 gates (l1_to_l3, l3_to_tc). Signals section expanded to 6 rows (per_model_gates, git_heatmap, git_history, formal_lint, hazard_model, h_to_m). B -> F added to Forward section. Section subtotals and Grand total updated. All placeholders intact.
  </done>
</task>

</tasks>

<verification>
After completing the task:

1. The table in Step 6 should display all 20 LAYER_KEYS from bin/layer-constants.cjs
2. Forward Discovery: 8 rows (including new B -> F)
3. Reverse Discovery: 3 rows
4. Layer Alignment: 2 rows (L1->L3, L3->TC; no L2->L3 Gate B)
5. Informational Signals: 6 rows (per_model_gates, git_heatmap, git_history, formal_lint, hazard_model, h_to_m)
6. No layer names duplicated
7. Section headers and subtotal labels accurate
8. All placeholder columns ({N}, {M}, {delta}, [status]/[signal]) intact
9. No markdown syntax errors in table
</verification>

<success_criteria>
- commands/nf/solve-report.md updated with all 20 layer rows in correct structure
- Alignment section shows exactly 2 gates (l1_to_l3 as "L1 -> L3", l3_to_tc as "L3 -> TC")
- Signals section shows exactly 6 rows with per_model_gates, git_heatmap, git_history, formal_lint, hazard_model, h_to_m
- B -> F (Bug->Formal) appears in Forward Discovery section
- All verify checks pass
- LAYER_KEY → display-name mapping complete and documented
- No markdown table alignment errors
</success_criteria>

<output>
After completion, create `.planning/quick/354-add-5-missing-layers-p-to-f-b-to-f-per-m/354-SUMMARY.md` containing:
- Which 5 layers were added/verified (b_to_f, per_model_gates, formal_lint, and confirmed git_history + h_to_m already present)
- Alignment section correction (3→2 gates, with L2 collapse justification from STRUCT-01)
- Signals section expansion (3→6 rows)
- Line numbers where key changes appear in the updated table
- Confirmation that all 20 LAYER_KEYS are now rendered with correct section grouping
</output>

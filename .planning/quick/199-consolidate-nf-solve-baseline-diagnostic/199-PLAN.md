---
phase: quick-199
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/nf-solve.cjs
  - bin/nf-solve.test.cjs
  - commands/nf/solve.md
autonomous: true
requirements: [QUICK-199]
formal_artifacts: none

must_haves:
  truths:
    - "nf-solve --report-only outputs a single unified table covering forward layers, reverse discovery, and layer alignment"
    - "Section divider rows within the table separate the three groups visually"
    - "A single grand total line appears at the bottom combining all residuals"
    - "Per-layer detail expansions for non-zero layers still appear below the unified table"
    - "All existing tests pass after the refactor"
  artifacts:
    - path: "bin/nf-solve.cjs"
      provides: "Unified formatReport() function"
      contains: "formatReport"
    - path: "bin/nf-solve.test.cjs"
      provides: "Updated format tests for unified table"
      contains: "TC-FORMAT"
  key_links:
    - from: "bin/nf-solve.test.cjs"
      to: "bin/nf-solve.cjs"
      via: "require and formatReport import"
      pattern: "require.*nf-solve"
---

<objective>
Consolidate the three separate diagnostic tables in nf-solve.cjs formatReport() into a single unified table with inline section dividers.

Purpose: Currently the baseline diagnostic outputs three disjoint tables (forward layer transitions, reverse traceability discovery, layer alignment) with separate headers and totals. This is hard to scan and forces the solve.md skill to describe multiple table formats. A single unified table with section dividers is cleaner.

Output: Updated formatReport() in bin/nf-solve.cjs, updated tests, updated solve.md table examples.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@bin/nf-solve.cjs (lines 2260-2600 — formatReport function and detail sections)
@bin/nf-solve.test.cjs (lines 60-170 — TC-FORMAT tests)
@commands/nf/solve.md (Step 1 baseline table format, Step 6 before/after table format)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Refactor formatReport() to produce unified table</name>
  <files>bin/nf-solve.cjs</files>
  <action>
Refactor the `formatReport()` function (starting at line 2274) to merge all three table sections into one continuous table. The new layout:

```
Layer Transition             Residual  Health
─────────────────────────────────────────────
R -> F (Req->Formal)             N    [status]
F -> T (Formal->Test)            N    [status]
C -> F (Code->Formal)            N    [status]
T -> C (Test->Code)              N    [status]
F -> C (Formal->Code)            N    [status]
R -> D (Req->Docs)               N    [status]
D -> C (Docs->Code)              N    [status]
P -> F (Prod->Formal)            N    [status]
  Forward subtotal:              N
─ Reverse Discovery (human-gated) ──────────
C -> R (Code->Req)               N    [status]
T -> R (Test->Req)               N    [status]
D -> R (Docs->Req)               N    [status]
  Discovery subtotal:            N
─ Layer Alignment (cross-layer gates) ──────
L1 -> L2 (Gate A)                N    [status]
L2 -> L3 (Gate B)                N    [status]
L3 -> TC (Gate C)                N    [status]
  Alignment subtotal:            N
═════════════════════════════════════════════
Grand total:                     N
```

Implementation details:
1. Remove the three separate `if` blocks that conditionally render reverse and layer alignment sections (lines ~2341-2398). Instead, always render all three groups in a single pass through the rows array.
2. Use a subtotal row after each section (forward, reverse, alignment) for quick scanning.
3. Use a double-line separator (`═`) before the grand total to visually distinguish it.
4. Grand total = forward total + reverse discovery total + layer total (matching existing `finalResidual.total` for forward, `finalResidual.reverse_discovery_total` for reverse, `finalResidual.layer_total` for alignment).
5. Keep the assembled_candidates summary line after the discovery subtotal if candidates exist.
6. Keep ALL per-layer detail expansion sections (R->F uncovered, F->T gaps, etc.) UNCHANGED below the unified table — only the table rendering changes.
7. Preserve the `healthIndicator()` function unchanged.
8. The reverse and alignment rows should gracefully handle missing data (residual = -1 when the layer object is undefined), same as current behavior.
  </action>
  <verify>node bin/nf-solve.cjs --report-only --json 2>/dev/null | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log('total:', d.residual_vector.total)" — confirms script still runs and produces valid JSON output.</verify>
  <done>formatReport() produces a single table with three sections (forward, reverse, alignment) separated by inline dividers, subtotals per section, and a grand total at the bottom.</done>
</task>

<task type="auto">
  <name>Task 2: Update tests and solve.md table examples</name>
  <files>bin/nf-solve.test.cjs, commands/nf/solve.md</files>
  <action>
**Tests (bin/nf-solve.test.cjs):**
1. Update TC-FORMAT-3 to also assert the unified table structure: check for "Reverse Discovery" section header and "Grand total" instead of just "Total residual".
2. Add TC-FORMAT-5: test that formatReport with reverse and layer alignment data renders all three sections in a single output (no separate "Reverse Traceability Discovery:" header — instead the section divider row). Create a finalResidual that includes c_to_r, t_to_r, d_to_r, l1_to_l2, l2_to_l3, l3_to_tc fields and verify all appear in the output.
3. Add TC-FORMAT-6: test that subtotals are present — assert output includes "Forward subtotal", "Discovery subtotal", "Alignment subtotal".

**Skill file (commands/nf/solve.md):**
1. In Step 1 (line ~87-98), replace the baseline table example with the new unified format showing all three sections with dividers and subtotals.
2. In Step 6 (line ~460-472), update the before/after table to match the unified format — add Before/After/Delta columns for all rows including reverse and alignment sections. The before/after table should have the same structure:

```
Layer Transition         Before  After   Delta     Status
─────────────────────────────────────────────────────────
R -> F (Req->Formal)        N      M    {delta}   [status]
...forward rows...
  Forward subtotal:         N      M    {delta}
─ Reverse Discovery ────────────────────────────────────
C -> R (Code->Req)          N      M    {delta}   [status]
...
  Discovery subtotal:       N      M    {delta}
─ Layer Alignment ──────────────────────────────────────
L1 -> L2 (Gate A)           N      M    {delta}   [status]
...
  Alignment subtotal:       N      M    {delta}
═════════════════════════════════════════════════════════
Grand total:                N      M    {delta}
```

Do NOT change any other process steps, constraints, or dispatch logic in solve.md.
  </action>
  <verify>cd /Users/jonathanborduas/code/QGSD && npx vitest run bin/nf-solve.test.cjs --reporter=verbose 2>&1 | tail -20</verify>
  <done>All TC-FORMAT tests pass including new TC-FORMAT-5 and TC-FORMAT-6. solve.md Step 1 and Step 6 table examples match the unified format.</done>
</task>

</tasks>

<verification>
1. `node bin/nf-solve.cjs --report-only` outputs a single unified table (not three separate tables)
2. `npx vitest run bin/nf-solve.test.cjs` — all tests pass
3. `grep -c "Grand total" bin/nf-solve.cjs` returns 1 (single grand total line in formatReport)
4. `grep "Reverse Traceability Discovery:" bin/nf-solve.cjs` returns NO matches (old separate header removed)
</verification>

<success_criteria>
- formatReport() produces one unified table with forward/reverse/alignment sections inline
- Subtotals per section + grand total at bottom
- All existing tests pass, new tests cover unified structure
- solve.md examples updated to match
- No behavioral changes to JSON output or residual computation
</success_criteria>

<output>
After completion, create `.planning/quick/199-consolidate-nf-solve-baseline-diagnostic/199-SUMMARY.md`
</output>

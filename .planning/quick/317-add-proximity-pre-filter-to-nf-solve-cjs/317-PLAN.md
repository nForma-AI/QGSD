---
phase: quick-317
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/nf-solve.cjs
  - bin/solve-tui.cjs
  - commands/nf/solve-classify.md
autonomous: true
formal_artifacts: none
requirements: [SOLVE-FP]

must_haves:
  truths:
    - "Reverse scanner items (C->R, T->R, D->R) with proximity-index reachability to a requirement node within depth 2 are auto-suppressed before assembleReverseCandidates"
    - "Suppressed items are logged with reason containing the nearest requirement ID"
    - "Haiku classification prompt for remaining items includes nearest-requirement context from proximity-index"
    - "Fail-open: if proximity-index.json is missing or malformed, all items pass through unfiltered"
  artifacts:
    - path: "bin/nf-solve.cjs"
      provides: "proximityPreFilter function + integration into assembleReverseCandidates"
      contains: "proximityPreFilter"
    - path: "bin/solve-tui.cjs"
      provides: "nearest_req field passed through to Haiku prompt lines"
      contains: "nearest_req"
    - path: "commands/nf/solve-classify.md"
      provides: "Updated category descriptions mentioning proximity context"
  key_links:
    - from: "bin/nf-solve.cjs"
      to: "bin/formal-query.cjs"
      via: "reach() BFS for requirement reachability"
      pattern: "reach\\(index"
    - from: "bin/nf-solve.cjs"
      to: ".planning/formal/proximity-index.json"
      via: "JSON load for graph lookup"
      pattern: "proximity-index\\.json"
---

<objective>
Add a proximity-based pre-filter to the reverse traceability scanners (D->R, T->R, C->R) in nf-solve.cjs. Before any reverse-flow item reaches assembleReverseCandidates, look up the item's source file in the proximity-index.json graph. If a requirement node is reachable within BFS depth 2, auto-suppress the item with reason "semantically covered by {REQ-ID}". This eliminates ~70% of solve false positives at the structural level before Haiku classification. Also enrich the Haiku classification prompt in solve-tui.cjs with nearest-requirement context for items that pass the filter.

Purpose: Reduce solve FP noise and improve Haiku classification accuracy by providing semantic proximity context.
Output: Updated nf-solve.cjs with proximityPreFilter, updated solve-tui.cjs with nearest-req enrichment in Haiku prompt, updated solve-classify.md.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@bin/nf-solve.cjs (lines 826-868 for existing proximity usage pattern, lines 1836-2062 for sweep functions, lines 2246-2435 for assembleReverseCandidates)
@bin/formal-query.cjs (lines 111-140 for reach() BFS function)
@bin/solve-tui.cjs (lines 120-191 for loadSweepData, lines 1229-1348 for classifyWithHaiku)
@commands/nf/solve-classify.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add proximityPreFilter to nf-solve.cjs and wire into assembleReverseCandidates</name>
  <files>bin/nf-solve.cjs</files>
  <action>
1. Create a new function `proximityPreFilter(candidates)` near the existing proximity enrichment code (around line 868). The function:
   - Loads `.planning/formal/proximity-index.json` (fail-open: if missing/malformed, return all candidates unchanged with `proximity_suppressed: 0`)
   - Requires `formal-query.cjs` for the `reach()` function
   - For each candidate, derives the proximity-index node key:
     - type `module` (C->R): `code_file::` + candidate.file_or_claim (e.g., `code_file::bin/foo.cjs`)
     - type `test` (T->R): `code_file::` + candidate.file_or_claim (e.g., `code_file::test/foo.test.cjs`)
     - type `claim` (D->R): skip proximity filter (doc claims don't have code_file nodes)
   - Calls `reach(index, nodeKey, 2, ['requirement'])` to find requirement nodes within depth 2
   - If any requirement node found: suppress the candidate, log via verboseMode: `TAG + ' Proximity suppress: ' + candidate.file_or_claim + ' covered by ' + reqId`
   - If no requirement node found but other reachable nodes exist within depth 3: attach `nearest_req: null, proximity_context: [list of reachable node IDs]` to the candidate for downstream Haiku enrichment
   - If requirement node found: attach `nearest_req: reqId` to the candidate (for logging/stats)
   - Returns `{ filtered: [...surviving candidates], suppressed: [...suppressed candidates], stats: { total, suppressed, passed } }`

2. In `assembleReverseCandidates()` (around line 2251), AFTER the existing dedup + filter + acknowledged steps but BEFORE the `classifyCandidate()` loop (line 2378), insert the proximity pre-filter:
   ```
   // Proximity pre-filter: suppress items reachable to requirements in proximity graph
   const proximityResult = proximityPreFilter(candidates);
   const proximitySuppressed = proximityResult.suppressed.length;
   candidates.length = 0;
   for (const c of proximityResult.filtered) candidates.push(c);
   ```

3. Add `proximity_suppressed` count to the return value of `assembleReverseCandidates()` (alongside `total_raw`, `deduped`, `filtered`, `acknowledged`).

4. In the sweep detail items returned by sweepCtoR and sweepTtoR, also attach a `nearest_req` field if available from the proximity lookup (so it flows through to solve-tui.cjs loadSweepData and into Haiku prompts).

5. Export `proximityPreFilter` in `module.exports` for testability.

IMPORTANT: Use the same fail-open pattern as the existing proximity enrichment at lines 826-868 (try/catch wrapping, graceful fallback). The reach() function is already proven at line 837.
  </action>
  <verify>
Run `node -e "const s = require('./bin/nf-solve.cjs'); console.log(typeof s.proximityPreFilter)"` — should print "function".

Run `node -e "const s = require('./bin/nf-solve.cjs'); const r = s.proximityPreFilter([]); console.log(JSON.stringify(r))"` — should print `{"filtered":[],"suppressed":[],"stats":{"total":0,"suppressed":0,"passed":0}}`.

Run `node -e "const s = require('./bin/nf-solve.cjs'); const r = s.assembleReverseCandidates({residual:0,detail:{}},{residual:0,detail:{}},{residual:0,detail:{}}); console.log('prox_suppressed' in r || 'proximity_suppressed' in r)"` — should print `true`.

Run `npm test 2>&1 | tail -5` — all existing tests pass.
  </verify>
  <done>
proximityPreFilter function exists, is exported, handles empty input gracefully, and is wired into assembleReverseCandidates before classification. The proximity_suppressed count appears in the assembled result. All existing tests pass.
  </done>
</task>

<task type="auto">
  <name>Task 2: Enrich Haiku classification prompt with nearest-requirement context</name>
  <files>bin/solve-tui.cjs, commands/nf/solve-classify.md</files>
  <action>
1. In `solve-tui.cjs` `classifyWithHaiku()` (line 1273-1285), update the item line formatting for `ctor` and `ttor` categories to include `nearest_req` context when available on the item:
   - For `ctor` items: change from `${batchIdx}: ${item.file} — module not traced to any requirement` to `${batchIdx}: ${item.file} — module not traced to any requirement${item.nearest_req ? ' (nearest: ' + item.nearest_req + ')' : ''}${item.proximity_context ? ' (near: ' + item.proximity_context.slice(0,3).join(', ') + ')' : ''}`
   - For `ttor` items: same pattern — append nearest_req or proximity_context if present
   - For `dtor` items: no change (doc claims don't get proximity enrichment)

2. In the Haiku prompt category descriptions (line 1287-1292), update `ctor` and `ttor` descriptions to mention that items may include proximity context:
   - `ctor`: append " Items marked '(nearest: REQ-XX)' have a nearby requirement in the proximity graph — more likely fp."
   - `ttor`: append " Items marked '(nearest: REQ-XX)' have a nearby requirement — more likely fp."

3. In `loadSweepData()` (lines 156-167), ensure the `nearest_req` and `proximity_context` fields from sweep detail items flow through to the loaded items:
   - For `ctor` items: add `nearest_req: item.nearest_req, proximity_context: item.proximity_context` to the mapped object
   - For `ttor` items: same

4. In `commands/nf/solve-classify.md`, no structural changes needed — the workflow calls `classifyWithHaiku` which now internally includes the enrichment. But update the `<objective>` description (line 11) to mention that classification now uses proximity-index context for better accuracy.

IMPORTANT: Preserve backward compatibility — if `nearest_req` is undefined on an item, the prompt line should be identical to current behavior (no extra text appended).
  </action>
  <verify>
Run `node -e "const st = require('./bin/solve-tui.cjs'); console.log(typeof st.classifyWithHaiku)"` — should print "function".

Run `node -e "const st = require('./bin/solve-tui.cjs'); const d = st.loadSweepData(); for (const k of ['ctor','ttor']) { const items = d[k]?.items || []; const withReq = items.filter(i => i.nearest_req); console.log(k + ': ' + items.length + ' items, ' + withReq.length + ' with nearest_req'); }"` — should run without error and show counts.

Run `npm test 2>&1 | tail -5` — all tests pass.
  </verify>
  <done>
Haiku classification prompt includes nearest-requirement context for ctor/ttor items when available. Items without proximity data produce identical prompt lines to current behavior. solve-classify.md objective updated. All tests pass.
  </done>
</task>

</tasks>

<verification>
1. `node -e "const s = require('./bin/nf-solve.cjs'); console.log(typeof s.proximityPreFilter)"` prints "function"
2. `node bin/nf-solve.cjs --fast --report-only 2>&1 | grep -i proximity` shows proximity suppression stats in stderr
3. `npm test` passes with no regressions
4. Proximity-index missing scenario: `mv .planning/formal/proximity-index.json /tmp/pi.json && node -e "const s = require('./bin/nf-solve.cjs'); const r = s.proximityPreFilter([{file_or_claim:'bin/foo.cjs',type:'module'}]); console.log(r.stats.suppressed)" && mv /tmp/pi.json .planning/formal/proximity-index.json` prints "0" (fail-open)
</verification>

<success_criteria>
- proximityPreFilter suppresses reverse-scanner items that have requirement nodes reachable within BFS depth 2
- Suppression count visible in assembleReverseCandidates return value
- Haiku classification prompt enriched with nearest-requirement context for better accuracy
- Fail-open: missing/malformed proximity-index.json causes no errors, items pass through unfiltered
- All existing tests pass
</success_criteria>

<output>
After completion, create `.planning/quick/317-add-proximity-pre-filter-to-nf-solve-cjs/317-SUMMARY.md`
</output>

---
phase: quick-176
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/qgsd-solve.cjs
  - bin/sweep-reverse.test.cjs
  - commands/qgsd/solve.md
autonomous: true
formal_artifacts: none
requirements: []
must_haves:
  truths:
    - sweepCtoR() scans bin/ and hooks/ for modules not traced to any requirement
    - sweepTtoR() scans test files for tests without @req annotation or formal-test-sync mapping
    - sweepDtoR() extracts capability claims from docs and checks for requirement backing
    - assembleReverseCandidates() deduplicates across all 3 scanners, filters invariant-worthy items, respects acknowledged-not-required.json
    - Reverse residuals (c_to_r, t_to_r, d_to_r) appear in computeResidual(), formatReport(), formatJSON() but do NOT count toward automatable_residual
    - solve.md has Step 3h defining the two-step discovery-then-approve pattern
    - All new functions are exported for testing
  artifacts:
    - bin/qgsd-solve.cjs (modified — 3 new sweep functions + assembleReverseCandidates + integration)
    - bin/sweep-reverse.test.cjs (new — tests for all 3 scanners + dedup + filtering)
    - commands/qgsd/solve.md (modified — Step 3h added)
  key_links:
    - bin/qgsd-solve.cjs
    - commands/qgsd/solve.md
    - bin/sweep-reverse.test.cjs
    - .planning/formal/requirements.json
---

<objective>
Add 3 reverse traceability scanners (C→R, T→R, D→R) to qgsd-solve.cjs diagnostic engine,
a deduplication/assembly function, and the corresponding Step 3h in solve.md defining the
two-step candidate-then-approve pattern where discovered gaps are presented to the user
before being elevated to requirements.
</objective>

<tasks>
<task type="auto">
  <name>Add reverse sweep functions and integration to qgsd-solve.cjs</name>
  <files>bin/qgsd-solve.cjs</files>
  <action>
1. Add sweepCtoR() function:
   - Walk bin/ and hooks/ for .cjs/.js files (skip node_modules, .git, test files, dist/)
   - Load requirements.json and traceability matrix
   - For each source file, check if any requirement references it (in text, background, or provenance.source_file)
   - Also check traceability matrix coverage_summary for mentions
   - Untraced files = C→R candidates
   - Return: { residual: N, detail: { untraced_modules: [{file, exports_hint}], total_modules, traced } }

2. Add sweepTtoR() function:
   - Walk test files matching *.test.cjs and test/*.test.cjs patterns
   - For each test file, scan for @req annotations in comments (pattern: @req REQ-ID)
   - Also check formal-test-sync report (loadFormalTestSync()) for requirement mappings
   - Tests without any requirement mapping = T→R orphan tests
   - Return: { residual: N, detail: { orphan_tests: [file_paths], total_tests, mapped } }

3. Add sweepDtoR() function:
   - Reuse existing discoverDocFiles()
   - For each doc file, extract capability claim sentences containing action verbs
     (supports, enables, provides, ensures, guarantees, validates, enforces, detects, prevents, handles)
   - For each claim, extract keywords (reuse extractKeywords()) and check if any requirement
     in requirements.json has 3+ keyword overlap
   - Unbacked claims = D→R candidates
   - Return: { residual: N, detail: { unbacked_claims: [{doc_file, line, claim_text}], total_claims, backed } }

4. Add assembleReverseCandidates(c_to_r, t_to_r, d_to_r) function:
   - Merge candidates from all 3 scanners into unified list
   - Deduplicate: if test file name matches a source module (e.g., test/foo.test.cjs → bin/foo.cjs),
     merge into one candidate with evidence from both C→R and T→R
   - Filter out: files in .planning/, generated stubs, node_modules paths
   - Load .planning/formal/acknowledged-not-required.json (if exists) and filter out previously rejected
   - Return: { candidates: [{source_scanners, evidence, file_or_claim}], total_raw, deduped, filtered, acknowledged }

5. Integrate into computeResidual():
   - Call sweepCtoR(), sweepTtoR(), sweepDtoR()
   - Add c_to_r, t_to_r, d_to_r to the returned residual object
   - Do NOT add them to the total (they are discovery-only, not automatable gaps)
   - Add a new field: reverse_discovery_total = c_to_r.residual + t_to_r.residual + d_to_r.residual

6. Integrate into formatReport():
   - Add rows for C→R, T→R, D→R in the table (separate section: "Reverse Traceability Discovery")
   - Show detail for non-zero reverse layers

7. Integrate into formatJSON():
   - Add c_to_r, t_to_r, d_to_r to the JSON output
   - Add assembled_candidates from assembleReverseCandidates()
   - Add health indicators for reverse layers

8. Export all new functions: sweepCtoR, sweepTtoR, sweepDtoR, assembleReverseCandidates
  </action>
  <verify>node -e "const s = require('./bin/qgsd-solve.cjs'); console.log(typeof s.sweepCtoR, typeof s.sweepTtoR, typeof s.sweepDtoR, typeof s.assembleReverseCandidates)" should print "function function function function"</verify>
  <done>All 3 sweep functions + assembleReverseCandidates exist, are exported, integrate into computeResidual/formatReport/formatJSON, and reverse residuals do not inflate the automatable total.</done>
</task>

<task type="auto">
  <name>Add Step 3h to solve.md</name>
  <files>commands/qgsd/solve.md</files>
  <action>
Add Step 3h between 3g (D→C) and Step 4 (Re-Diagnostic) in solve.md:

### 3h. Reverse Traceability Discovery (C→R + T→R + D→R)

This step surfaces implementation artifacts that have no requirement backing. Unlike forward
layers (which auto-remediate), reverse layers use a two-step pattern: autonomous discovery
followed by human approval.

**Phase 1 — Discovery (autonomous):**

Extract reverse residuals from the diagnostic sweep (already computed in Step 1):
- `residual_vector.c_to_r.detail.untraced_modules` — source files with no requirement
- `residual_vector.t_to_r.detail.orphan_tests` — tests with no requirement mapping
- `residual_vector.d_to_r.detail.unbacked_claims` — doc claims without requirement backing

Call assembleReverseCandidates() to deduplicate and filter:
```bash
CANDIDATES=$(node ~/.claude/qgsd-bin/qgsd-solve.cjs --json --report-only --project-root=$(pwd) | jq '.residual_vector.assembled_candidates')
```

If no candidates remain after dedup + filtering: Log "Reverse discovery: 0 candidates" and skip.

**Phase 2 — Human Approval (interactive):**

Present the deduplicated candidate list:
```
Discovered {N} candidate requirement(s) from reverse traceability:

  #  Source    Evidence                              Candidate
  ────────────────────────────────────────────────────────────
  1  C→R      bin/check-provider-health.cjs          Provider health probe module
  2  T→R      test/validate-traces.test.cjs          Trace validation test suite
  3  D→R      README.md:42                            "supports automatic OAuth rotation"
  ...

Accept: [a]ll / [n]one / comma-separated numbers (e.g. 1,3,5) / [s]kip this cycle
```

Wait for user input. Route:
- **Numbers or "all"**: For each accepted candidate, dispatch `/qgsd:add-requirement` with
  the candidate text as description. The add-requirement skill handles ID assignment,
  duplicate checks, and semantic conflict detection.
- **"none"**: Write all candidates to `.planning/formal/acknowledged-not-required.json`
  so they are not resurfaced in future runs. Each entry: { file_or_claim, source_scanners, acknowledged_at, reason: "user-rejected" }
- **"skip"**: Do nothing — candidates will resurface next run.

After approval, approved candidates enter the forward flow (R→F→T→C) in the next iteration.

Also update the Important Constraints section:
- Add constraint 7: Reverse flows (C→R, T→R, D→R) are discovery-only. They never auto-remediate.
  The human gate prevents unbounded requirement expansion.
- Update cascade awareness note to mention reverse discovery feeding into forward flow after approval.
  </action>
  <verify>grep -c "3h\." commands/qgsd/solve.md should return 1 or more</verify>
  <done>Step 3h exists in solve.md with the two-step discovery-then-approve pattern, including the candidate table format, user input routing, and acknowledged-not-required.json handling.</done>
</task>

<task type="auto">
  <name>Add tests for reverse sweep functions</name>
  <files>bin/sweep-reverse.test.cjs</files>
  <action>
Create bin/sweep-reverse.test.cjs using node:test + node:assert/strict:

1. sweepCtoR tests:
   - Test with mock fs where bin/ has 3 files, 2 traced in requirements.json → residual = 1
   - Test with empty bin/ → residual = 0
   - Test filtering: test files and dist/ files excluded from scan

2. sweepTtoR tests:
   - Test with mock test file containing @req annotation → mapped
   - Test with mock test file without any @req → orphan, residual = 1
   - Test with formal-test-sync cache providing mapping → mapped

3. sweepDtoR tests:
   - Test with doc containing "supports automatic OAuth rotation" and matching requirement → backed
   - Test with doc containing capability claim and NO matching requirement → unbacked, residual = 1
   - Test action verb detection: only sentences with action verbs count as claims

4. assembleReverseCandidates tests:
   - Test dedup: same module from C→R and T→R merged into 1 candidate
   - Test acknowledged-not-required filtering: previously rejected candidates excluded
   - Test filtering: .planning/ files excluded, generated stubs excluded

5. Integration test:
   - Verify computeResidual() includes c_to_r, t_to_r, d_to_r fields
   - Verify reverse residuals do NOT inflate total
   - Verify formatJSON() includes reverse layers
  </action>
  <verify>node --test bin/sweep-reverse.test.cjs</verify>
  <done>All tests pass. Each scanner + dedup + integration tested.</done>
</task>
</tasks>

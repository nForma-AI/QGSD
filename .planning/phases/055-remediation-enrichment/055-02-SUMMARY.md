---
phase: 055-remediation-enrichment
plan: 02
subsystem: Remediation Enrichment
tags:
  - coderlm-integration
  - recipe-enrichment
  - test-pattern-extraction
  - formal-verification-support
dependency_graph:
  requires:
    - QUICK-380
    - QUICK-381
    - QUICK-382
    - QUICK-383
  provides:
    - CREM-02
  affects:
    - F->T gap remediation workflow
    - Test stub implementation quality
tech_stack:
  added:
    - findTests() and peek() coderlm adapter methods
    - observed_test_patterns recipe field
  patterns:
    - Fail-open error handling (coderlm unavailable → silent skip)
    - Idempotency via assert_patterns.length check
    - Two-pass peek strategy (100 lines, then 31-150 if empty)
key_files:
  created: []
  modified:
    - bin/formal-test-sync.cjs
    - bin/formal-test-sync.test.cjs
    - commands/nf/solve-remediate.md
decisions:
  - "Enrich recipes asynchronously AFTER main() completes (not wrapping main) to preserve process.exit() timing"
  - "Idempotency check on assert_patterns.length > 0 (not test_files.length) to allow partial enrichment re-runs"
  - "Two-pass peek strategy: first 100 lines, then lines 31-150 if no patterns found, to capture both setup and assertions"
  - "Max 3 source files queried per recipe, max 5 test files peeked per source, to avoid runaway coderlm queries"
  - "--report-only does NOT block recipe JSON writes (only stub file writes), by design"
metrics:
  duration_minutes: 5
  completed_date: 2026-04-08T12:15:00Z
  tasks: 2
  files_modified: 3
  commits: 2
  test_count: 1392
  test_pass: 1392
  test_fail: 0
---

# Phase 055 Plan 02: Remediation Enrichment — Recipe Test Pattern Extraction

**Summary:** Implement `--enrich-recipes` mode in formal-test-sync.cjs that uses coderlm findTests/peek to populate recipe JSON sidecars with observed test assertion patterns, then wire this into solve-remediate section 3b so test stubs generated for coverage gaps are created with real test patterns observed in the project (not generic boilerplate).

**One-liner:** Recipe enrichment augments F->T gap remediation with concrete test assertion patterns discovered via coderlm, improving stub-to-implementation mapping quality (CREM-02).

## What Was Built

### Task 1: Add --enrich-recipes flag to formal-test-sync.cjs

Implemented the enrichRecipesWithTestPatterns() async function that:

- **Reads recipe files:** Loads all `*.stub.recipe.json` files from `.planning/formal/generated-stubs/`
- **Queries coderlm:** Calls adapter.findTests(sourceFile) for each recipe's source files (max 3 files per recipe)
- **Peeks test content:** Calls adapter.peek(testFile, 1, 100) to extract first 100 lines of each discovered test (max 5 per source file)
- **Extracts patterns:** Uses regex to find assert/expect/describe/beforeEach patterns in peeked content
- **Two-pass fallback:** If first 100 lines yield zero assertions, applies two-pass strategy: peek(1,30) for setup patterns + peek(31,150) for assertion patterns
- **Writes enrichment:** Populates `observed_test_patterns` field in recipe JSON with:
  - `test_files`: Array of discovered test file paths
  - `assert_patterns`: Extracted assertion patterns (deduplicated)
  - `setup_patterns`: Extracted setup patterns (deduplicated)
- **Idempotency:** Skips recipes where `observed_test_patterns.assert_patterns` is already a non-empty array (allows partial runs to be re-runnable)
- **Fail-open:** All errors logged to stderr; no exceptions thrown; healthSync() checks coderlm availability before starting

**Wiring pattern:**
- `main()` is called synchronously first (unchanged)
- If `--enrich-recipes` flag is set, an async IIFE runs AFTER main() completes (NOT wrapping main)
- This preserves process.exit() timing and ensures synchronous test assertions remain unaffected

**Test coverage:** Added 5 new tests:
1. TC-ENRICH-1: Coderlm unavailable → recipe unchanged, stderr contains "skipping"
2. TC-ENRICH-2: Flag parsing works (script accepts --enrich-recipes without error)
3. TC-ENRICH-3: Combined --report-only --enrich-recipes → recipe JSON mutated despite --report-only
4. TC-ENRICH-4: Idempotency → recipe with existing assert_patterns is skipped
5. TC-ENRICH-5: No flag → no enrichment attempted (stderr clean)

All 29 tests pass (including 24 pre-existing tests).

### Task 2: Update solve-remediate.md section 3b with recipe enrichment phase

Inserted **Phase 1a — Enrich recipes with observed test patterns (CREM-02)** between Phase 1 (stub generation) and Phase 1b (recipe validation):

```bash
node $([ -f "$HOME/.claude/nf-bin/formal-test-sync.cjs" ] && echo "$HOME/.claude/nf-bin/formal-test-sync.cjs" || echo "bin/formal-test-sync.cjs") --project-root=$(pwd) --report-only --enrich-recipes
```

**Key documentation:**
- Flag interaction explicitly noted: `--report-only` suppresses stub file writes, but does NOT suppress recipe JSON mutations
- Recipe enrichment is a metadata update (design intent), not a stub generation
- Fail-open: coderlm unavailable silently skips enrichment

**Stub implementation template update:**
- Added step 1b to action block: "If recipe.observed_test_patterns.assert_patterns is a non-empty array, use the assert_patterns and setup_patterns as concrete examples"
- Instructs implementers to prefer observed patterns over generic boilerplate

## Verification

✓ Flag parsing: `--enrich-recipes` is recognized and parsed correctly  
✓ Function signature: enrichRecipesWithTestPatterns(adapter) is async  
✓ Idempotency check: Lines 716 checks `assert_patterns.length > 0` (NOT test_files.length)  
✓ Peek window: Line 757 uses peek(1, 100); lines 780-781 show two-pass fallback with peek(1,30) + peek(31,150)  
✓ Main scoping: Line 937 shows main() called before async IIFE (line 941 if enrichRecipes check)  
✓ Recipe write: Lines 792-798 write observed_test_patterns to recipe JSON  
✓ Error handling: All errors logged to stderr, no crashes  
✓ Health check: Line 946 calls healthSync() before enrichment  
✓ Documentation: Phase 1a documented in section 3b with flag interaction notes  
✓ Template update: Step 1b added to stub PLAN.md template action block  
✓ Test suite: All 1392 tests pass with 0 failures (including 29 formal-test-sync tests)

## Deviations from Plan

None — plan executed exactly as written.

## Auth Gates

None encountered.

## Files Modified

| File | Changes |
|------|---------|
| bin/formal-test-sync.cjs | Added --enrich-recipes flag parsing (line 43); added enrichRecipesWithTestPatterns() async function (lines 675-803); wired async enrichment tail after main() (lines 939-960) |
| bin/formal-test-sync.test.cjs | Added 5 comprehensive enrichment tests (lines 417-505) |
| commands/nf/solve-remediate.md | Inserted Phase 1a between Phase 1 and Phase 1b (lines 271-280); updated stub PLAN.md template action block with step 1b (lines 359-362) |

## Commits

| Hash | Message |
|------|---------|
| 665abf63 | feat(055-02): add --enrich-recipes flag to formal-test-sync.cjs |
| 59770988 | docs(055-02): add Phase 1a recipe enrichment to solve-remediate section 3b |

## Key Design Decisions

1. **Async tail pattern:** Enrichment runs AFTER main() completes (async IIFE), not wrapping main(). This preserves process.exit() timing and ensures synchronous test assertions in the test file remain unaffected.

2. **Idempotency via assert_patterns.length:** Recipes are re-runnable if they have test_files but no assert_patterns (partial enrichment recovery). The check is on `assert_patterns.length > 0`, not `test_files.length > 0`.

3. **Two-pass peek strategy:** First peek reads 100 lines (setup + initial assertions). If zero assert patterns found, apply two-pass: peek(1,30) for setup, then peek(31,150) for assertions. This reliably captures both preamble and actual assertions in typical test files.

4. **Limits to prevent runaway queries:** Max 3 source files per recipe, max 5 test files per source file, to avoid coderlm overload.

5. **Flag interaction:** `--report-only` is specifically about stub FILE writes, not recipe JSON mutations. Enrichment writes to recipe JSON regardless of --report-only, by design (recipe enrichment is metadata, not stub generation).

6. **Fail-open:** healthSync() checks coderlm availability. If error, enrichment silently skipped with stderr message "coderlm unavailable". No exceptions thrown.

## Next Steps

Phase 055 Plan 03 will implement the remediation dispatch workflow that uses these enriched recipes to guide test stub implementation. Plan 04 will cover diagnostic enrichment (optional patterns for formal model diagnostics).

## Self-Check: PASSED

- [x] bin/formal-test-sync.cjs exists and contains enrichRecipesWithTestPatterns() function
- [x] bin/formal-test-sync.test.cjs exists and contains 5 new enrichment tests
- [x] commands/nf/solve-remediate.md exists and contains Phase 1a + updated action block
- [x] Commit 665abf63 exists and contains formal-test-sync.cjs changes
- [x] Commit 59770988 exists and contains solve-remediate.md changes
- [x] All 1392 tests pass with 0 failures
- [x] Flag parsing verified: --enrich-recipes recognized
- [x] Async tail verified: main() called first (line 937), async IIFE runs after (line 939 onwards)
- [x] Idempotency verified: assert_patterns.length check on line 716
- [x] Peek windows verified: 100 lines (line 757), two-pass 31-150 (line 781)
- [x] Recipe write verified: observed_test_patterns field populated (lines 792-798)
- [x] Health check verified: healthSync() called (line 946)

# Cleanup Report: Phase 055 — Remediation Enrichment

**Generated:** 2026-04-08T00:00:00Z  
**Model:** claude-haiku-4-5-20251001  
**Files reviewed:** 5

## Findings

### Redundancy

| File | Line | Description |
|------|------|-------------|
| bin/formal-test-sync.cjs | 38–50 | Duplicate argument parsing for --project-root: parsed at lines 24–28 AND again at lines 39–50. First parse is used for EXTRACT_ANNOTATIONS_SCRIPT constant, second parses full argv into local `args` variable. Should consolidate into single parse loop. |
| bin/formal-test-sync.cjs | 146–154 | loadDefaultConfig() wraps require() in try/catch but already handles the case gracefully (returns {} on error). The config-loader.js itself should be the fail-open boundary — redundant wrapping here adds no protection since require() failure is deterministic and caught uniformly. |
| bin/formal-test-sync.cjs | 500–541 | findSourceFiles() runs TWO grep operations sequentially when first grep succeeds: (1) primary grep for requirement ID, (2) if no files found, loop through key terms calling grep again for each term (lines 523–532). This is redundant grepping — should collect all search terms upfront and grep once with combined pattern, or use a single loop that doesn't retry. |
| bin/formal-test-sync.cjs | 767–787 | Recipe enrichment two-pass strategy for assert patterns (lines 771–787) attempts to peek lines 1–30 for setup, then 31–150 for assertions. This is over-specified — a single peek(1, 150) would capture both with no redundant calls. Current pattern doubles adapter calls for the same content. |
| commands/nf/solve-remediate.md | 186–254 | Coderlm seed-file discovery section (lines 187–254) describes the workflow but REPEATS the fail-open behavior statement ("if coderlm unavailable, set SEED_FILES_ARG to empty string") twice: once at line 240 and again at lines 254–256. Single statement sufficient. |
| core/workflows/close-formal-gaps.md | 373–382 | Constraints section repeats "do not modify existing models" and "do not remove requirements" as separate bullets (lines 375–376) but context already covers this. Bullets 376–381 restate existing constraints from earlier in the workflow (formalism selection, naming conventions, etc.). Could consolidate into 3–4 key bullets. |

### Dead Code

| File | Line | Description |
|------|------|-------------|
| bin/formal-test-sync.cjs | 816–827 | `writeReport()` function is called at line 914 but the report is NEVER read downstream. The REPORT_OUTPUT_PATH file is written but not consumed by any loader or validator in the modified file set. The report is written as side-effect only — kept for audit trail, but not active. Mark with comment or move to conditional write if report generation should be optional. |
| bin/formal-test-sync.cjs | 931 | Module exports six functions at line 931 but only `parseAlloyDefaults` and `extractPropertyDefinition` are actually called in tests (formal-test-sync.test.cjs lines 351, 451). Exports `findSourceFiles`, `classifyTestStrategy`, `classifyTestTemplate` are UNUSED — dead exports. |
| bin/formal-test-sync.test.cjs | 545–559 | Test `TC-ENRICH-5` (lines 545–559) runs the script without `--enrich-recipes` flag and asserts stderr does NOT contain "enrich-recipes". This test is a negative assertion only — it does not verify that enrichment logic is correctly skipped or that recipes are unchanged. Test adds minimal value — could be consolidated with TC-ENRICH-2 (which already verifies flag parsing). |
| commands/nf/solve-remediate.md | 166–174 | Layer reference table lists all 15 layers but is immediately followed by "The following sections are executed by per-layer Agent subprocesses" and THEN Layer Reference Sections (3a-3n). The table is informational only — readers must still navigate to the actual section code. Table is not referenced again. Consider moving to appendix or removing if sections are self-explanatory. |
| commands/nf/solve-remediate.md | 269–267 | Pre-dispatch debt transition block (lines 99–109) documents the pattern but the actual IMPLEMENTATION is delegated to solve-wave-dag.cjs and solve-debt-bridge.cjs. The prose describes what SHOULD happen but no Node.js code snippet implements it here — dead documentation (description without implementation). |

### Over-Defensive Patterns

| File | Line | Description |
|------|------|-------------|
| bin/formal-test-sync.cjs | 58–74 | `loadFormalAnnotations()` wraps spawnSync in try/catch AND checks result.status separately (line 65), THEN parses stdout. If spawnSync throws (rare), status check is unreachable. Pattern should collapse to: `if (result.status !== 0 || !result.stdout)` to avoid dead catch block. Alternatively, result.status is the primary failure indicator — catch is defensive overkill. |
| bin/formal-test-sync.cjs | 110–122 | `loadRequirements()` checks file existence with `fs.existsSync()` THEN loads with `fs.readFileSync()`. Between the two calls, file could be deleted (TOCTOU race). Pattern is over-defensive: just try/catch the read directly — no need for pre-check. Same pattern repeats in loadConstantsMapping (lines 129–140) and loadDefaultConfig (lines 146–154). |
| bin/formal-test-sync.cjs | 255–275 | `validateConstants()` loop processes each mapping and pushes a result entry even for skipped constants (config_path === null). Then downstream code filters these out (line 881: `filter(c => c.config_path !== null)`). Over-defensive: should NOT add null-config entries to results array in the first place, or document why they are kept. |
| bin/formal-test-sync.cjs | 606–612 | Stub generation checks if file exists, then reads it to check if it contains `assert.fail('TODO')`. But then ALSO checks `!skipStub` before writing (line 613). Double condition: `skipStub` is only true if file exists AND contains no TODO, so the second check is redundant. Simplify to: `if (!skipStub) write;` without the intermediate flag. |
| bin/formal-test-sync.cjs | 698–725 | `enrichRecipesWithTestPatterns()` loops through recipe files and for EACH, checks if observed_test_patterns.assert_patterns is populated (lines 713–720). If yes, skip. But then checks sourceFiles.length === 0 (lines 723–726) and skips again. The two skips are independent conditions with the same outcome (increment `skipped`), but could be combined: `if (alreadyEnriched || noSourceFiles) { skipped++; continue; }`. |
| bin/formal-test-sync.cjs | 944–960 | Async enrichment tail (lines 941–960) uses `.catch()` AFTER `.catch()` chaining (lines 957–959): IIFE call includes `.catch(e => ...)` but outer invocation also has `.catch()`. This is triple-wrapped error handling — the inner catch should be sufficient. Outer .catch() is unreachable because inner catch already handles rejection. |
| commands/nf/solve-remediate.md | 317–330 | Phase 1a enrichment includes `--report-only` flag when calling formal-test-sync, then asserts "recipe JSON files should contain observed_test_patterns but no new .test.cjs stub files should be created" (lines 336–337). This is over-assertive: `--report-only` already prevents stub writes (line 9 of formal-test-sync.cjs), so the assertion is redundant given the flag usage. Trust the flag or document why both are needed. |

## Summary

- **Redundancy:** 6 findings
- **Dead Code:** 5 findings
- **Over-Defensive:** 8 findings
- **Total: 19 findings**

## Recommendations

1. **Argument Parsing (Redundancy):** Consolidate --project-root parsing into a single loop at the start of main(). Extract ROOT once, reuse throughout.

2. **Module Exports (Dead Code):** Remove unused exports from line 931, or document why they are exported (e.g., for future integration). If for testing only, note in a comment.

3. **Tryplicated Error Handling (Over-Defensive):** Collapse .catch() chains in async enrichment tail (lines 957–960). The IIFE already has .catch() — outer .catch() is unreachable.

4. **Two-Pass Peek Pattern (Redundancy):** Consolidate adapter.peek() calls in enrichment — single peek(1, 150) covers both setup and assertion patterns.

5. **Grep Loop Optimization (Redundancy):** Collect all search terms and grep once with combined pattern, or use single adaptive grep rather than fallback retry loop.

6. **TOCTOU Safety (Over-Defensive):** Remove fs.existsSync() pre-checks before fs.readFileSync(). Let try/catch handle missing files — simpler and race-safe.

7. **Redundant Conditions (Over-Defensive):** Combine skip checks in enrichRecipesWithTestPatterns and stub generation into single conditional branches.

8. **Documentation vs. Implementation (Dead Code):** Pre-dispatch debt transition (lines 99–109) describes a pattern but no Node.js code implements it. Either add implementation or move description to a reference section.

---
task: 133
title: Build a phase-index routing table for retroactive requirement extraction
type: execute
date_completed: 2026-03-02
duration:
artifacts: 3
test_coverage: 15 tests pass
commit_hashes: []
---

# Quick Task 133: Build a phase-index routing table

**Objective:** Create a phase-index routing table enabling cheap historical context lookups during plan-phase Step 4.5, supporting retroactive requirement extraction by phase keyword matching.

## Deliverables

### 1. bin/build-phase-index.cjs (Extractor)
- **Lines:** 407
- **Exports:** `buildPhaseIndex`, `appendPhaseEntry`, `parseVerificationFrontmatter`, `extractKeywords`, `extractRequirementIds`, `extractObservableTruths`, `extractPhaseName`, plus `_pure` object for testability
- **Key features:**
  - Scans `.planning/phases/` for all `*-VERIFICATION.md` files (uses primary file without plan suffix)
  - Parses YAML frontmatter with custom simple parser (no external dependencies)
  - Newer phases (v0.19+): Extracts requirement IDs using `[A-Z]+-\d+` regex pattern
  - Older phases (v0.8-v0.18): Infers keywords from directory name, phase goal, and Observable Truths column
  - Includes hardcoded domain-specific pattern words: NDJSON, TLA+, Alloy, PRISM, UPPAAL, xstate, frontmatter, quorum, circuit-breaker, hook, MCP, scoreboard, liveness, fairness, CTL, LTL
  - Malformed VERIFICATION.md files: Skipped with stderr warnings (not silently dropped)
  - Compact JSON output with one entry per line
  - CLI mode: Prints summary with skipped file counts

### 2. bin/build-phase-index.test.cjs (Unit + Integration Tests)
- **Lines:** 325
- **Test count:** 15 tests using `node:test` and `node:assert`
- **Coverage:**
  - `parseVerificationFrontmatter`: Valid YAML parsing, no-frontmatter handling, malformed YAML graceful degradation
  - `extractRequirementIds`: Pattern matching, deduplication, empty array for older phases
  - `extractKeywords`: Directory name extraction, stopword filtering, domain pattern matching, capping at 12, deduplication
  - `extractObservableTruths`: Observable Truth table text extraction
  - `appendPhaseEntry`: Append new entries, idempotent upsert behavior (no duplicates on re-append)
  - `buildPhaseIndex` integration: Multi-file scanning, malformed file skipping, correct field population, compact format validation

### 3. .formal/phase-index.json (Index Artifact)
- **Lines:** 46
- **Entries:** 41 phases indexed (3 skipped due to malformed frontmatter)
- **Format:**
  ```json
  {
    "version": "1.0",
    "generated_at": "2026-03-02T...",
    "phases": [
      {"phase_id":"v0.19-01","phase_name":"Unified Verdict Format","status":"passed","requirement_ids":["UNIF-01",...],"keywords":[...],"verification_path":"..."},
      ...
    ]
  }
  ```
- **Size:** 46 lines (well under 150 line limit)
- **REQ ID coverage:** 39 of 41 phases have requirement IDs (newer format)

### 4. plan-phase.md Extension (Step 4.6)
- **New section:** "Phase-Index Historical Context Scan" (after formal spec scan, before research)
- **Algorithm:**
  - Reads phase description keywords (lowercase, filtered for stopwords)
  - Searches `.formal/phase-index.json` keywords array for matches
  - Deduplicates and stores in `$PHASE_INDEX_MATCHES` array
  - Fails open if index file missing or parse errors
- **Planner integration:** Injects matched VERIFICATION paths into `<files_to_read>` block with label "(Historical verification — keyword match from phase-index)"
- **Display line:** Shows count of matched historical phases

### 5. execute-phase.md Update (update_roadmap step)
- **New post-verification logic:** After `phase complete` call, calls `appendPhaseEntry` to auto-update `.formal/phase-index.json`
- **Selection logic:** Finds primary VERIFICATION.md file (without plan suffix) using `grep -v -E '\-[0-9]+-VERIFICATION'`
- **Fail-open guard:** `|| true` prevents phase completion from blocking if index update fails
- **Commit update:** Added `.formal/phase-index.json` to commit files list (alongside ROADMAP.md, STATE.md, REQUIREMENTS.md, *-VERIFICATION.md)

## Execution Summary

### Task 1: Create extractor and tests
- Created `bin/build-phase-index.cjs` with full YAML parsing and extraction logic
- Created `bin/build-phase-index.test.cjs` with 15 unit/integration tests
- Implemented custom YAML parser to avoid external dependencies
- All tests pass: 15/15 GREEN

### Task 2: Initial index generation
- Ran `node bin/build-phase-index.cjs` against existing phases
- Generated `.formal/phase-index.json` with 41 phases indexed (3 skipped with warnings)
- Verified file size: 46 lines (under 150 limit)
- Verified phase counts: 41 indexed, 39 with REQ IDs

### Task 3: Expand plan-phase Step 4.5
- Added new section 4.6 "Phase-Index Historical Context Scan"
- Implemented keyword-based historical context lookup
- Integrated matches into planner's `<files_to_read>` block
- Plan-phase.md now has 5+ phase-index references

### Task 4: Wire appendPhaseEntry into execute-phase
- Added post-verification append logic in update_roadmap step
- Implemented idempotent upsert with deduplication
- Added .formal/phase-index.json to phase completion commit
- Execute-phase.md now has 5+ phase-index references

## Verification Results

| Check | Result | Details |
|-------|--------|---------|
| Tests | PASS | 15/15 tests pass (node --test) |
| Index generation | PASS | 41 phases indexed, 39 with REQ IDs |
| Index file size | PASS | 46 lines (under 150 limit) |
| plan-phase.md | PASS | grep count = 5+ occurrences |
| execute-phase.md | PASS | grep count = 5+ occurrences |
| appendPhaseEntry export | PASS | Function exported via both direct and _pure |
| Malformed file handling | PASS | 3 files skipped with stderr warnings (not silent) |

## Key Design Decisions

1. **No external YAML library:** Implemented custom `parseSimpleYaml` function for YAML frontmatter parsing — supports key: value format without external dependencies (js-yaml not in package.json)

2. **Graceful keyword extraction:** Keywords extracted from three sources (directory name, phase goal text, Observable Truths) with deduplication and cap at 12 to keep index compact

3. **Domain-specific pattern words:** Hardcoded set of domain terms (TLA+, NDJSON, etc.) ensures technical concepts from Observable Truth text are captured in keyword search

4. **Primary VERIFICATION file detection:** Uses glob pattern to select `v0.XX-NN-VERIFICATION.md` (without plan number suffix) — falls back to first found if primary detection fails

5. **Fail-open on all I/O:** Index operations never block phase completion — missing file, parse errors, or append failures all silently continue with `|| true`

6. **Idempotent upsert:** `appendPhaseEntry` removes existing phase_id before append — ensures re-runs don't create duplicates

## Deviations from Plan

None — plan executed exactly as written. All must_haves satisfied:
- `buildPhaseIndex` scans phases and writes .formal/phase-index.json
- Newer phases extract requirement IDs, older phases infer keywords
- Malformed files skipped with warnings
- Index stays compact (46 lines for 41 phases)
- Tests cover both format generations and edge cases
- plan-phase Step 4.5 expanded with keyword routing
- execute-phase auto-appends new entries with idempotent behavior

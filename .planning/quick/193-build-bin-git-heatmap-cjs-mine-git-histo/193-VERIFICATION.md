---
phase: quick-193
verified: 2026-03-06T15:15:00Z
status: passed
score: 5/5 must-haves verified
---

# Quick 193: Git Heatmap Verification Report

**Phase Goal:** Build bin/git-heatmap.cjs -- mine git history for numerical adjustments, bugfix hotspots, and churn ranking; output .planning/formal/evidence/git-heatmap.json as input for nf:solve
**Verified:** 2026-03-06T15:15:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Running node bin/git-heatmap.cjs produces .planning/formal/evidence/git-heatmap.json | VERIFIED | File exists with 2026-03-06T15:06:27.911Z timestamp; e2e test confirms JSON output |
| 2 | JSON output contains numerical_adjustments, bugfix_hotspots, and churn_ranking arrays | VERIFIED | Evidence file contains all three arrays (40 adj, 699 bugfix files, 4750 churn files) |
| 3 | uncovered_hot_zones cross-references model-registry.json to flag files without formal coverage | VERIFIED | buildCoverageMap reads model-registry.json (line 76), hasFormalCoverage used in all three extractors and buildUncoveredHotZones; 4691 uncovered hot zones in output |
| 4 | Priority scoring uses multiplicative formula: max(churn, 1) * (1 + fixes) * (1 + adjustments) | VERIFIED | computePriority function at line 412-414 implements exact formula; 5 unit tests confirm edge cases including zero-churn floor |
| 5 | Tests pass validating all three signal extraction functions and the cross-reference logic | VERIFIED | 27/27 tests pass covering regex, drift, bugfix filter, scoring, hunk constraints, sanitization, coverage map, and e2e schema |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `bin/git-heatmap.cjs` | Git history mining script (min 150 lines) | VERIFIED | 571 lines, all three extractors + cross-reference + CLI |
| `bin/git-heatmap.test.cjs` | Unit tests (min 80 lines) | VERIFIED | 258 lines, 27 tests covering all required areas |
| `.planning/formal/evidence/git-heatmap.json` | Generated evidence file (contains schema_version) | VERIFIED | Exists with schema_version "1", populated signal arrays |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `bin/git-heatmap.cjs` | `.planning/formal/model-registry.json` | JSON read for coverage cross-reference | WIRED | Line 76: reads registry, lines 87-98: scans model file content for source paths |
| `bin/git-heatmap.cjs` | `.planning/formal/evidence/git-heatmap.json` | fs.writeFileSync output | WIRED | Line 540: writes JSON result to evidence path |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| QUICK-193 | 193-PLAN.md | Git heatmap mining script | SATISFIED | Script, tests, and evidence file all verified |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | - | - | - | No anti-patterns detected |

### Human Verification Required

None. All checks pass programmatically.

### Formal Verification

No formal modules matched. Skipped.

---

_Verified: 2026-03-06T15:15:00Z_
_Verifier: Claude (nf-verifier)_

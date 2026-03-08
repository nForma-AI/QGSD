---
phase: quick-224
verified: 2026-03-08T18:26:37Z
status: gaps_found
score: 5/6 must-haves verified
gaps:
  - truth: "Repo source file core/workflows/list-phase-assumptions.md is in sync with installed copy"
    status: failed
    reason: "Only the installed file (~/.claude/nf/workflows/list-phase-assumptions.md) was modified. The repo source (core/workflows/list-phase-assumptions.md) still has the old version without ground_in_artifacts. On next install, the changes will be overwritten."
    artifacts:
      - path: "core/workflows/list-phase-assumptions.md"
        issue: "Missing ground_in_artifacts step — still has old 5-step workflow (validate_phase -> analyze_phase -> present_assumptions -> gather_feedback -> offer_next)"
    missing:
      - "Copy the updated workflow content back to core/workflows/list-phase-assumptions.md so the repo source matches the installed copy"
---

# Quick-224: Add Formal Grounding Step Verification Report

**Phase Goal:** Add formal grounding step to list-phase-assumptions workflow that cross-references requirements, specs, traceability, test coverage, and formal models
**Verified:** 2026-03-08T18:26:37Z
**Status:** gaps_found
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Workflow reads formal artifacts (REQUIREMENTS.md, spec/, traceability-matrix.json, unit-test-coverage.json, requirements.json, model-registry.json) before analyzing assumptions | VERIFIED | All 6 artifacts referenced in ground_in_artifacts step across 3 tiers (lines 63-74 of installed file) |
| 2 | A Formal Grounding section appears before the 5 assumption areas in the output template | VERIFIED | `### Formal Grounding` at line 137, before `### Technical Approach` at line 161 |
| 3 | Each assumption in the 5 areas is tagged as grounded or inferred | VERIFIED | All 5 areas (Technical Approach, Implementation Order, Scope Boundaries, Risk Areas, Dependencies) show `[grounded/inferred]` tags on every assumption line |
| 4 | All phase requirement IDs are resolved to full text from REQUIREMENTS.md (or gracefully noted as empty) | VERIFIED | Step 0 handles missing requirements line; Tier 1 reads REQUIREMENTS.md for verbatim text; template shows "No requirement IDs specified" fallback |
| 5 | validate_phase "Continue to" target updated from analyze_phase to ground_in_artifacts | VERIFIED | Line 52: "Continue to ground_in_artifacts." |
| 6 | Tier 3 requirements.json lookup uses JSON-aware parsing (node -e or jq), not literal grep | VERIFIED | Line 73: "Parse ... using JSON-aware lookup (e.g., `node -e` with `JSON.parse` or `jq`). Do NOT use literal grep on JSON" |

**Score:** 6/6 truths verified (in the installed file)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `~/.claude/nf/workflows/list-phase-assumptions.md` | Enhanced workflow with formal grounding step | VERIFIED | Contains ground_in_artifacts step, all 6 artifact reads, grounded/inferred tagging, Formal Grounding output section |
| `core/workflows/list-phase-assumptions.md` | Repo source should match installed copy | FAILED | Still has old 5-step workflow without ground_in_artifacts. 33 lines of diff between repo source and installed copy. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| ground_in_artifacts step | analyze_phase step | grounding data flows into assumption analysis | WIRED | Line 85: "Continue to analyze_phase"; Line 89: "Using both the grounding data from ground_in_artifacts and the roadmap description" |
| ground_in_artifacts step | present_assumptions step | Formal Grounding section in output template | WIRED | Line 137: "### Formal Grounding" section with Requirements, Existing Specs, Traceability, Test Coverage, Formal Models subsections |

### Step Ordering Verification

Confirmed correct order: validate_phase -> ground_in_artifacts -> analyze_phase -> present_assumptions -> gather_feedback -> offer_next

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | - | No TODOs, FIXMEs, or placeholders found | - | - |

### Human Verification Required

### 1. End-to-end workflow execution

**Test:** Run `/nf:list-phase-assumptions` on a phase that has a `Requirements:` line in the roadmap
**Expected:** Formal Grounding section appears with verbatim requirement text, spec directories, traceability status, test coverage, and formal model references before the 5 assumption areas. Each assumption is tagged grounded or inferred.
**Why human:** Workflow is conversational -- requires running Claude with the workflow to verify runtime behavior

### 2. Graceful degradation for phases without requirements

**Test:** Run `/nf:list-phase-assumptions` on a phase with no `Requirements:` line
**Expected:** "No requirement IDs found for this phase" message; domain-keyword-based reads still execute; analysis proceeds as inference-only
**Why human:** Requires runtime execution to verify fail-open behavior

### Gaps Summary

The installed workflow at `~/.claude/nf/workflows/list-phase-assumptions.md` is fully correct and contains all required changes. However, the repo source file at `core/workflows/list-phase-assumptions.md` was NOT updated. Since the install process copies from `core/workflows/` to the install location, the next run of `node bin/install.js` would overwrite the changes with the old version.

The fix is straightforward: copy the updated content to `core/workflows/list-phase-assumptions.md`.

---

_Verified: 2026-03-08T18:26:37Z_
_Verifier: Claude (nf-verifier)_

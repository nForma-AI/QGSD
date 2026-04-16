---
phase: 400-nf-harden-adversarial
verified: 2026-04-16T16:30:00Z
status: gaps_found
score: 8/9 must-haves verified
gaps:
  - truth: "The success_criteria checklist in core/workflows/quick.md is updated with two new entries for Step 6.6 hardening integration"
    status: failed
    reason: "Plan Task 2 (line 472-475) specifies adding two items to success_criteria, but they are not present in the actual file"
    artifacts:
      - path: "core/workflows/quick.md"
        issue: "Missing success_criteria entries: '(--full) Step 6.6 adversarial hardening runs when VERIFICATION_STATUS is \"Verified\"' and '(--full) Harden status included in final completion banner'"
    missing:
      - "Add two checklist items to success_criteria section (after line ~1695):\n  - `- [ ] (--full) Step 6.6 adversarial hardening runs when VERIFICATION_STATUS is \"Verified\"`\n  - `- [ ] (--full) Harden status included in final completion banner`"
      - "Sync the updated quick.md to ~/.claude/nf/workflows/quick.md"
---

# Quick Task 400: nf:harden Adversarial Hardening Loop Skill — Verification Report

**Task Goal:** Add nf:harden adversarial hardening loop skill and integrate a simplified hardening loop into nf:quick --full.

**Verified:** 2026-04-16T16:30:00Z

**Status:** gaps_found

**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Running /nf:harden runs up to 10 adversarial iterations and terminates with convergence or cap-exhausted banner | ✓ VERIFIED | core/workflows/harden.md Step 4 implements loop with `$ITERATION < $MAX_ITERATIONS` guard and Step 5 displays both "HARDENING CONVERGED" and "HARDENING CAP REACHED" banners. Iteration cap default 10 enforced. |
| 2 | The loop detects convergence when 2 consecutive iterations produce zero new failures and stops early | ✓ VERIFIED | Line 208-209 and 332: `$CONSECUTIVE_ZERO_CHANGE += 1` increments ONLY when `$NEW_FAILURES_COUNT == 0`, reset to 0 when `$NEW_FAILURES_COUNT > 0` (line 211). Line 215: termination check `$CONSECUTIVE_ZERO_CHANGE >= 2` triggers "converged" status. |
| 3 | The --area <path> flag restricts adversarial agent to specified subtree | ✓ VERIFIED | Step 1 parses `--area` with validation (lines 14-15): errors if missing value or empty string. Step 2 uses `$AREA` as `$SCOPE_ROOT` to filter find command (line 34-35). |
| 4 | The --full flag increases adversarial pressure (more edge-case categories tested) | ✓ VERIFIED | Step 1 parses `--full` into `$FULL_MODE`. Step 4a (lines 110-111) includes expanded categories only when `$FULL_MODE` is true: concurrent invocation, error propagation chains, partial failures, invalid argument types, oversized inputs. |
| 5 | Running /nf:quick --full triggers simplified hardening loop (max 5 iterations) in Step 6.5 post-verification, before final banner | ✓ VERIFIED | core/workflows/quick.md Step 6.6 (line 1436) runs only when `$FULL_MODE` AND `$VERIFICATION_STATUS = "Verified"`. Spawns harden subagent with `--max 5` (line 1464). Positioned between Step 6.5.1 quorum review and Step 6.7 elevation. |
| 6 | The hardening loop skips gracefully if no test files found | ✓ VERIFIED | core/workflows/harden.md Step 2 (lines 45-54): if `$TEST_FILES` empty, displays "HARDENING SKIPPED" banner with searched path and returns status "skipped". |
| 7 | core/workflows/harden.md and ~/.claude/nf/workflows/harden.md exist with identical content | ✓ VERIFIED | Both files exist. `diff core/workflows/harden.md ~/.claude/nf/workflows/harden.md` returns no output — files are byte-identical. |
| 8 | commands/nf/harden.md and ~/.claude/commands/nf/harden.md exist with identical content (skill available at runtime) | ✓ VERIFIED | Both files exist. `diff commands/nf/harden.md ~/.claude/commands/nf/harden.md` returns no output — files are byte-identical. Skill registered with correct frontmatter (name: nf:harden). |
| 9 | core/workflows/quick.md Step 6.6 is properly integrated with harden wiring and success_criteria updated | ✗ FAILED | Step 6.6 wiring is correct (line 1436, references @~/.claude/nf/workflows/harden.md line 1461, spawns with --max 5), `$HARDEN_STATUS` included in completion banner (line 1644). However, two success_criteria checklist items are missing (should be after line ~1695). |

**Score:** 8/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `commands/nf/harden.md` | nf:harden skill command | ✓ VERIFIED | Exists with correct frontmatter (name, description, argument-hint, allowed-tools). Execution context points to @~/.claude/nf/workflows/harden.md. File in sync with installed location. |
| `core/workflows/harden.md` | Adversarial hardening loop | ✓ VERIFIED | Implements full loop: argument parsing (--area, --full, --max) with validation, test discovery with empty/baseline guards, iterative adversarial+fix loop, convergence detection (CONSECUTIVE_ZERO_CHANGE increments only on zero-failure iterations), cap-based termination. All 4 terminal states (converged, cap_exhausted, skipped, blocked) declared with banners. |
| `~/.claude/nf/workflows/harden.md` | Installed harden workflow | ✓ VERIFIED | Exact copy of core/workflows/harden.md. In sync. |
| `~/.claude/commands/nf/harden.md` | Installed nf:harden skill | ✓ VERIFIED | Exact copy of commands/nf/harden.md. In sync. |
| `core/workflows/quick.md` (Step 6.6) | Post-verification hardening hook | ✓ VERIFIED (partial) | Step 6.6 section exists and correctly wired. Runs after verification when $FULL_MODE AND $VERIFICATION_STATUS="Verified". Spawns harden with --max 5. Handles all terminal states and fail-open. `$HARDEN_STATUS` included in final banner. However, success_criteria not updated. |
| `~/.claude/nf/workflows/quick.md` | Installed quick workflow | ✓ VERIFIED | In sync with core/workflows/quick.md. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| commands/nf/harden.md | ~/.claude/nf/workflows/harden.md | @reference | ✓ WIRED | Execution context at line 22-23 references @~/.claude/nf/workflows/harden.md. Link will be resolved at runtime. |
| core/workflows/quick.md (Step 6.6) | core/workflows/harden.md | @reference + Task spawn | ✓ WIRED | Line 1461 references @~/.claude/nf/workflows/harden.md in subagent prompt. Subagent will execute harden workflow with --max 5. |
| core/workflows/harden.md (loop termination) | EventuallyTerminates invariant | code structure | ✓ WIRED | Iteration cap ($ITERATION < $MAX_ITERATIONS, line 96) and convergence bound ($CONSECUTIVE_ZERO_CHANGE < 2, line 96) together guarantee termination. Line 214 comment references EventuallyTerminates invariant. Formal check passed: 1/1. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| INTENT-01 | 400-PLAN.md (line 12) | (Inferred from requirement field) | ✓ VERIFIED | Plan declares `requirements: [INTENT-01]`. Artifact creation (nf:harden command, harden workflow) and wiring (quick Step 6.6) satisfy the intent of providing an adversarial hardening skill and integrating it into quick. |

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| None | — | — | No TODO/FIXME/XXX comments, placeholder text, or stub implementations found. All code is substantive. |

### Formal Verification

**Status: PASSED**

| Check | Result |
|-------|--------|
| Module | agent-loop |
| Property | EventuallyTerminates |
| Passed | 1 |
| Failed | 0 |
| Skipped | 0 |
| Counterexamples | None |

**Details:** Formal model checker verified the EventuallyTerminates property on the hardening loop. The iteration cap and convergence detection logic together ensure the loop always terminates in a defined state (converged, cap_exhausted, skipped, or blocked). No counterexamples found.

### Human Verification Required

None. All behavioral guarantees can be verified programmatically.

### Gaps Summary

**1 gap blocking goal achievement:**

The plan's Task 2 (lines 472-475) requires updating the `success_criteria` checklist in `core/workflows/quick.md` with two new assertions documenting the Step 6.6 integration. These items are missing from the actual file:

- `- [ ] (--full) Step 6.6 adversarial hardening runs when VERIFICATION_STATUS is "Verified"`
- `- [ ] (--full) Harden status included in final completion banner`

Both the runtime behavior (Step 6.6 execution and banner inclusion) is correct and verified. However, the documentation checklist is incomplete. The success_criteria section is the source of truth for validating that the quick workflow meets its full-mode requirements, so this gap must be closed for the plan to be fully satisfied.

**Quick fix:**
1. Add the two missing checklist items to core/workflows/quick.md success_criteria section
2. Sync the updated file to ~/.claude/nf/workflows/quick.md
3. Commit: `git add core/workflows/quick.md && git commit -m "docs(quick-400): add success_criteria for Step 6.6 hardening integration"`

---

**Verified:** 2026-04-16T16:30:00Z

**Verifier:** Claude Code (nf-verifier)

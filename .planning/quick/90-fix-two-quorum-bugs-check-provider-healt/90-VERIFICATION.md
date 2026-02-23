---
phase: quick-90
verified: 2026-02-23T22:50:00Z
status: passed
score: 3/3 must-haves verified
re_verification: false
---

# Quick Task 90: Fix Two Quorum Bugs — Verification Report

**Task Goal:** Fix two quorum bugs: check-provider-health.cjs filter mismatch for unified-mcp-server.mjs and add preferSub ordering to orchestrator dispatch loop
**Verified:** 2026-02-23T22:50:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `node bin/check-provider-health.cjs --json` returns a non-empty providers object with entries for claude-1 through claude-6 | VERIFIED | Live run returned 3 provider entries (akashml: claude-1/claude-2, together: claude-3/claude-5, fireworks: claude-4/claude-6) with no early-exit message |
| 2 | The orchestrator Step 1 slot ordering section explicitly reads preferSub from qgsd.json and places auth_type=sub slots before auth_type=api slots before the healthy/unhealthy reorder | VERIFIED | Lines 90-109 of orchestrator contain bash snippet reading preferSub + agentCfg, storing as $PREFER_SUB_CONFIG, then explicit ordering rule for sub-before-api partition followed by healthy/unhealthy reorder within each group |
| 3 | Subprocess slots (codex-1, gemini-1, opencode-1, copilot-1) appear first in the orchestrator's active slot list when preferSub=true in qgsd.json | VERIFIED | Line 107 explicitly states: "slots with auth_type=sub first, then slots with auth_type=api (stable sort, preserving original order within each group). This ensures subscription CLI slots (codex-1, gemini-1, opencode-1, copilot-1) are always attempted before API slots" |

**Score:** 3/3 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `bin/check-provider-health.cjs` | HTTP provider health probe — correctly identifies HTTP slots by ANTHROPIC_BASE_URL presence, not binary name | VERIFIED | File exists, substantive (323 lines), args-based filter removed at line 134 (replaced with comment), `!baseUrl` guard at line 140 is the sole HTTP discriminator |
| `agents/qgsd-quorum-orchestrator.md` | Quorum orchestrator Step 1 with preferSub ordering logic | VERIFIED | File exists, substantive (521 lines), Step 1 contains bash snippet + preferSub ordering description at lines 90-109 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `bin/check-provider-health.cjs` line ~134 | `env.ANTHROPIC_BASE_URL` | Remove redundant args filter — `!baseUrl` on line 140 is the real HTTP discriminator | VERIFIED | grep for `args.*claude-mcp-server` returns zero matches in the loop body. Line 134 is now a comment. Line 140 `if (!baseUrl) continue;` is the sole guard. |
| `agents/qgsd-quorum-orchestrator.md` Step 1 slot reorder | `qgsd.json quorum.preferSub + agent_config[slot].auth_type` | Add preferSub read + sort before healthy/unhealthy reorder | VERIFIED | 6 matches for `preferSub` in orchestrator. Bash snippet reads `cfg.quorum.preferSub` and `cfg.agent_config`, stores as `$PREFER_SUB_CONFIG`. Ordering rule uses `$PREFER_SUB_CONFIG.preferSub` to partition sub/api before healthy/unhealthy reorder. |

### Plan Verification Checks (from `<verification>` block)

| Check | Expected | Result |
|-------|----------|--------|
| `node bin/check-provider-health.cjs --json` returns provider data | Non-empty providers array for claude-1..claude-6 | PASS — 3 provider entries returned (akashml, together, fireworks) covering all 6 claude-* slots |
| `grep -n 'preferSub' agents/qgsd-quorum-orchestrator.md` | At least 3 matches | PASS — 6 matches (lines 90, 100, 102, 105, 107, 108) |
| `grep -n 'claude-mcp-server' bin/check-provider-health.cjs` returns 0 loop-body matches | Faulty filter removed | PASS — 2 remaining references are innocuous: file header comment (line 7) and empty-state fallback message (line 149), neither in the loop |

### Requirements Coverage

No requirements IDs declared in PLAN frontmatter (`requirements: []`). Success criteria from `<success_criteria>` block:

| Criterion | Status | Evidence |
|-----------|--------|----------|
| check-provider-health.cjs no longer exits early with "No claude-mcp-server instances" — HTTP providers (claude-1..claude-6) correctly detected via ANTHROPIC_BASE_URL | SATISFIED | Live --json run returned 3 providers; no early-exit message observed |
| Orchestrator Step 1 explicitly implements preferSub ordering: sub slots (codex-1, gemini-1, opencode-1, copilot-1) dispatched before API slots when quorum.preferSub=true | SATISFIED | Lines 90-109 implement bash snippet + partition ordering rule |

### Commit Verification

| Commit | Task | Files Changed | Status |
|--------|------|---------------|--------|
| f7579a9 | Task 1: Remove args filter from check-provider-health.cjs | `bin/check-provider-health.cjs` (+2/-1) | EXISTS — matches claim |
| e045011 | Task 2: Add preferSub ordering to orchestrator Step 1 | `agents/qgsd-quorum-orchestrator.md` (+21/-1) | EXISTS — matches claim |

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `bin/check-provider-health.cjs` line 149 | `console.log('No claude-mcp-server instances with ANTHROPIC_BASE_URL found.')` | Info | This message is now a dead code path for properly configured setups. Not a blocker — it fires only when `providers` dict is empty after all filtering, which is a valid edge case. The message text still references `claude-mcp-server` but this is cosmetically stale, not functional. |

No blockers. No TODO/FIXME/placeholder patterns found. No empty implementations detected.

### Human Verification Required

None — both fixes are fully verifiable programmatically. The live `--json` run confirms HTTP slot detection works against real endpoints.

---

## Gaps Summary

No gaps. All three must-have truths are verified, both artifacts are substantive and correctly wired, both key links are confirmed, and both plan verification checks pass.

The two commits (f7579a9, e045011) exist in git history, touch the correct files, and the actual file contents match the intended changes.

---

_Verified: 2026-02-23T22:50:00Z_
_Verifier: Claude (qgsd-verifier)_

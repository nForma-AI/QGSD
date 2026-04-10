---
phase: quick-385
verified: 2026-04-08T00:00:00Z
status: passed
score: 6/6 must-haves verified
formal_check:
  passed: 6
  failed: 0
  skipped: 0
  counterexamples: []
---

# Quick Task 385: Make nf:mcp-repair Discover Slot Names Dynamically — Verification Report

**Task Goal:** Make nf:mcp-repair discover slot names dynamically from ~/.claude.json mcpServers instead of hardcoding them
**Verified:** 2026-04-08
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | Step 1 reads ~/.claude.json mcpServers to discover slot names dynamically before issuing any MCP tool calls | VERIFIED | Line 41: `SLOT_NAMES=$(node << 'NF_EVAL'` with `Object.keys(cj.mcpServers || {})` at line 45 |
| 2  | Step 1 replaces the hardcoded 30-call enumeration with a loop-driven instruction over discovered slot names | VERIFIED | `grep -c "mcp__codex-1__identity\|mcp__gemini-1__identity\|mcp__claude-1__identity"` returns 0; lines 71-76 contain the loop-pattern instruction |
| 3  | The allowed-tools frontmatter is replaced with a note block explaining that the executor must use the slot names discovered from ~/.claude.json | VERIFIED | Lines 4-14: only `Bash` and `Read` listed; 5-line comment block explains dynamic MCP access and instructs executor not to call tools for absent slots |
| 4  | $BEFORE_STATE is assembled from the discovered slots, not from a hardcoded 10-slot JSON template | VERIFIED | Lines 78-84: `$BEFORE_STATE` keyed by slot name with `...one entry per slot in $SLOT_NAMES...` — no hardcoded template |
| 5  | Step 4 and Step 6 slot-specific deep_health_check / identity calls already use `<slot>` placeholders and remain unchanged | VERIFIED | Lines 245, 286: `mcp__<slot>__deep_health_check({})` and `mcp__<slot>__identity` — all placeholder form, no hardcoded slot names |
| 6  | No hardcoded slot names (codex-1, gemini-1, opencode-1, copilot-1, claude-1..6) remain in Step 1's call list | VERIFIED | `grep -c "mcp__claude-[1-6]__identity"` returns 0; `grep -c "mcp__codex-1__identity\|..."` returns 0 |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `commands/nf/mcp-repair.md` | Dynamic slot discovery replacing hardcoded 30-tool call list; contains `~/.claude.json` | VERIFIED | File modified at commit 11c9fbb9; `~/.claude.json` referenced at lines 8, 44, 45, 251, 257, 378 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| Step 1 slot discovery block | mcp__<slot>__identity / health_check / deep_health_check | discovered slot names from ~/.claude.json mcpServers keys | WIRED | `SLOT_NAMES=$(node ...)` at line 41 reads mcpServers; lines 71-74 loop over `$SLOT_NAMES` calling all three tool types |

### Anti-Patterns Found

No stub patterns, placeholder comments, or empty implementations found. The task involves a documentation/instruction file (`commands/nf/mcp-repair.md`), not executable code — no TODO/FIXME/placeholder markers detected.

### Formal Verification

**Status: PASSED**

| Checks | Passed | Skipped | Failed |
|--------|--------|---------|--------|
| Total  | 6      | 0       | 0      |

Formal model checker (quorum, deliberation, mcp-calls, recruiting modules) reported 6 passed, 0 failed. The task changes are confined to a skill instruction file (`commands/nf/mcp-repair.md`) and do not modify any runtime logic, quorum orchestration, or MCP call infrastructure — no formal invariants are implicated.

## Summary

The task goal is fully achieved. `commands/nf/mcp-repair.md` now:

1. Reads `~/.claude.json mcpServers` keys at runtime to build `$SLOT_NAMES` (excluding `unified-1`), with try/catch fail-open behavior (returns empty array on parse failure).
2. Derives `$SLOT_COUNT` from the discovered array length — no longer from providers.json.
3. Issues identity / health_check / deep_health_check calls via a loop-pattern instruction over `$SLOT_NAMES` — no hardcoded 30-entry numbered list.
4. Assembles `$BEFORE_STATE` keyed by discovered slot names — no hardcoded 10-slot JSON template.
5. Replaces the 30-entry allowed-tools MCP tool list with a comment-only block documenting the dynamic access pattern.
6. Updates the success_criteria block to reference `~/.claude.json mcpServers` instead of `bin/providers.json`.
7. Treats non-health-check MCP servers (filesystem-1, brave-1, gmail) with null identity/health_check results as unresponsive rather than errors.

All steps 1-7 structural headings are intact and steps 2-7 logic is unchanged.

---

_Verified: 2026-04-08_
_Verifier: Claude (nf-verifier)_

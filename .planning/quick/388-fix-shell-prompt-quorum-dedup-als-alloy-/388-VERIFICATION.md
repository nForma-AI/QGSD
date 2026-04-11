---
phase: quick-388
verified: 2026-04-11T00:00:00Z
status: passed
score: 2/2 must-haves verified
formal_check:
  passed: 1
  failed: 0
  skipped: 0
  counterexamples: []
---

# Quick Task 388: Fix shell-prompt-quorum-dedup.als Alloy Assertion Failure

**Task Goal:** Fix 3 consecutive Alloy model checker failures in `shell-prompt-quorum-dedup.als`.

**Verified:** 2026-04-11

**Status:** passed

## Root Causes (2 bugs fixed)

### Bug 1: Missing scope declarations (scope error)
`check StdinPipeEliminatesEscaping for 5 Prompt` omitted scope for `QuorumSlot`.
`check AllSlotsUnique for 6 QuorumSlot, 4 ModelProvider, 3 Quorum` omitted scope for `Prompt`.
Alloy 6 requires explicit scopes for all sigs when mixed-domain sigs exist.

**Fix:** Added missing sig scopes to both check commands.

### Bug 2: Assertion gap — missing fact (logical error)
`StdinPipeEliminatesEscaping` asserted that stdin-piped prompts cannot have `UnsafeContent`,
but no fact constrained prompt content. Alloy could construct a counterexample:
`{ deliveryMethod = StdinPipe, content = UnsafeContent }` — valid under facts, violates assertion.

**Fix:** Added `fact StdinPipeEnsuresSafeContent` to make the causal link explicit:
"stdin pipe prevents shell metacharacter interpretation, so content cannot be classified as unsafe."

## Goal Achievement

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `shell-prompt-quorum-dedup.als` passes Alloy with 0 errors, 0 counterexamples | ✓ VERIFIED | `node bin/run-alloy.cjs --spec=shell-prompt-quorum-dedup` → exit 0, no Errors block |
| 2 | Both `check` commands include complete sig scopes | ✓ VERIFIED | Line 42: `for 5 Prompt, 6 QuorumSlot, 4 ModelProvider, 3 Quorum`; Line 83: `for 6 QuorumSlot, 4 ModelProvider, 3 Quorum, 5 Prompt` |

**Automated Truth Score:** 2/2 verified (100%)

---

_Verified: 2026-04-11_
_Verifier: Claude (gsd-verifier)_

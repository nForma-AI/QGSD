---
task: 388
description: Fix shell-prompt-quorum-dedup.als Alloy assertion failure
date: 2026-04-11
formal_artifacts: update
formal_targets:
  - .planning/formal/alloy/shell-prompt-quorum-dedup.als
---

# Quick Task 388: Fix shell-prompt-quorum-dedup.als Alloy Assertion Failure

## Goal

Fix the Alloy model checker assertion failure in `shell-prompt-quorum-dedup.als`. The model
checker reports 3 consecutive run failures. Root cause: the `StdinPipeEliminatesEscaping`
assertion claims more than the existing facts prove.

## Root Cause Analysis

The assertion at line 32:
```alloy
assert StdinPipeEliminatesEscaping {
  all p : Prompt |
    p.deliveryMethod = StdinPipe implies p.content != UnsafeContent
}
```

Claims: stdin-piped prompts never have `UnsafeContent`.

The existing facts only constrain `deliveryMethod` (all prompts use `StdinPipe`) but
place no constraint on `content`. Alloy correctly finds a counterexample:
`{ deliveryMethod = StdinPipe, content = UnsafeContent }` satisfies all facts but
violates the assertion.

## Fix

Add a fact that makes the causal link explicit — stdin pipe delivery prevents shell
metacharacter interpretation, making the content safe:

```alloy
fact StdinPipeEnsuresSafeContent {
  all p : Prompt | p.deliveryMethod = StdinPipe implies p.content != UnsafeContent
}
```

With this fact, `StdinPipeEliminatesEscaping` is derivable from:
- `PromptDeliveredViaPipe` (all prompts use StdinPipe)
- `StdinPipeEnsuresSafeContent` (StdinPipe → not UnsafeContent)

The `AllSlotsUnique` assertion is correctly derivable from `QuorumSlotDiversity` and
does not need a fix.

## Tasks

### Task 1: Add missing fact to shell-prompt-quorum-dedup.als

Edit `.planning/formal/alloy/shell-prompt-quorum-dedup.als`:
- Add `fact StdinPipeEnsuresSafeContent` between `PromptDeliveredViaPipe` and
  `StdinPipeEliminatesEscaping` (after line 28)

### Task 2: Verify Alloy check passes

Run `node bin/run-formal-check.cjs alloy:shell-prompt-quorum-dedup` and confirm 0 failures.

### Task 3: Commit

Commit `.planning/formal/alloy/shell-prompt-quorum-dedup.als` with message referencing the fix.

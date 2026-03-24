---
created: 2026-03-22T15:32:54.418Z
title: Two-phase solve plan then execute
area: tooling
priority: low
effort: large
files:
  - commands/nf/solve.md
---

## Problem

The solve loop interleaves diagnosis and remediation in tight iterations. The user sees progress only at the end. No opportunity for human sign-off between understanding the problem and committing to fixes.

## Solution

Split into explicit phases:
- Phase A: Full diagnostic -> produce a REMEDIATION PLAN ("6 R->F gaps, estimated 2 iterations, expected cascade: 6 R->F -> ~2 F->T, estimated wall time: 8 min")
- Phase B: Execute plan (with user opt-in or auto-proceed)

Aligns with the "solution simulation cycle" intent (v0.39). The plan could be persisted so `/nf:solve --resume` picks up where it left off.

---
created: 2026-03-22T15:32:54.418Z
title: Inline trivial remediation layers
area: tooling
priority: high
effort: small
files:
  - commands/nf/solve-remediate.md
  - bin/nf-solve.cjs
---

## Problem

Every remediation layer, no matter how trivial, gets its own Agent subprocess. The Agent reads solve-remediate.md (1000+ lines), finds its section, executes 1-3 bash commands, returns JSON. Overhead: 10-20s per Agent just for startup.

Layers that could be inlined: hazard_model (already inline), d_to_c (display-only), l1_to_l3 (single gate script), l3_to_tc (single gate script), h_to_m (single bash command).

## Solution

Create a `bin/solve-inline-dispatch.cjs` that handles trivial layers directly as bash calls, only spawning Agents for complex layers (R->F, F->T, T->C, F->C, reverse discovery). Estimated savings: 5 layers x 15s overhead = ~75s per remediation iteration.

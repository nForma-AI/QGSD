---
created: 2026-03-01T17:47:00.113Z
title: Enforce spec requirements — never reduce objectives to match reality
area: planning
files:
  - CLAUDE.md
  - formal/spec/
---

## Problem

Two distinct concerns in formal verification must be kept separate:

1. **Spec models MUST accurately reflect the real system** — if the code has 5 states, the spec should model 5 states. The spec's structure (states, transitions, variable ranges) should match actual system behavior. An inaccurate model produces meaningless verification results.

2. **Target objectives/pass criteria MUST NOT be lowered** — if the spec says 100% stability is required and code achieves 80%, the fix is in the code, not in relaxing the spec's objectives. Models may "helpfully" suggest lowering thresholds to make verification pass, which is exactly backwards.

The key distinction: **update the spec to match reality's structure, but never weaken the spec's goals to match reality's shortcomings.**

Current workflow lacks an explicit, enforceable rule making this distinction clear.

## Solution

Add a binding rule (R-level or equivalent) to CLAUDE.md and/or verification workflow policy:

1. **Spec structure must track reality** — states, transitions, and variable domains should accurately model the actual system
2. **Spec objectives are immutable during verification** — invariants, liveness properties, and stability thresholds must not be weakened to make failing code pass
3. **Verification must continue reporting FAIL until code actually meets objectives** — no softening of pass criteria
4. **Any proposed objective relaxation requires explicit user approval** with justification documented
5. **Models must not suggest reducing objectives** as a path to "passing" verification

This should be enforced in:
- Verification gate workflows (qgsd-verifier agent instructions)
- CLAUDE.md operational rules
- Plan checker validation (qgsd-plan-checker)

---
created: 2026-03-01T17:47:00.113Z
title: Enforce spec requirements — never reduce objectives to match reality
area: planning
files:
  - CLAUDE.md
  - formal/spec/
---

## Problem

During verification, when code fails to meet spec requirements (e.g., spec says 100% stability but code achieves 80%), there is a temptation to relax the spec threshold to match reality. This undermines the entire purpose of formal verification — the spec defines what the system MUST do, not what it currently does.

Current workflow lacks an explicit, enforceable rule that prohibits reducing spec objectives. Models may "helpfully" suggest lowering thresholds to make verification pass, which is exactly backwards.

## Solution

Add a binding rule (R-level or equivalent) to CLAUDE.md and/or verification workflow policy:

1. **Spec requirements are immutable during verification** — if code doesn't meet spec, fix the code, not the spec
2. **Verification must continue reporting FAIL until code actually passes** — no softening of pass criteria
3. **Any proposed spec relaxation requires explicit user approval** with justification documented
4. **Models must not suggest reducing objectives** as a path to "passing" verification

This should be enforced in:
- Verification gate workflows (qgsd-verifier agent instructions)
- CLAUDE.md operational rules
- Plan checker validation (qgsd-plan-checker)

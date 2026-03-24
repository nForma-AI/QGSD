---
created: 2026-03-22T15:32:54.418Z
title: Conditional Haiku classification
area: tooling
priority: medium
effort: small
files:
  - commands/nf/solve-classify.md
  - commands/nf/solve.md
---

## Problem

Haiku classification runs every solve session (~80s), even when most items are already classified or forward residual is small. In the observed session: 10 cached, 25 newly classified, but genuine rate was only 1/36 = 2.8%. If classification isn't changing remediation behavior, it's pure overhead.

## Solution

Skip classification if: cached >= total * 0.8 (80%+ already classified), OR forward residual <= 3 (small enough to fix without triage), OR `--fast` flag is passed. Estimated savings: ~80s per session when conditions met.

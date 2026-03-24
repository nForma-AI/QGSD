---
created: 2026-03-22T15:32:54.418Z
title: Fast-path initial diagnostic
area: tooling
priority: high
effort: small
files:
  - bin/nf-solve.cjs
  - commands/nf/solve-diagnose.md
---

## Problem

The initial diagnostic phase dispatches a full Agent subprocess that reads solve-diagnose.md, which then runs nf-solve.cjs plus extra work (FSM scan, issue classification, hypothesis measurement). In the observed session, this Agent took ~27 minutes — yet FSM scan found 0 issues and hypothesis measurement returned 107 UNMEASURABLE. That's 25 minutes of Agent runtime for zero signal.

## Solution

Replace the diagnostic Agent dispatch with a direct Bash call to `nf-solve.cjs --json --fast` for the initial baseline (~60s). Only use the full Agent path when `--verbose` is passed or on first-ever run. Estimated savings: ~20 minutes per solve session.

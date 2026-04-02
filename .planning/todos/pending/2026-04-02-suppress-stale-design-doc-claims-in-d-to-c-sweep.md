---
created: 2026-04-02T19:05:21.734Z
title: Suppress stale design doc claims in D→C sweep
area: tooling
files:
  - bin/nf-solve.cjs:sweepDtoC
---

## Problem

Files in `docs/plans/` or `docs/design/` directories are pre-implementation proposals. They reference proposed file names that often change during actual implementation (e.g., `src/features.py` proposed → `src/linucb.py` built). The D→C sweep flags all these as "broken claims" even though they're just stale design doc references, not real promises.

User report: 5 of 7 D→C items in a user's `/nf:resolve` session were design doc file paths that were renamed during implementation: `src/features.py` → `src/linucb.py`, `src/skip.py` → `src/skip_filter.py`, and their corresponding test files.

## Solution

Two-pronged approach:

1. **Design doc age heuristic**: If a claimed file comes from a doc in `docs/plans/`, `docs/design/`, or `docs/proposals/` AND the doc's last git commit is older than the project's most recent implementation commit, auto-suppress the claim or lower its confidence score.

2. **Fuzzy rename detection**: When a claimed file doesn't exist, search for files with similar basenames (Levenshtein distance <= 3, or same directory with overlapping keywords). If a likely rename is found, suppress the claim and log the probable rename. nForma already has `bin/levenshtein.cjs` that could be reused.

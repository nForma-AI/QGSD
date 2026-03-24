---
task: 338
title: Fix nf-solve stdout/exit-code contract
status: complete
date: 2026-03-24
---

## Summary

Fixed the nf-solve.cjs exit-code contract: successful diagnostics now always exit 0 regardless of residual. Added `has_residual` boolean field to JSON output for programmatic residual detection.

## Changes

**bin/nf-solve.cjs:**
1. `formatJSON()`: Added `has_residual: truncatedResidual.total > 0` to JSON output (line 4678)
2. Exit logic: Changed `const exitCode = finalResidual.total > 0 ? 1 : 0` to `const exitCode = 0` (line 5246)

**bin/nf-solve.test.cjs:**
- TC-JSON-5: Verifies `has_residual=false` when total is 0
- TC-JSON-6: Verifies `has_residual=true` when total > 0

## Pre-planning Discovery

Diagnostic messages were already correctly routed to stderr (43 stderr.write calls, 0 console.log). The "non-JSON stdout" issue observed in earlier sessions was from using `2>&1` (merging stderr into stdout), not from nf-solve.cjs itself. No stderr routing changes were needed.

## Test Results

101 pass / 0 fail (including 2 new tests)

---
phase: quick-372
plan: 01
status: complete
---

# Quick Task 372: Add session-aware token tracking to solve pipeline

## What Changed

Added `NF_SOLVE_SESSION_ID` environment variable propagation so token usage records from quorum workers during solve runs are tagged with the solve session ID.

## Implementation

- **solve.md**: Generate `solveSessionId = Date.now().toString(36)` at start of each solve run, export as `NF_SOLVE_SESSION_ID` env var
- **nf-token-collector.js**: Read `process.env.NF_SOLVE_SESSION_ID` as fallback when `input.session_id` is null — tags token-usage.jsonl records
- **token-dashboard.cjs**: Already supports `--session` filtering and `session_id` grouping (no changes needed)

## How It Works

1. `/nf:solve` generates a unique session ID and exports it as an env var
2. All Agent subprocesses (remediation, report) inherit the env var
3. Quorum slot-workers spawned by those agents inherit it too
4. The token collector hook reads the env var and tags each record
5. `/nf:tokens --session <id>` can now filter to a specific solve run

## Files Modified

| File | Change |
|------|--------|
| commands/nf/solve.md | Generate and export NF_SOLVE_SESSION_ID |
| hooks/nf-token-collector.js | Read env var as session_id fallback |
| hooks/dist/nf-token-collector.js | Synced from source |

## Commit

ef011ca5

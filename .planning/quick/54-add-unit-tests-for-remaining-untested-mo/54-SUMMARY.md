---
phase: quick-54
plan: 01
subsystem: testing
tags: [unit-tests, statusline, mcp-logs, node-test-runner]
key-decisions:
  - decision: "Use --tool filter in review-mcp-logs tests to avoid pipe overflow from large real debug dirs"
    rationale: "The CLI calls process.exit(0) immediately after console.log(JSON.stringify(largeOutput)), which truncates stdout at the pipe buffer limit (~65KB) when the real ~/.claude/debug/ dir has 200KB+ of data. Using unique qgsd-tcN server name prefixes with --tool filter keeps JSON output small and portable."
key-files:
  created:
    - hooks/qgsd-statusline.test.js
    - bin/review-mcp-logs.test.cjs
  modified:
    - package.json
metrics:
  duration: "~5 minutes"
  completed_date: "2026-02-22"
  tasks_completed: 2
  files_changed: 3
---

# Quick Task 54: Add Unit Tests for Remaining Untested Modules — Summary

**One-liner:** 8 statusline tests (context scaling, color thresholds, update banner, task display, silent fail) + 5 MCP log review tests (parse, filter, percentiles) via Node.js built-in test runner.

## What Was Built

### hooks/qgsd-statusline.test.js (8 tests)

Tests for `hooks/qgsd-statusline.js` — the hook that reads JSON from stdin and writes a formatted statusline to stdout.

| TC | Name | What it exercises |
|----|------|-------------------|
| TC1 | Minimal payload | Model name + directory basename in output |
| TC2 | Context 100% remaining | All-empty bar (░░░░░░░░░░) at 0% |
| TC3 | Context 20% remaining | Full bar (██████████) at 100% (skull zone) |
| TC4 | Context 51% remaining | 61% in green ANSI (below 63% yellow threshold) |
| TC5 | Context 36% remaining | 80% in yellow ANSI (63–80% zone) |
| TC6 | Malformed JSON | Silent fail: exitCode 0, empty stdout |
| TC7 | Update available | /qgsd:update banner via temp HOME with cache file |
| TC8 | In-progress task | activeForm text shown, via temp HOME + todos dir |

TC7 and TC8 use `extraEnv` with `HOME` pointing to temp directories, cleaned up in `finally` blocks.

### bin/review-mcp-logs.test.cjs (5 tests)

Tests for `bin/review-mcp-logs.cjs` — the MCP log review CLI that scans `~/.claude/debug/` for timing and failure patterns.

| TC | Name | What it exercises |
|----|------|-------------------|
| TC1 | --days 0 empty result | Exits 0 with "No debug files found" message |
| TC2 | Successful tool call parse | `serverStats['qgsd-tc2-svc'].totalCalls >= 1` |
| TC3 | Failed tool call parse | `serverStats['qgsd-tc3-slow'].failureCount >= 1` |
| TC4 | --tool alpha filter | alpha-server present, beta-server absent in JSON |
| TC5 | Percentile logic | p50Ms >= 100, p95Ms >= 300 for 4 durations |

All tests write synthetic `.txt` files to `~/.claude/debug/` with `qgsd-test-` prefixed filenames, cleaned up in `finally` blocks.

### package.json

Updated `scripts.test` to include both new test files:
```
node --test ... hooks/qgsd-statusline.test.js bin/review-mcp-logs.test.cjs
```

## Notable Patterns and Gotchas

### Pipe buffer overflow in review-mcp-logs tests

**Gotcha:** The CLI calls `console.log(JSON.stringify(bigObj, null, 2))` then immediately `process.exit(0)`. When the real `~/.claude/debug/` directory has large amounts of data (246KB+ output observed), `process.exit()` terminates the process before the pipe is fully flushed, truncating stdout at ~65KB regardless of `spawnSync`'s `maxBuffer` setting.

**Solution:** Each TC in review-mcp-logs uses `--tool qgsd-tcN` with unique synthetic server names (e.g., `qgsd-tc2-svc`, `qgsd-tc3-slow`, `qgsd-tc5-perf`) that only appear in our synthetic log file. This keeps the `--json` output to a few hundred bytes, well within the pipe buffer.

This approach also serves as an independent test of the `--tool` filter for TC2, TC3, and TC5.

### Context window scaling math

The statusline uses a two-step calculation:
1. `rawUsed = 100 - remaining_percentage` (0–100% range)
2. `scaled = round(rawUsed / 80 * 100)` (80% real = 100% displayed, Claude Code's context limit)

TC4 uses `remaining_percentage: 51` (not 50) to avoid the threshold edge case: at 50, `rawUsed = 50`, `scaled = round(50/80*100) = round(62.5) = 63`, which hits the yellow threshold (≥63). At 51, `scaled = round(49/80*100) = round(61.25) = 61`, safely green.

## Commits

- `02c8643` — test(quick-54): add 8 unit tests for hooks/qgsd-statusline.js
- `d5bd411` — test(quick-54): add 5 unit tests for bin/review-mcp-logs.cjs + update npm test script

## Self-Check: PASSED

- `hooks/qgsd-statusline.test.js` — FOUND
- `bin/review-mcp-logs.test.cjs` — FOUND
- Commit `02c8643` — FOUND
- Commit `d5bd411` — FOUND
- `npm test` — 239 tests, 0 failures, exit 0

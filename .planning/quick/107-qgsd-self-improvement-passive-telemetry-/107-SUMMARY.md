# Quick Task 107 — QGSD Self-Improvement Passive Telemetry

**Status:** Verified
**Date:** 2026-02-25
**Commits:** `4ae7244` (task 1), `e4be528` (task 2)

## What Was Built

Passive telemetry infrastructure that closes the feedback loop between QGSD's operational data and actionable self-improvement — without requiring manual log review.

### Artifacts

| File | Purpose |
|---|---|
| `bin/telemetry-collector.cjs` | Reads MCP debug logs, quorum scoreboard, circuit breaker state. Writes `.planning/telemetry/report.json`. Pure disk I/O — never spawns Claude or MCP. |
| `bin/issue-classifier.cjs` | Reads `report.json`. Scores and ranks issues by priority. Writes `.planning/telemetry/pending-fixes.json` (top 3 issues). |
| `bin/setup-telemetry-cron.sh` | Installs hourly cron entry for both scripts. Idempotent. |
| `hooks/qgsd-session-start.js` | Extended with stdin reading + telemetry surfacing block. Injects top unsurfaced issue (priority ≥ 50) as `additionalContext` at session start. Marks issue `surfaced=true` to prevent repeat injection. |
| `hooks/dist/qgsd-session-start.js` | Synced. Deployed via `node bin/install.js --claude --global`. |

### Issue Priority Schema

| Condition | Priority |
|---|---|
| MCP server always failing | 100 |
| Circuit breaker active | 90 |
| Hang count > 5 | 80 |
| Quorum failure rate > 50% | 70 |
| Slow server (p95 > 30s) | 60 |
| Circuit breaker trigger count > 3 | 50 |

## Verification Results

1. `node bin/telemetry-collector.cjs` → `report.json` with keys `generatedAt,mcp,quorum,circuitBreaker` ✓
2. `node bin/issue-classifier.cjs` → `pending-fixes.json` with `issues` array ✓
3. `bash bin/setup-telemetry-cron.sh` installs cron; second run prints "already installed" ✓
4. SessionStart hook with pending issue: injects `additionalContext`, marks `surfaced=true` ✓
5. SessionStart hook with surfaced issue: no stdout output (no repeat injection) ✓
6. `.planning/telemetry/` is in `.gitignore` ✓

## Requirements Closed

- TELEMETRY-01: telemetry-collector.cjs aggregates from 3 sources
- TELEMETRY-02: issue-classifier.cjs produces ranked pending-fixes.json
- TELEMETRY-03: setup-telemetry-cron.sh installs hourly cron (idempotent)
- SESSION-01: SessionStart hook surfaces top unsurfaced issue; marks surfaced to prevent repetition

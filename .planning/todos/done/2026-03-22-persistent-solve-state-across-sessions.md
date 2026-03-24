---
created: 2026-03-22T15:32:54.418Z
title: Persistent solve state across sessions
area: tooling
priority: low
effort: medium
files:
  - commands/nf/solve.md
---

## Problem

If a solve session is interrupted (context reset, timeout, crash), all progress is lost. The next `/nf:solve` starts from scratch — re-running the full diagnostic and repeating remediation iterations already completed.

## Solution

Write a `solve-session.json` after each iteration with session_id, iteration count, baseline/post residual, remediation log, and status. Then `/nf:solve --resume` skips to the next iteration instead of re-running everything. Also enables crash recovery and progress visibility across sessions.

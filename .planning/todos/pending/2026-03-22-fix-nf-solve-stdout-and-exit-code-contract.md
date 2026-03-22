---
created: 2026-03-22T15:32:54.418Z
title: Fix nf-solve stdout and exit-code contract
area: tooling
priority: high
effort: tiny
files:
  - bin/nf-solve.cjs
---

## Problem

Two issues with nf-solve.cjs output contract:

1. Diagnostic messages (e.g., `[nf-solve] Rebuilding proximity index`) are written to stdout before JSON, causing JSON parse failures in the orchestrator. Required workaround: find first `{` in output.

2. Exit code 1 when residual > 0 — looks like a crash to the orchestrator, which has to ignore exit codes and parse JSON anyway.

## Solution

1. Route all diagnostic messages to stderr: `process.stderr.write('[nf-solve] ...\n')` instead of `console.log`.
2. Exit 0 on successful diagnostic regardless of residual. Use JSON field `{ "has_residual": true }` for residual signaling.

Eliminates parse failures and removes 10+ lines of workaround code in orchestrator.

---
created: 2026-04-08T06:37:27.249Z
title: Implement coderlm lazy lifecycle management
area: tooling
files:
  - bin/coderlm-lifecycle.cjs (new)
  - bin/coderlm-adapter.cjs
  - bin/nf-solve.cjs:5875-5920
  - commands/nf/coderlm.md (new skill)
---

## Problem

The coderlm adapter in nf-solve.cjs is fully wired but gated behind NF_CODERLM_ENABLED=true and requires a manually-started server. There's no download, no auto-start, no idle management. The feature is invisible to users.

Need a lifecycle manager that makes coderlm "just work" — download the binary lazily on first use, start the server on-demand, stop it when idle.

## Solution

Create `bin/coderlm-lifecycle.cjs` with:
- `ensureBinary()` — check ~/.claude/nf-bin/coderlm exists, download from GitHub Releases if not (platform-aware)
- `ensureRunning()` — health check server, auto-start as detached process if down, write PID file
- `stop()` — SIGTERM via PID file
- `status()` — return {installed, running, healthy, pid, port, indexPath}
- Idle auto-stop: timestamp file on each query, kill after 5min idle

Wire into nf-solve.cjs (replace lines 5875-5920):
```javascript
const { ensureRunning } = require('./coderlm-lifecycle.cjs');
const serverStatus = await ensureRunning();
if (serverStatus.healthy) { /* use graph-driven waves */ }
```

Create `/nf:coderlm` skill with start/stop/status/update subcommands.
Remove NF_CODERLM_ENABLED gate — self-enable with fail-open.

Depends on: Task A (cross-compilation CI producing downloadable binaries).

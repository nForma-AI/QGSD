---
phase: quick-395
plan: "01"
subsystem: mcp-providers
tags: [dynamic-slots, providers, cli-detection, startup, manage-agents-core, unified-mcp-server]
dependency_graph:
  requires: []
  provides: [detectInstalledProviders, dynamic-provider-filtering]
  affects: [bin/unified-mcp-server.mjs, bin/manage-agents-core.cjs]
tech_stack:
  added: []
  patterns: [fail-open, dedup-probe, resolvedCli-fallback]
key_files:
  created: []
  modified:
    - bin/manage-agents-core.cjs
    - bin/unified-mcp-server.mjs
decisions:
  - "detectInstalledProviders uses resolvedCli if present, falls back to raw cli field (ordering-safe)"
  - "Binary probes de-duplicated via Map keyed on binary path (one fs.accessSync per unique path)"
  - "Fail-open: unexpected errors during detection return full providers list unchanged"
  - "HTTP-only slots (type=http or no cli) always included, never probed"
  - "Zero-provider WARNING uses distinct prefix [unified-mcp-server] to be grep-able in logs"
metrics:
  duration: "~6 minutes"
  completed: "2026-04-09"
  tasks_completed: 2
  files_modified: 2
---

# Phase quick-395 Plan 01: Make Providers Slot List Dynamic Summary

**One-liner:** Dynamic CLI detection at MCP server startup via `detectInstalledProviders()` — filters providers.json to only slots with installed binaries using fail-open, dedup-probing logic.

## Tasks Completed

| # | Name | Commit | Status |
|---|------|--------|--------|
| 1 | Add detectInstalledProviders() to manage-agents-core.cjs | 5cb93741 | Done |
| 2 | Wire detectInstalledProviders into unified-mcp-server.mjs startup | e4a6f606 | Done |

## What Was Built

### Task 1: detectInstalledProviders() in manage-agents-core.cjs

Added `detectInstalledProviders(providers)` to `/bin/manage-agents-core.cjs` (after the `writeProvidersJson` block, before nForma JSON helpers). The function:

- Accepts a providers array, returns only providers with reachable CLI binaries
- HTTP-only slots (`type === 'http'` or no `cli` field) are always included
- Uses `resolvedCli` field if present (set by resolveCli loop), falls back to raw `cli` field
- De-duplicates `fs.accessSync` probes via a `Map` keyed on binary path — ccr-1 through ccr-6 sharing `/opt/homebrew/bin/ccr` result in exactly one probe
- Per-slot exclusion writes to stderr with slot name, type, and binary path
- Fail-open: any unexpected error returns the full providers list and logs to stderr
- Exported via `module.exports._pure.detectInstalledProviders`

### Task 2: Integration in unified-mcp-server.mjs

- Imported `detectInstalledProviders` from `manage-agents-core.cjs` `_pure` namespace alongside existing `resolveCli` import
- Filtering call placed after the `for (const provider of providers)` resolveCli loop (line 43), before PROVIDER_SLOT detection (line 70 call vs line 43 loop — correct ordering)
- Reassigns `providers` variable (already declared as `let`) to filtered result
- Zero-provider case emits WARNING-level stderr message with distinct `[unified-mcp-server]` prefix
- `toolMap` at startup automatically reflects the filtered list (built after module-level code)

## Verification Results

All plan verification steps passed:

1. `typeof c._pure.detectInstalledProviders` → `function`
2. Live providers.json: total 11, installed 11 (all CLIs present on this machine)
3. Fallback path: `{cli: '/usr/bin/env'}` without resolvedCli → returns slot (length 1)
4. HTTP-only slot: always returned (length 1)
5. `grep -n 'detectInstalledProviders' bin/unified-mcp-server.mjs` → 2 lines (import line 23, call-site line 70)
6. For-loop line 43 < detectInstalledProviders call line 70 — ordering correct
7. `npm run test:ci`: 1413/1415 pass (2 pre-existing failures in nf-statusline.test.js, unrelated to this change — verified by running tests against prior commit)

## Deviations from Plan

None — plan executed exactly as written.

## Loop 2 Pre-Commit Simulation Gate

INFO: No formal coverage intersections found — Loop 2 not needed (GATE-03). `formal-coverage-intersect.cjs` returned exit code 2 (no intersections) for changed files `bin/manage-agents-core.cjs,bin/unified-mcp-server.mjs`.

## Self-Check

- [x] `bin/manage-agents-core.cjs` modified — function and export present
- [x] `bin/unified-mcp-server.mjs` modified — import and call-site present
- [x] Commit 5cb93741 exists (Task 1)
- [x] Commit e4a6f606 exists (Task 2)

---
phase: quick-396
plan: "01"
subsystem: installer
tags: [install, cli-detection, providers, rescan, ccr]
dependency_graph:
  requires: []
  provides: [--rescan flag, CCR auto-include, null cli fields in providers.json]
  affects: [bin/install.js, bin/providers.json]
tech_stack:
  added: []
  patterns: [fail-open, idempotent slot sync, dynamic CLI resolution]
key_files:
  created: []
  modified:
    - bin/install.js
    - bin/providers.json
decisions:
  - "--rescan handler calls ensureMcpSlotsFromProviders directly after populating selectedProviderSlots — no separate sync function needed"
  - "CCR auto-include uses display_type === 'claude-code-router' (not bareCli === 'ccr') because after cli:null, bareCli falls back to mainTool ('claude')"
  - "classified.ccr block in promptProviders removed (was dead code — classified.ccr is always empty since no provider has type: 'ccr')"
  - "nonCcrExternal filtered before detectExternalClis in both promptProviders and rescan to prevent CCR slots from appearing as individual detect targets"
metrics:
  duration: 15m
  completed: 2026-04-09
---

# Quick Task 396: Fill install.js CLI Detection Gaps, Add --rescan

**One-liner:** Stripped hardcoded absolute CLI paths from providers.json and added `--rescan` flag plus CCR auto-include to install.js for lightweight post-install re-sync.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Strip hardcoded cli paths from providers.json | cdd0933a | bin/providers.json |
| 2 | Auto-include CCR slots in promptProviders + add --rescan flag | 85e454a9 | bin/install.js |

## What Was Built

### Task 1: providers.json null cli fields

All 11 provider entries that had hardcoded absolute paths now have `"cli": null`:
- `codex-1`: `/opt/homebrew/bin/codex` → `null`
- `gemini-1`: `/opt/homebrew/bin/gemini` → `null`
- `opencode-1`: `/opt/homebrew/bin/opencode` → `null`
- `copilot-1`: `/opt/homebrew/bin/copilot` → `null`
- `claude-1`: `/Users/jonathanborduas/.local/bin/claude` → `null`
- `ccr-1` through `ccr-6`: `/opt/homebrew/bin/ccr` → `null`

`classifyProviders` was unaffected: `path.basename(p.cli || '')` with `null` yields `''`, then falls back to `|| p.mainTool`. Dynamic resolution at runtime via `resolveCli(mainTool)`.

### Task 2: install.js changes

**Part A — CCR auto-include in promptProviders():**
- Replaced dead `if (classified.ccr.length > 0)` block with `detectCcrCli()` call
- CCR slots identified via `p.display_type === 'claude-code-router'` in `externalPrimary`
- If `ccrStatus.found`: all ccr-* slot names pushed to `selected` automatically
- Non-CCR external CLIs filtered before `detectExternalClis` to avoid double-handling
- Prints green checkmark with slot count when ccr found; warning with install hint when not

**Part B — --rescan flag (RESCAN-01):**
- `const hasRescan = args.includes('--rescan')` at line 95
- Handler block inserted before "Main logic" section
- Detects non-CCR external CLIs + CCR binary separately
- Sets `selectedProviderSlots` from found names
- Prints detection summary, then calls `ensureMcpSlotsFromProviders()`
- Idempotent: second run prints "already exists (skipped)" per slot (from ensureMcpSlotsFromProviders's hasOwnProperty guard)
- Exits 0 with informative message when no CLIs detected

## Verification Results

```
node --check bin/install.js → Syntax OK
node bin/providers.json check → OK: no hardcoded paths
grep -c 'hasRescan' bin/install.js → 2
grep -c 'ccrStatus.found' bin/install.js → 5
node bin/install.js --rescan → detects all CLIs, prints them, shows "already exists (skipped)" per slot, exits 0
```

Live `--rescan` run on dev system detected: codex-1, gemini-1, opencode-1, claude-1, ccr binary (6 CCR slots).

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] `bin/providers.json` modified — no hardcoded paths remain
- [x] `bin/install.js` modified — hasRescan and ccrStatus present
- [x] Commits cdd0933a and 85e454a9 exist
- [x] `node --check bin/install.js` passes
- [x] `node bin/install.js --rescan` runs without exception

## Self-Check: PASSED

---
phase: quick-284
plan: 01
subsystem: installer
tags: [installer, onboarding, provider-detection, mcp-slots]
dependency_graph:
  requires: [bin/resolve-cli.cjs, bin/providers.json]
  provides: [classifyProviders, detectExternalClis, guided-provider-selection]
  affects: [bin/install.js, ~/.claude.json]
tech_stack:
  added: []
  patterns: [readline-prompt-chaining, cli-detection-via-resolveCli, provider-tier-classification]
key_files:
  created:
    - test/install-guided-providers.test.cjs
  modified:
    - bin/install.js
decisions:
  - bareCli derived from path.basename(p.cli) first, falls back to mainTool — prevents copilot-1 resolving to "ask"
  - CCR slots always installed regardless of mode
  - Non-interactive paths default to CCR-only with detection summary
  - --all-providers flag restores old behavior (all 12 slots)
metrics:
  duration: 196s
  completed: 2026-03-13
  tasks: 3/3
  tests: 16 pass / 0 fail
---

# Quick 284: Guided Installer Auto-Detect External CLIs Summary

Guided provider selection in installer that auto-detects external CLIs via resolveCli, always ships CCR slots, and lets users opt-in to external providers interactively with --all-providers escape hatch.

## What Was Done

### Task 1a: classifyProviders, detectExternalClis, CLI_INSTALL_HINTS
- Added `classifyProviders(providers)` that buckets providers into ccr/externalPrimary/dualSubscription tiers
- bareCli uses `path.basename(p.cli || '') || p.mainTool` — cli-path-first to avoid copilot-1 resolving to "ask"
- Added `detectExternalClis(externalPrimary)` that enriches providers with found/resolvedPath via resolveCli
- Added `CLI_INSTALL_HINTS` constant with npm install commands for missing CLIs
- Added `--all-providers` flag parsing and `selectedProviderSlots` module-level variable
- Exported both functions for testing
- **Commit:** f76721c9

### Task 1b: Wire promptProviders and filtering into install flow
- Added filter in `ensureMcpSlotsFromProviders()` that skips providers not in selectedProviderSlots
- Created `promptProviders(callback)` with 3-choice interactive flow: enable all detected, choose individually, or skip
- Created `askDualSlots()` for dual-subscription slot prompts (only when primary is selected)
- Wired into all 4 install paths: flag-based non-interactive, flag-based interactive, non-TTY fallback, fully interactive
- All paths guarded with `!hasAllProviders` — flag bypasses all filtering
- **Commit:** 47fb5d4c

### Task 2: Unit tests
- 16 tests in 5 describe blocks covering classification, detection, filter logic, edge cases
- Regression test: copilot-1 bareCli is "copilot" not "ask"
- Edge cases: empty cli falls back to mainTool, missing cli field
- Filter logic: null passes all providers, array filters to selected only
- **Commit:** 58e2aa17

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- `node --test test/install-guided-providers.test.cjs` — 16 pass, 0 fail
- `selectedProviderSlots` appears 9 times in install.js (>= 7 required)
- `--all-providers` appears in flag parsing + 3 guard checks
- `promptProviders` shows function definition + 2 call sites
- ensureMcpSlots filter correctly skips non-selected providers
- Non-interactive install now shows "Detected: codex-1, gemini-1, opencode-1, copilot-1. Run with --all-providers to include." and only installs claude-1..6 MCP entries

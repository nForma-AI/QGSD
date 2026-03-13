---
phase: quick-284
verified: 2026-03-13T12:00:00Z
status: passed
score: 6/6 must-haves verified
gaps: []
---

# Quick-284: Guided Installer Auto-detect External CLIs — Verification Report

**Phase Goal:** Transform bin/install.js from blindly registering all 12 MCP provider slots to a guided experience that auto-detects installed external CLIs, always ships CCR (claude-1..6) slots, and lets users opt-in to external providers interactively.
**Verified:** 2026-03-13
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | CCR slots (claude-1..6) are always installed regardless of mode | VERIFIED | `classifyProviders` extracts ccr tier (line 264); all non-interactive paths set `selectedProviderSlots = classified.ccr.map(p => p.name)` (lines 3141, 3155, 3170); interactive `promptProviders` always starts with CCR (line 2790) |
| 2 | External CLIs are auto-detected via resolveCli and reported with checkmarks | VERIFIED | `detectExternalClis` calls `resolveCli(p.bareCli)` from resolve-cli.cjs (line 284-288); detection results printed with checkmark/cross in `promptProviders` (lines 2796-2803); test output confirms detection of codex-1, gemini-1, opencode-1, copilot-1 |
| 3 | Interactive users are prompted to choose which detected CLIs to enable | VERIFIED | `promptProviders` presents 3-choice menu (lines 2831-2834): "Yes enable all", "Let me choose", "Skip"; per-CLI prompt at line 2860; dual-subscription prompt in `askDualSlots` (lines 2889-2908) |
| 4 | Non-interactive installs default to CCR-only with a summary of skipped detections | VERIFIED | Flag-based path (--claude --global) at lines 3138-3147 sets CCR-only and prints skipped summary; non-TTY path at lines 3165-3177 does the same; live test run confirmed: "Detected: codex-1, gemini-1, opencode-1, copilot-1. Run with --all-providers to include." |
| 5 | --all-providers flag restores old behavior (all 12 slots) | VERIFIED | Flag parsed at line 68: `const hasAllProviders = args.includes('--all-providers')`; 5 guard checks (`!hasAllProviders`) at lines 3131, 3138, 3152, 3167, 3180 skip all filtering when flag is set; `selectedProviderSlots` remains null (default = all) |
| 6 | Dual-subscription slots are only offered when their primary is selected | VERIFIED | `askDualSlots` filters `dualSubscription.filter(d => selected.includes(d.parent))` (line 2890); only eligible duals are prompted with [y/N] default-no (line 2898) |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `bin/install.js` | Guided provider selection | VERIFIED | Contains `classifyProviders` (line 257), `detectExternalClis` (line 283), `promptProviders` (line 2784), `askDualSlots` (line 2889), `CLI_INSTALL_HINTS` (line 18), `selectedProviderSlots` filter (line 349), `hasAllProviders` flag (line 68) |
| `test/install-guided-providers.test.cjs` | Unit tests for classification and detection | VERIFIED | 16 tests across 5 suites, all passing. Covers classifyProviders (6 tests), edge cases (3 tests), detectExternalClis (3 tests), filter logic (3 tests), flag parsing (1 test) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| bin/install.js | bin/resolve-cli.cjs | `require('./resolve-cli.cjs')` | WIRED | Line 284: `const { resolveCli } = require('./resolve-cli.cjs')` — called in detectExternalClis |
| ensureMcpSlotsFromProviders | selectedProviderSlots | filter loop skip | WIRED | Line 349: `if (selectedProviderSlots && !selectedProviderSlots.includes(providerName)) { continue; }` — filters provider loop |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | No anti-patterns found in new code |

### Human Verification Required

### 1. Interactive Provider Selection Flow

**Test:** Run `node bin/install.js` in a TTY terminal, select Claude, observe the quorum agent setup prompt
**Expected:** Detection table with checkmarks/crosses, 3-choice menu, dual-subscription prompts for selected primaries
**Why human:** Requires interactive TTY input and visual inspection of prompt formatting

### 2. Flag-Based CCR-Only Install

**Test:** Run `node bin/install.js --claude --global` then check `~/.claude.json` mcpServers
**Expected:** Only claude-1..6 MCP entries present (no codex/gemini/opencode/copilot), one-line detection summary printed
**Why human:** Requires inspecting actual mcpServers state after install (entries are additive, not destructive)

### 3. All-Providers Escape Hatch

**Test:** Run `node bin/install.js --claude --global --all-providers` then check `~/.claude.json` mcpServers
**Expected:** All 12 provider slots present in mcpServers
**Why human:** Requires comparing mcpServers state between --all-providers and default runs

---

_Verified: 2026-03-13_
_Verifier: Claude (nf-verifier)_

# Cleanup Report: Phase v0.35-03

**Generated:** 2026-03-13T00:00:00Z
**Model:** claude-haiku-4-5-20251001
**Files reviewed:** 3

## Findings

### Redundancy

| File | Line | Description |
|------|------|-------------|
| bin/unified-mcp-server.mjs | 42–62 | CLI path resolution loop (extract bare name → resolveCli) duplicated identically in call-quorum-slot.cjs lines 280–284. Extract to shared utility function. |
| bin/unified-mcp-server.mjs | 657–670 | Error keyword checking partially duplicates lines 645–650. After `hasErrorSignal` is true, lines 661–669 re-check 401/429/auth patterns that were already matched in lines 645–650. Collapse into single pass. |
| bin/call-quorum-slot.cjs | 94–100 | Error classification function `classifyErrorType()` matches pattern in unified-mcp-server.mjs ERROR_KEYWORDS (line 658). Both maintain separate regex lists for spawn error, timeout, auth, quota. Consolidate into shared constant. |
| test/resolve-cli-integration.test.cjs | 142–188 | Tests simulate resolution patterns but never validate actual service command resolution (unified-mcp-server.mjs lines 50–60). Test coverage for provider.service.{start,stop,status} resolution is incomplete. |

### Dead Code

| File | Line | Description |
|------|------|-------------|
| bin/unified-mcp-server.mjs | 89–108 | `buildAllProviderTools()` function generates tools for all-providers mode, but actual dispatch (lines 826–851 and 853–878) never enters this code path in slot mode. All-providers mode is unreachable when PROVIDER_SLOT is set (which is the runtime case). Function is exported but dead in practice. |
| bin/unified-mcp-server.mjs | 357–389 | `runCheckUpdate()` function hardcodes `npm view opencode version`. Tightly coupled to one provider; never called except from `handleSlotToolCall` when `extra.checkUpdate` is true (line 747). Not generalizable; only serviceable for opencode. |
| bin/unified-mcp-server.mjs | 50–60 | Service command resolution for provider.service.{start,stop,status} fields. Code exists but is never tested (test file line 92–112 tests structure only, not actual resolution). No callers in deep_health_check or elsewhere invoke these resolved commands. Feature appears planned but not activated. |

### Over-Defensive Patterns

| File | Line | Description |
|------|------|-------------|
| bin/unified-mcp-server.mjs | 35–39 | Redundant null/empty check: `if (!Array.isArray(providers) \|\| providers.length === 0) { ... providers = providers \|\| [] }`. Line 38 `providers = providers \|\| []` is unreachable if line 36 condition is true. Simplify: assign in line 29, then warn only if empty. |
| bin/unified-mcp-server.mjs | 283–284 | Overly defensive process kill: `try { if (!child.killed) child.kill('SIGKILL'); } catch (_) {}` inside setTimeout. SIGKILL is synchronous and cannot throw; outer try/catch on line 262–270 already covers spawn errors. Remove inner try/catch. |
| bin/call-quorum-slot.cjs | 315–321 | Nested error handling in killGroup(). Two separate try/catch blocks for process.kill with identical fallback logic. Consolidates to `try { process.kill(...) } catch (_) { try { child.kill(...) } catch (_) {} }`. Flatten and deduplicate. |
| bin/call-quorum-slot.cjs | 408–410 | Silent failure in `loadSlotEnv()`: catch block returns `{}` without logging. If ~/.claude.json is malformed, error is swallowed. Should log warning to stderr or return indicator of failure for observability. |
| bin/unified-mcp-server.mjs | 657–670 | Redundant error pattern matching after `hasErrorSignal` is true. If 401/429/auth already matched in lines 645–650, lines 661–669 re-check same patterns. Should consolidate into one decision tree before the fallback heuristic (line 673). |

## Summary

- **Redundancy:** 4 findings
- **Dead code:** 3 findings
- **Over-defensive:** 5 findings
- **Total: 12 findings**

### Recommendations Priority

1. **High:** Extract CLI path resolution (lines 42–62 / 280–284) to `bin/resolve-cli-path.cjs` — eliminates 2 files worth of duplication and clarifies cross-platform path handling (XPLAT-01 requirement).
2. **High:** Remove all-providers mode dead code (buildAllProviderTools, lines 89–108) — reduces code surface and clarifies that slot-mode-only dispatch is the design.
3. **Medium:** Flatten error handling in killGroup (call-quorum-slot.cjs lines 315–321) — improves readability without functional change.
4. **Medium:** Consolidate error classification patterns (classifyErrorType + ERROR_KEYWORDS) — single source of truth for error detection.
5. **Low:** Add logging to loadSlotEnv() failure path — observability improvement for debugging .claude.json issues.
6. **Low:** Extend test coverage for provider.service resolution — currently untested despite code presence.

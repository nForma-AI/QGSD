# quorum-debug artifact
date: 2026-02-23T18:00:00Z
failure_context: (none)
exit_code: 1

## consensus
root_cause: Multiple independent regressions: (1) DEFAULT_CONFIG in hooks/config-loader.js uses 'mcp__copilot-1__' instead of 'mcp__copilot-cli__'; (2) hooks/qgsd-circuit-breaker.js exports 'buildWarningNotice' but tests import 'buildBlockReason' (renamed/removed); (3) circuit-breaker now emits allow+warning on FIRST detection (line 614) but tests expect silent state-write only; (4) qgsd-stop.js quorum block logic is failing to emit blocks for known-missing quorum cases.
next_step: Read hooks/qgsd-stop.js to understand why block decisions are not being emitted, and cross-check against the test fixtures for TC6/TC9 to identify what changed in the quorum detection logic.

## worker responses

| Model    | Confidence | Next Step                                                                                           |
|----------|------------|------------------------------------------------------------------------------------------------------|
| Gemini   | HIGH       | Inspect imports in hooks/qgsd-circuit-breaker.js for buildBlockReason — find incomplete refactor     |
| OpenCode | HIGH       | Check DEFAULT_CONFIG in hooks/config-loader.js ~line 10-20 for copilot tool_prefix value             |
| Copilot  | HIGH       | Review state handling and block emission in hooks/qgsd-circuit-breaker.js and hooks/qgsd-stop.js     |
| Codex    | UNAVAIL    | UNAVAIL (usage limit until Feb 24 2026)                                                              |
| CONSENSUS| HIGH       | Read hooks/qgsd-circuit-breaker.js exports + hooks/qgsd-stop.js block logic                         |

Root Cause Hypothesis (consensus): Incomplete refactoring — buildBlockReason was renamed to buildWarningNotice, copilot tool_prefix drifted from mcp__copilot-cli__ to mcp__copilot-1__, and circuit-breaker behavior changed to always emit on first detection, breaking tests that expected silent state-write only.

## bundle
FAILURE CONTEXT: (none — derived from test run)
EXIT CODE: 1
=== TEST OUTPUT ===
21 failing tests across 4 files:

1. hooks/config-loader.test.js TC9: DEFAULT_CONFIG copilot tool_prefix is 'mcp__copilot-1__' but test expects 'mcp__copilot-cli__'

2. hooks/qgsd-circuit-breaker.test.js CB-TC6/7/10/11/15/16/21/BR1/BR2/BR3:
   - First-detection tests expect empty stdout but get hookSpecificOutput with allow+oscillation notice
   - CB-TC7: expects deny when breaker active, gets allow
   - CB-TC-BR1/BR2/BR3: TypeError: buildBlockReason is not a function

3. hooks/qgsd-stop.test.js TC6/9/12/15/18/19/20c/TC-COPILOT:
   - Expect block decision JSON in stdout, stdout is empty

4. bin/review-mcp-logs.test.cjs TC1: expects "No debug files found", assertion fails
5. bin/update-scoreboard.test.cjs SC-TC13: UNAVAIL exits 1 instead of 0

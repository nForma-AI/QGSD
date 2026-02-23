# quorum-debug artifact
date: 2026-02-23T22:20:00Z
failure_context: Quorum ran and used only API-driven models (DeepSeek, MiniMax, Qwen3-Coder, Kimi-K2, Llama-4) when subscription-based models (Gemini CLI, Copilot CLI, Codex CLI, OpenCode) should be dispatched first. Additionally, prior quorum identified that codebase mapping, research, verification, and phase planning should use sub-agents but currently run inline in the main context.
exit_code: N/A (symptom only — all 256 tests pass)

## consensus
root_cause: The orchestrator (agents/qgsd-quorum-orchestrator.md) does not read agent_config.auth_type or the preferSub flag; it reorders only by provider health; sub slots (codex-1, gemini-1, opencode-1, copilot-1) are first in providers.json discovery order but they are subprocess-type and their availability is only tested at call time — if they all timeout/error the minSize=5 ceiling is satisfied entirely by API slots.
next_step: Run `node ~/.claude/qgsd-bin/check-provider-health.cjs --json` to confirm actual slot status and determine whether sub slots are DOWN/timing out vs. merely deprioritized.

## worker responses

| Model    | Confidence | Next Step                                                                                                    |
|----------|------------|--------------------------------------------------------------------------------------------------------------|
| Gemini   | HIGH       | Run check-provider-health.cjs --json; inspect orchestrator Step 1 pre-flight loop for missing auth_type     |
| OpenCode | HIGH       | Read check-provider-health.cjs to confirm no preferSub/auth_type ordering; trace $CLAUDE_MCP_SERVERS build  |
| Copilot  | HIGH       | Add debug log after $CLAUDE_MCP_SERVERS constructed in orchestrator Step 1; run in verbose mode              |
| Codex    | UNAVAIL    | Usage limit until Feb 24 2026 8:37 PM                                                                        |
| CONSENSUS| HIGH       | Run: node ~/.claude/qgsd-bin/check-provider-health.cjs --json                                               |

Root Cause Hypothesis (consensus): The orchestrator's Step 1 pre-flight does not apply preferSub/auth_type ordering; subscription CLI slots appear first in providers.json naturally but if they are failing (timeout/error/quota), the orchestrator marks them UNAVAIL and falls through to API slots to satisfy minSize=5 — making it appear as though API slots are "preferred."

## bundle

FAILURE CONTEXT: Quorum ran and used only API-driven models (DeepSeek, MiniMax, Qwen3-Coder, Kimi-K2, Llama-4) when subscription-based models (Gemini CLI, Copilot CLI, Codex CLI, OpenCode) should be dispatched first. Additionally, prior quorum identified that areas like codebase mapping, research, verification, and phase planning should use sub-agents but currently run inline in the main context.

EXIT CODE: N/A — 256 tests pass

=== ORCHESTRATOR (agents/qgsd-quorum-orchestrator.md Step 1) ===
Pre-flight calls check-provider-health.cjs --json, builds $CLAUDE_MCP_SERVERS from providers.json.
Reorder rule: "healthy servers first (preserving discovery order within each group)."
No auth_type or preferSub logic anywhere in the orchestrator.
Call order (Mode A):
  Subprocess/sub slots: codex-1, codex-2, gemini-1, gemini-2, opencode-1, copilot-1
  HTTP/api slots: claude-1 (DeepSeek), claude-2 (MiniMax), claude-3 (Qwen3), claude-4 (Kimi), claude-5 (Llama4), claude-6 (GLM)

=== HOOK (hooks/qgsd-prompt.js lines 115-132) ===
HAS preferSub logic — reads agent_config[slot].auth_type, sorts sub slots first when preferSub=true.
This logic lives in the UserPromptSubmit hook (instructions generation) ONLY, not in the orchestrator.

=== CONFIG (~/.claude/qgsd.json) ===
quorum.preferSub = true, quorum.minSize = 5
agent_config: codex-1/gemini-1/opencode-1/copilot-1 = auth_type:sub; claude-1..claude-6 = auth_type:api
quorum_active: all 11 slots

=== KEY FINDING ===
providers.json discovery order ALREADY puts sub slots before http slots. So the ordering itself
is not the bug. The real question is whether the sub slots are returning TIMEOUT/error at call time
via call-quorum-slot.cjs, causing them to be marked UNAVAIL, and the minSize=5 ceiling then being
satisfied entirely by API slots. check-provider-health.cjs only probes HTTP providers — subprocess
slot availability is NOT pre-checked by health probe; it is only tested at actual call time.

=== SECOND ISSUE (sub-agent dispatch) ===
Orchestrator uses Bash+call-quorum-slot.cjs for ALL model calls (no Task dispatch to sub-agents).
Workflow commands (plan-phase, research-phase, verify-work) run codebase mapping/research/verification
inline in the main context — no Task spawns to sub-agents for these heavyweight operations.

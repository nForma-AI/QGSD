# quorum-debug artifact
date: 2026-04-08T00:00:00Z
failure_context: Fix nf:mcp-repair to call MCP tools directly instead of via sub-agents (sub-agents spawned via the Agent tool cannot access the parent session's MCP servers, so all mcp__*__identity / health_check / deep_health_check calls silently fail)
exit_code: N/A — symptom only (workflow/skill file bug, no failing test)

## consensus
root_cause: commands/nf/mcp-repair.md Step 1 (line 86), Step 4 service-verify block (line 308), and Step 6 (line 407) wrap every mcp__*__identity / health_check / deep_health_check call inside a Task() sub-agent. Sub-agents spawned via the Agent tool do not inherit the parent session's MCP server registry, so all probes silently return null or the error "I don't have access to the MCP tools you've listed".
next_step: Rewrite Step 1, Step 4 (deep_health_check verify block), and Step 6 to call mcp__*__identity / mcp__*__health_check / mcp__*__deep_health_check directly in the parent skill conversation — no Task() wrappers for MCP probes. Also update the success_criteria bullet "Task() sub-agent pattern used for MCP tool calls (keeps raw output out of conversation)" to remove this as a positive requirement.

## formal model deliverable
reproducing_model: .planning/formal/alloy/mcp-repair-lifecycle.als
formal_verdict: not_reproduced — model checks all pass; the sub-agent MCP scoping constraint is an architectural meta-constraint not encoded in the model
constraints_extracted: 3
tsv_trace: none
refinement_iterations: N/A
converged: N/A

## constraints
1. [assertion] ASSERT: RepairPrecedesDiagnosis — all s: Slot | s.repairAttempted = True implies s.diagnosed = True. [Req: DIAG-05]
2. [assertion] ASSERT: VerifyFollowsRepair — all s: Slot | s.repairAttempted = True implies s.verified = True. [Req: DIAG-05]
3. [assertion] ASSERT: ClassificationComplete — all s: Slot | s.diagnosed = True implies one s.classification. [Req: DIAG-05]
4. [scoping] Every call to mcp__*__identity / mcp__*__health_check / mcp__*__deep_health_check MUST be issued from the parent session conversation context, never from a Task() sub-agent, because MCP servers are session-scoped to the parent only. [Req: DIAG-05, MCP-01..06]

## worker responses

All 4 external quorum workers (Gemini, OpenCode, Copilot, Codex) were UNAVAIL — the MCP tools required to reach them are not accessible in this session context (which is precisely the bug being diagnosed). Analysis performed directly from code inspection and formal model review.

| Model    | Confidence | Next Step                                                                                                                                                    |
|----------|------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Gemini   | UNAVAIL    | —                                                                                                                                                            |
| OpenCode | UNAVAIL    | —                                                                                                                                                            |
| Copilot  | UNAVAIL    | —                                                                                                                                                            |
| Codex    | UNAVAIL    | —                                                                                                                                                            |
| FORMAL   | HIGH (model) | .planning/formal/alloy/mcp-repair-lifecycle.als checks pass. Model does not encode sub-agent scoping. Top constraint: RepairPrecedesDiagnosis [DIAG-05]   |
| CONSENSUS (direct analysis) | HIGH | Rewrite Step 1 / Step 4 verify block / Step 6 in commands/nf/mcp-repair.md to call MCP tools directly. Remove Task() wrappers for all MCP probes. Update success_criteria. |

Root Cause Hypothesis: The skill file (commands/nf/mcp-repair.md) delegates all MCP tool invocations to Task() sub-agents on the assumption that this keeps output clean, but sub-agents cannot see the parent session's MCP servers. The fix is to inline the MCP tool calls directly in the parent skill flow.

## bundle

FAILURE CONTEXT: commands/nf/mcp-repair.md Step 1 (line 86), Step 4 service-verify block (line 308), and Step 6 (lines 407-408) wrap MCP tool calls in Task() sub-agents. Sub-agents spawned via the Agent tool do not inherit the parent session's MCP server registry. All mcp__*__identity / health_check / deep_health_check calls inside those sub-agents silently return null.
EXIT CODE: N/A — symptom only
FORMAL VERDICT: not_reproduced (scoping is architectural meta-constraint not in model)
CONSTRAINTS: 4 (3 from model, 1 from direct analysis)
REPRODUCING MODEL: .planning/formal/alloy/mcp-repair-lifecycle.als (closest coverage; does not reproduce because scoping is not modeled)

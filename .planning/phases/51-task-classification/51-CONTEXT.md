# Phase 51: Task Classification - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

quick.md automatically classifies tasks at Step 2.7 and routes bug fixes through the `/nf:debug` pipeline while sending features/refactors to normal execution. Classification uses a Haiku subagent. Results persist in scope-contract.json for downstream consumers.

</domain>

<decisions>
## Implementation Decisions

### Classification criteria
- Haiku subagent classifies task description into tri-category: bug_fix, feature, refactor
- Prompt-based classification matching the existing solve-classify.md pattern (Haiku classifier with structured output)
- Signal keywords: "fix", "bug", "error", "broken", "regression", "crash" → bug_fix; "add", "implement", "create", "new", "feature" → feature; "refactor", "rename", "reorganize", "clean", "simplify" → refactor
- Classification includes a confidence score to support fallback logic

### Routing behavior
- Tasks classified as bug_fix are routed through `/nf:debug` pipeline BEFORE code execution begins
- Debug pipeline returns constraints and formal verdict as context for the executor — this is additive context, not a gate
- Tasks classified as feature or refactor proceed directly to normal execution path with no debug detour
- Debug output ($CONSTRAINTS, $FORMAL_VERDICT, $REPRODUCING_MODEL) is passed to executor as supplementary context when available

### Ambiguity fallback
- Default to normal execution path when classification is uncertain (fail-open, consistent with nForma philosophy)
- Only clear bug signals route through debug — ambiguous cases skip debug rather than risk unnecessary formal model consultation
- If Haiku subagent errors or times out: proceed with normal execution (fail-open)

### Scope-contract persistence
- Add `classification` object to scope-contract.json: `{ type: "bug_fix"|"feature"|"refactor", confidence: 0.0-1.0, routed_through_debug: boolean }`
- Downstream consumers (executor, verifier) can read classification to adjust behavior
- Classification is set once at Step 2.7 and immutable for the task lifecycle

### Claude's Discretion
- Exact Haiku prompt wording and structured output schema
- Confidence threshold for routing (suggested: >= 0.7 to route as bug_fix)
- Whether to show classification result to user in quick task output
- Integration point within Step 2 of quick.md (exact insertion location)

</decisions>

<specifics>
## Specific Ideas

- Follow the solve-classify.md pattern: Haiku subagent with JSON output, fail-open on errors
- The ROUTE-01 through ROUTE-04 requirements from the roadmap are explicit about the tri-category classification and routing behavior
- Classification at Step 2.7 means it happens after the planner but before the executor, so debug can inform execution

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 51-task-classification*
*Context gathered: 2026-03-25*

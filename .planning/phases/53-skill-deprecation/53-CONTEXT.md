# Phase 53: Skill Deprecation - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Deprecate /nf:model-driven-fix skill and rewire all remaining consumers to the new integration points established in Phases 50-52. After this phase, model-driven-fix is a deprecation shim that prints a redirect notice.

</domain>

<decisions>
## Implementation Decisions

### Deprecation shim behavior
- Invoking `/nf:model-driven-fix` prints a deprecation notice directing the user to `/nf:debug` (DEPR-01)
- The shim should clearly state: "This command is deprecated. Use `/nf:debug` instead — it includes all formal model capabilities."
- The shim does NOT execute any model-driven-fix logic — it only prints and exits
- Keep the skill file (commands/nf/model-driven-fix.md) but replace its process with the deprecation notice

### solve-remediate b_to_f layer rewiring
- The solve-remediate workflow's b_to_f (bug-to-fix) layer currently dispatches through model-driven-fix (DEPR-02)
- Rewire to dispatch through `/nf:debug` instead
- The debug pipeline now handles the full discovery-reproduction-refinement-constraint cycle (Phase 50)

### Cleanup verification
- After rewiring, grep for "model-driven-fix" across all workflow/skill files (DEPR-03)
- Only acceptable references: deprecation shim itself and CHANGELOG.md entries
- No active dispatch paths should remain — any found must be rewired or removed

### Claude's Discretion
- Whether to add a CHANGELOG.md entry for the deprecation
- Whether to remove model-driven-fix from help/listing output or keep it as deprecated
- Exact wording of the deprecation notice

</decisions>

<specifics>
## Specific Ideas

- This is the final phase of v0.41 — it cleans up after Phases 50-52 have established all replacement paths
- DEPR-03 (grep verification) ensures no stale references remain — this is a safety net, not just cleanup
- The three requirements (DEPR-01, DEPR-02, DEPR-03) map cleanly to a single plan with three tasks

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 53-skill-deprecation*
*Context gathered: 2026-03-25*

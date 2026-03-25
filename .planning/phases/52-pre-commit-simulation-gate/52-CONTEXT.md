# Phase 52: Pre-Commit Simulation Gate - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Loop 2 (solution simulation via simulateSolutionLoop with onTweakFix) fires as a universal pre-commit quality gate in executor workflows (quick.md --full and execute-plan.md). When formal models cover changed files, the gate validates that code changes preserve model invariants. When no models are in scope, the gate completes silently.

</domain>

<decisions>
## Implementation Decisions

### Gate trigger criteria
- Use existing formal-coverage-intersect.cjs to determine if changed files intersect with formal models (already in execute-phase.md formal_coverage_auto_detection block)
- Gate fires only when intersection exists — no formal models in scope = silent skip (SC3)
- Changed files detected via `git diff --name-only HEAD` before each commit step
- Trigger point: immediately before the atomic commit step in both executor workflows

### Fail-open vs fail-closed behavior
- Default mode: warn-only (fail-open) — log WARNING but do not block commit (SC4, consistent with nForma fail-open philosophy)
- `--strict` flag overrides to fail-closed: convergence failure blocks the commit and requires executor to fix before retrying
- Warning format: `"WARNING: Loop 2 simulation did not converge — {N} iterations, {issue description}. Proceeding (fail-open)."`
- Warning recorded in SUMMARY.md under "Issues Encountered" for visibility
- Strict mode failure format: `"BLOCKED: Loop 2 simulation failed to converge after {N} iterations. Fix required before commit."`

### onTweakFix callback and retry behavior
- Use autoresearch-refine.cjs module API (same pattern as Phase 50 Step A.7 — require(), not CLI)
- onTweakFix callback: executor reads checker output, makes ONE targeted code edit, returns description
- Max iterations: 10 (matching autoresearch-refine default from Phase 50)
- On convergence: commit proceeds normally
- On non-convergence (fail-open mode): log warning with iteration count and TSV trace, commit anyway
- On non-convergence (strict mode): block commit, report failure with TSV trace for diagnosis
- No per-iteration git commits (in-memory rollback, TSV-as-memory — same as Phase 50)

### Integration surface
- Shared helper approach: extract the gate logic into a reusable block/instructions that both quick.md and execute-plan.md reference
- Both consumers call the same sequence: intersect check → simulateSolutionLoop → route on result
- quick.md --full: gate fires in Step 6 executor before each task's atomic commit
- execute-plan.md: gate fires in the existing formal_coverage_auto_detection block (extend, don't duplicate)
- The existing formal_coverage_auto_detection block in execute-phase.md already runs formal-coverage-intersect.cjs and run-formal-verify.cjs — Loop 2 extends this with simulation

### Claude's Discretion
- Exact helper block format (inline instructions vs referenced template)
- TSV trace storage location for non-converged runs
- Whether to show iteration progress during simulation (verbose vs silent)
- Exact placement within the executor commit sequence

</decisions>

<specifics>
## Specific Ideas

- Extend the existing formal_coverage_auto_detection block rather than creating a parallel system
- GATE-04 (fail-open by default) matches nForma's existing fail-open philosophy — this is not a new pattern
- The simulateSolutionLoop is the "Loop 2" counterpart to Loop 1 (bug reproduction in Phase 50) — both use autoresearch-refine.cjs
- Five requirements (GATE-01 through GATE-05) map cleanly to two integration points and three behaviors

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 52-pre-commit-simulation-gate*
*Context gathered: 2026-03-25*

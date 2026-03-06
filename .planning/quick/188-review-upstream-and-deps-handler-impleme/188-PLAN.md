---
phase: quick-188
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/quick/188-review-upstream-and-deps-handler-impleme/188-REVIEW.md
  - .planning/quick/188-review-upstream-and-deps-handler-impleme/188-REQUIREMENTS.md
autonomous: true
formal_artifacts: none
requirements: [QUICK-188]

must_haves:
  truths:
    - "Both handlers are audited for code quality, edge cases, and schema compliance"
    - "Integration pipeline (config -> handler -> render) is verified as consistent"
    - "Worthy patterns are identified and documented as candidate requirements"
  artifacts:
    - path: ".planning/quick/188-review-upstream-and-deps-handler-impleme/188-REVIEW.md"
      provides: "Comprehensive review of both handlers with findings"
    - path: ".planning/quick/188-review-upstream-and-deps-handler-impleme/188-REQUIREMENTS.md"
      provides: "Candidate requirements for elevation"
  key_links:
    - from: "bin/observe-handler-upstream.cjs"
      to: "bin/observe-handlers.cjs"
      via: "re-export in observe-handlers.cjs"
      pattern: "handleUpstream"
    - from: "bin/observe-handler-deps.cjs"
      to: "bin/observe-handlers.cjs"
      via: "re-export in observe-handlers.cjs"
      pattern: "handleDeps"
    - from: "bin/observe-config.cjs"
      to: "bin/observe-render.cjs"
      via: "issue_type inference drives table routing"
      pattern: "UPSTREAM_TYPES|DEPS_TYPES"
---

<objective>
Review the upstream and deps observe handlers for code quality, test coverage, edge cases, and integration consistency. Identify patterns worth elevating as formal requirements.

Purpose: Ensure these two new handlers meet the quality bar of the existing observe system and capture reusable patterns as requirements before they become implicit conventions.
Output: Review document with findings + candidate requirements document.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@bin/observe-handler-upstream.cjs
@bin/observe-handler-upstream.test.cjs
@bin/observe-handler-deps.cjs
@bin/observe-handler-deps.test.cjs
@bin/observe-handlers.cjs
@bin/observe-config.cjs
@bin/observe-render.cjs
@commands/nf/observe.md
@.planning/observe-sources.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Audit both handlers and integration pipeline</name>
  <files>
    bin/observe-handler-upstream.cjs
    bin/observe-handler-upstream.test.cjs
    bin/observe-handler-deps.cjs
    bin/observe-handler-deps.test.cjs
    bin/observe-handlers.cjs
    bin/observe-config.cjs
    bin/observe-render.cjs
    commands/nf/observe.md
    .planning/observe-sources.md
  </files>
  <action>
    Perform a structured code review of both handlers covering these dimensions:

    **1. Schema compliance:** Verify both handlers return the standard observe schema (`{ source_label, source_type, status, issues[], error? }`). Check that every issue object includes all required fields (`id, title, severity, url, age, created_at, meta, source_type, issue_type`). Flag any missing or inconsistent fields.

    **2. Code quality issues:**
    - Duplicated `parseDuration` and `formatAge` functions exist in both `observe-handler-upstream.cjs` AND `observe-handlers.cjs`. These should be shared from a single source. Document the duplication.
    - `formatAge` in upstream handler returns `''` for null but observe-handlers returns `'unknown'`. Inconsistency.
    - `formatAge` in upstream handler returns `'new'` for future dates but observe-handlers returns `'future'`. Inconsistency.
    - Check for silent error swallowing (bare `catch {}` blocks) — are there cases where the user should be warned?
    - `checkPythonVersion` hardcodes `3.12` as the threshold — this will go stale. Document as a maintenance concern.
    - `checkNodeVersion` uses `npm view node version` which returns the latest npm-published version of the `node` npm package, NOT the actual latest Node.js release. This is unreliable. Document as a correctness issue.

    **3. Edge cases:**
    - What happens when `gh` CLI is not authenticated? Both handlers silently return `[]`.
    - What happens when npm/pip CLIs are not installed? Silently skipped — is this the right behavior?
    - `fetchNotablePRs` fetches `limit * 3` PRs then filters — what if the repo has thousands of PRs? The limit is capped but the filter could be surprising.
    - Upstream state file race condition: if two observe runs happen concurrently, state could be corrupted.
    - Deps handler: `checkNpmOutdated` catches the outer error but the inner `try/catch` for npm exit code 1 catches ALL errors including parse failures.

    **4. Test coverage gaps:**
    - Upstream: No test for `handleUpstream` when `gh` CLI fails mid-execution (not just "no repo").
    - Upstream: No test for the `sinceOverride` option path.
    - Deps: No test for `handleDeps` error path (top-level catch).
    - Deps: No test for `checkPipOutdated` error path.
    - Deps: `checkNodeVersion` test doesn't cover the case where `npm view` fails.
    - No integration test verifying config -> handler -> render pipeline end-to-end for upstream/deps types.

    **5. Integration consistency:**
    - Verify `observe-config.cjs` has `UPSTREAM_TYPES` and `DEPS_TYPES` arrays that correctly infer issue_type.
    - Verify `observe-render.cjs` correctly splits `upstream` and `deps` issue_types into their own tables.
    - Verify `observe-handlers.cjs` re-exports both handlers.
    - Verify `commands/nf/observe.md` registers both handlers in Step 3.
    - Verify `.planning/observe-sources.md` has working examples for both types.
    - Check that the upstream evaluation routing in observe.md Step 7 references `_upstream` metadata correctly.

    Write findings to `188-REVIEW.md` in the quick task directory. Structure as:
    - Executive Summary (1-2 sentences)
    - Schema Compliance (pass/fail per handler)
    - Code Quality Issues (numbered, with severity: blocker/warning/nit)
    - Edge Cases (numbered, with risk level)
    - Test Coverage Gaps (numbered)
    - Integration Consistency (pass/fail checklist)
  </action>
  <verify>
    The review document exists at `.planning/quick/188-review-upstream-and-deps-handler-impleme/188-REVIEW.md` and contains all five audit dimensions with specific findings.
  </verify>
  <done>
    Review document covers schema compliance, code quality, edge cases, test gaps, and integration consistency with actionable findings.
  </done>
</task>

<task type="auto">
  <name>Task 2: Identify and document candidate requirements for elevation</name>
  <files>
    .planning/quick/188-review-upstream-and-deps-handler-impleme/188-REQUIREMENTS.md
  </files>
  <action>
    Based on the review findings, identify patterns that should be elevated as formal requirements. Write them to `188-REQUIREMENTS.md`.

    Candidate patterns to evaluate for requirement elevation:

    **OBS-SCHEMA (Standard Handler Schema):**
    "All observe handlers MUST return `{ source_label, source_type, status: 'ok'|'error', issues: Array, error?: string }`. Each issue MUST include `{ id, title, severity, url, age, created_at, meta, source_type, issue_type }`."
    Rationale: Currently implicit — enforced by convention, not validation. Adding schema validation at dispatch would catch handler bugs early.

    **OBS-STATE (State Persistence Pattern):**
    "Handlers that track state between runs (e.g., upstream last_checked cursor) MUST use atomic write (write to temp + rename) and MUST include a `last_checked` ISO8601 timestamp."
    Rationale: The upstream handler uses `fs.writeFileSync` which is not atomic — a crash mid-write could corrupt state. This pattern should be standardized.

    **OBS-FAILOPEN (Fail-Open Handler Convention):**
    "All observe handlers MUST catch errors and return `{ status: 'error', error: string, issues: [] }` instead of throwing. No handler failure should block other handlers."
    Rationale: Already followed by all handlers but not formalized. Important for handler authors to know.

    **OBS-DEDUP (Shared Utility Functions):**
    "Common utility functions (parseDuration, formatAge) MUST be defined in one canonical location and imported, not duplicated across handler files."
    Rationale: `parseDuration` and `formatAge` are duplicated in at least 3 files. This creates drift risk (already observed: inconsistent null handling).

    **OBS-DI (Dependency Injection for Testability):**
    "All observe handlers MUST accept an `execFn` option for subprocess calls and a `basePath` option for filesystem operations, enabling full unit testing without real CLI/filesystem access."
    Rationale: Both handlers already follow this pattern — worth codifying so new handlers do too.

    For each candidate requirement, document:
    - ID and title
    - Description (one sentence)
    - Rationale (why elevate)
    - Evidence (which files demonstrate the pattern or violation)
    - Priority: HIGH (should be added now), MEDIUM (add when convenient), LOW (nice to have)
    - Suggested requirement text (for `/nf:add-requirement`)
  </action>
  <verify>
    The requirements document exists and contains at least 4 candidate requirements with ID, description, rationale, evidence, priority, and suggested text.
  </verify>
  <done>
    Candidate requirements documented with clear rationale and priority, ready for user to decide which to elevate via `/nf:add-requirement`.
  </done>
</task>

</tasks>

<verification>
- 188-REVIEW.md exists with structured findings across all 5 audit dimensions
- 188-REQUIREMENTS.md exists with candidate requirements including evidence and priority
- No code changes are made — this is a review-only task
</verification>

<success_criteria>
- Both handlers audited for schema compliance, code quality, edge cases, test coverage, and integration
- At least 4 candidate requirements identified with actionable descriptions
- Review findings are specific enough that a follow-up quick task could address each one
</success_criteria>

<output>
After completion, create `.planning/quick/188-review-upstream-and-deps-handler-impleme/188-SUMMARY.md`
</output>

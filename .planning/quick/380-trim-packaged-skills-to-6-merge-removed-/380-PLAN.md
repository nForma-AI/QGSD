---
phase: quick-380
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - core/references/tdd.md
  - core/references/git-integration.md
  - core/references/verification-patterns.md
  - agents/nf-planner.md
  - core/references/testing-patterns.md
  - core/references/security-checklist.md
  - core/references/performance-checklist.md
  - core/references/accessibility-checklist.md
  - core/workflows/verify-phase.md
  - core/workflows/cleanup-review.md
  - docs/agent-skills.md
  - CONTRIBUTING.md
  - README.md
  - docs/USER-GUIDE.md
autonomous: true
requirements: ["INTENT-01"]
formal_artifacts: none

must_haves:
  truths:
    - "Only 6 packaged skills exist: idea-refine, task-intake, shipping-and-launch, code-review-and-quality, api-and-interface-design, deprecation-and-migration"
    - "Removed skills' unique guidance is preserved in core/references/ and core/workflows/"
    - "4 reference checklists moved from references/ to core/references/ and enriched"
    - "Verifier workflow references quality checklists"
    - "Cleanup-review workflow includes simplification rules"
    - "All docs (agent-skills.md, CONTRIBUTING.md, README.md, USER-GUIDE.md) reflect the trimmed skill set"
    - "install.js installs the new reference files to ~/.claude/nf/references/"
  artifacts:
    - path: "core/references/testing-patterns.md"
      provides: "Testing patterns checklist (moved from references/)"
      contains: "state-based.*interaction-based"
    - path: "core/references/security-checklist.md"
      provides: "Security checklist with CI/CD gate ordering (moved from references/)"
      contains: "Pipeline gate ordering"
    - path: "core/references/performance-checklist.md"
      provides: "Performance checklist with bottleneck patterns (moved from references/)"
      contains: "bottleneck patterns"
    - path: "core/references/accessibility-checklist.md"
      provides: "Accessibility checklist (moved from references/)"
    - path: "core/references/tdd.md"
      provides: "TDD reference enriched with Prove-It Pattern"
      contains: "Prove-It Pattern"
    - path: "core/references/git-integration.md"
      provides: "Git reference enriched with pre-commit checklist"
      contains: "Pre-commit checklist"
    - path: "core/references/verification-patterns.md"
      provides: "Verification patterns enriched with slicing strategies"
      contains: "Slicing strategies"
  key_links:
    - from: "core/workflows/verify-phase.md"
      to: "core/references/testing-patterns.md"
      via: "@file reference for quality checklists"
      pattern: "references/testing-patterns"
    - from: "core/workflows/cleanup-review.md"
      to: "simplification rules"
      via: "inline scanning category"
      pattern: "Flatten nested conditionals"
    - from: "bin/install.js"
      to: "core/references/*.md"
      via: "installer copies core/references/ to ~/.claude/nf/references/"
      pattern: "references"
---

<objective>
Trim packaged skills from 17 to 6 by merging removed skills' unique guidance into core reference files and verifier/cleanup workflows, deleting 11 skill directories and their command routing files, and updating all documentation.

Purpose: Reduce skill bloat where 11 skills duplicate existing nForma capabilities (TDD references, git-integration, verification-patterns, verify-phase workflow, etc.). The unique guidance from each removed skill is preserved by enriching existing core files.

Output: 6 remaining skills, 4 new core reference checklists, enriched core references and workflows, updated docs.
</objective>

<execution_context>
@./.claude/nf/workflows/execute-plan.md
@./.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@agents/skills/test-driven-development/SKILL.md
@agents/skills/code-simplification/SKILL.md
@agents/skills/performance-optimization/SKILL.md
@agents/skills/ci-cd-and-automation/SKILL.md
@agents/skills/git-workflow-and-versioning/SKILL.md
@agents/skills/incremental-implementation/SKILL.md
@agents/skills/documentation-and-adrs/SKILL.md
@core/references/tdd.md
@core/references/git-integration.md
@core/references/verification-patterns.md
@core/workflows/verify-phase.md
@core/workflows/cleanup-review.md
@references/testing-patterns.md
@references/security-checklist.md
@references/performance-checklist.md
@references/accessibility-checklist.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Merge removed skills' guidance into core references and workflows</name>
  <files>
    core/references/tdd.md
    core/references/git-integration.md
    core/references/verification-patterns.md
    agents/nf-planner.md
    core/references/testing-patterns.md
    core/references/security-checklist.md
    core/references/performance-checklist.md
    core/references/accessibility-checklist.md
    core/workflows/verify-phase.md
    core/workflows/cleanup-review.md
  </files>
  <action>
    **Tier 1 — Enrich existing core/references/ files (small appends):**

    1. `core/references/tdd.md` — Append a new section after the existing content:
       ```
       <prove_it_pattern>
       ## The Prove-It Pattern (for bugs)

       1. Write a test that reproduces the exact failure
       2. Confirm it fails
       3. Fix the bug
       4. Confirm the test passes
       5. The test now prevents regression forever
       </prove_it_pattern>

       <anti_patterns>
       ## TDD Anti-Patterns

       - Writing tests after implementation (that's verification, not TDD)
       - Testing private methods directly
       - Mocking everything instead of using real implementations where feasible
       - Skipping the RED step (if the test passes before you write code, the test is wrong)
       - Over-testing obvious code (getters, simple constructors)
       </anti_patterns>
       ```

    2. `core/references/git-integration.md` — Append after the existing content:
       ```
       <pre_commit_checklist>
       ## Pre-Commit Checklist

       Before every commit:
       - [ ] Review staged changes (`git diff --staged`)
       - [ ] Check for secrets (passwords, API keys, tokens, .env files)
       - [ ] Run test suite
       - [ ] Run linting and type checking
       - [ ] Commit message explains the why, not just the what
       </pre_commit_checklist>
       ```

    3. `core/references/verification-patterns.md` — Append after the existing content:
       ```
       ## Slicing Strategies

       When decomposing large changes into verifiable increments:
       - **Vertical slices** (preferred): one complete stack path per increment (data -> logic -> interface)
       - **Contract-first**: define interfaces/types first, then implement behind them
       - **Risk-first**: tackle uncertain or risky elements before dependent work

       Each slice must leave the system buildable and existing tests passing.
       ```

    4. `agents/nf-planner.md` — Find a suitable location in the plan generation logic (near where tasks are created or in the task breakdown section) and add:
       ```
       <adr_suggestion>
       ## ADR Task Suggestion

       When a plan involves an architectural decision (new library, new pattern, system boundary change, data model redesign), consider adding a task or sub-step to capture the decision as an ADR-style note:
       - Context: what changed and why
       - Decision: the chosen approach
       - Alternatives considered: what was rejected
       - Consequences: what follows from this decision

       Place the ADR in the most relevant existing doc (README, CONTRIBUTING, USER-GUIDE, or a dedicated `docs/decisions/` directory if the project uses one). Do not create standalone ADR files unless the project already has an ADR convention.
       </adr_suggestion>
       ```

    **Tier 2 — Move checklists from references/ to core/references/ with enrichment:**

    5. Copy `references/testing-patterns.md` to `core/references/testing-patterns.md`. Before the Attribution section, add:
       ```
       ## Test quality principles

       - Prefer state-based assertions over interaction-based (mock) assertions
       - Each test should test one behavior, not one function
       - Keep the test pyramid: many unit tests, fewer integration tests, minimal E2E
       - Avoid testing implementation details — test the contract
       ```

    6. Copy `references/security-checklist.md` to `core/references/security-checklist.md`. Before the Attribution section, add:
       ```
       ## Pipeline gate ordering

       Quality gates should run in this order (fail-fast, cheapest first):
       1. Lint (eslint, prettier)
       2. Type checking (tsc, mypy)
       3. Unit tests
       4. Build verification
       5. Integration tests
       6. E2E tests
       7. Security audit (npm audit)
       8. Bundle/artifact size checks
       ```

    7. Copy `references/performance-checklist.md` to `core/references/performance-checklist.md`. Before the Attribution section, add:
       ```
       ## The optimization cycle

       Measure -> Identify -> Fix -> Verify -> Guard

       1. **Measure** — capture current metric with real numbers
       2. **Identify** — profile the actual bottleneck (not the suspected one)
       3. **Fix** — change one thing at a time, prefer simple fixes
       4. **Verify** — re-measure against baseline, revert if not measurable
       5. **Guard** — add a performance test or budget

       ## Common bottleneck patterns

       - **N+1 queries**: use joins or batch fetching instead of loops
       - **Synchronous file I/O in hot paths**: cache or lazy-load
       - **Unbounded data fetching**: paginate, limit, or stream
       - **Missing timeouts on external calls**: always set timeouts
       - **Large bundles**: tree-shake imports, lazy-load heavy features
       - **Redundant work**: cache computed results per session
       ```

    8. Copy `references/accessibility-checklist.md` to `core/references/accessibility-checklist.md` as-is (already comprehensive, no enrichment needed).

    **Tier 2c — Wire quality checklists into verifier:**

    9. `core/workflows/verify-phase.md` — In the verification process, after the must_haves verification steps but before the report generation, add a quality checklist step:
       ```
       <step name="quality_checklist_scan">
       **Quality Checklist Scan**

       After verifying must_haves, scan modified files against relevant quality checklists:

       - If test files were modified/created: check against `@~/.claude/nf/references/testing-patterns.md`
       - If security-sensitive files changed (hooks, auth, env handling): check against `@~/.claude/nf/references/security-checklist.md`
       - If performance-sensitive code changed (hot paths, install, startup): check against `@~/.claude/nf/references/performance-checklist.md`
       - If CLI output or docs changed: check against `@~/.claude/nf/references/accessibility-checklist.md`

       Report violations as Warning-level findings in VERIFICATION.md under a `## Quality Checklist Warnings` section. These do NOT block verification — they are informational.
       </step>
       ```

    **Tier 2d — Add simplification rules to cleanup-review:**

    10. `core/workflows/cleanup-review.md` — In the `scan_for_findings` step, add a fourth scanning category:
        ```
        **4. Simplification opportunities** (from code-simplification best practices)
        - Deeply nested conditionals that could use early returns
        - Single-use abstractions that should be inlined
        - Duplicate logic across files (extract only when 3+ similar blocks exist)
        - Dead code or commented-out code that should be removed entirely
        - Premature abstractions — three similar lines are better than a premature abstraction
        ```
  </action>
  <verify>
    Run these checks:
    - `grep -l "Prove-It Pattern" core/references/tdd.md` — confirms TDD enrichment
    - `grep -l "Pre-Commit Checklist" core/references/git-integration.md` — confirms git enrichment
    - `grep -l "Slicing Strategies" core/references/verification-patterns.md` — confirms verification enrichment
    - `grep -l "ADR Task Suggestion" agents/nf-planner.md` — confirms planner enrichment
    - `test -f core/references/testing-patterns.md` — confirms checklist moved
    - `test -f core/references/security-checklist.md` — confirms checklist moved
    - `test -f core/references/performance-checklist.md` — confirms checklist moved
    - `test -f core/references/accessibility-checklist.md` — confirms checklist moved
    - `grep -l "Pipeline gate ordering" core/references/security-checklist.md` — confirms CI/CD enrichment
    - `grep -l "optimization cycle" core/references/performance-checklist.md` — confirms perf enrichment
    - `grep -l "quality_checklist_scan" core/workflows/verify-phase.md` — confirms verifier wiring
    - `grep -l "Simplification opportunities" core/workflows/cleanup-review.md` — confirms cleanup wiring
  </verify>
  <done>
    All removed skills' unique guidance is preserved: TDD Prove-It Pattern and anti-patterns in tdd.md, pre-commit checklist in git-integration.md, slicing strategies in verification-patterns.md, ADR suggestion in nf-planner.md. Four reference checklists moved to core/references/ with enrichments (testing-patterns gets test quality principles, security-checklist gets pipeline gate ordering, performance-checklist gets optimization cycle and bottleneck patterns). Verifier workflow has quality checklist scan step. Cleanup-review has simplification scanning category.
  </done>
</task>

<task type="auto">
  <name>Task 2: Delete removed skills, command files, old references dir, and update all docs</name>
  <files>
    agents/skills/test-driven-development/
    agents/skills/performance-optimization/
    agents/skills/code-simplification/
    agents/skills/frontend-ui-engineering/
    agents/skills/browser-testing-with-devtools/
    agents/skills/spec-driven-development/
    agents/skills/incremental-implementation/
    agents/skills/git-workflow-and-versioning/
    agents/skills/ci-cd-and-automation/
    agents/skills/documentation-and-adrs/
    agents/skills/security-and-hardening/
    commands/nf/test-driven-development.md
    commands/nf/performance-optimization.md
    commands/nf/code-simplification.md
    commands/nf/frontend-ui-engineering.md
    commands/nf/browser-testing-with-devtools.md
    commands/nf/spec-driven-development.md
    commands/nf/incremental-implementation.md
    commands/nf/git-workflow-and-versioning.md
    commands/nf/ci-cd-and-automation.md
    commands/nf/documentation-and-adrs.md
    commands/nf/security-and-hardening.md
    references/
    docs/agent-skills.md
    CONTRIBUTING.md
    README.md
    docs/USER-GUIDE.md
  </files>
  <action>
    **Step 1 — Delete 11 skill directories:**
    ```bash
    rm -rf agents/skills/{test-driven-development,performance-optimization,code-simplification,frontend-ui-engineering,browser-testing-with-devtools,spec-driven-development,incremental-implementation,git-workflow-and-versioning,ci-cd-and-automation,documentation-and-adrs,security-and-hardening}
    ```

    **Step 2 — Delete 11 command routing files:**
    ```bash
    rm commands/nf/{test-driven-development,performance-optimization,code-simplification,frontend-ui-engineering,browser-testing-with-devtools,spec-driven-development,incremental-implementation,git-workflow-and-versioning,ci-cd-and-automation,documentation-and-adrs,security-and-hardening}.md
    ```

    **Step 3 — Delete old references/ directory** (contents already moved to core/references/ in Task 1):
    ```bash
    rm -rf references/
    ```

    **Step 4 — Update docs/agent-skills.md:**
    - Update the skill count from 16 (or whatever it says) to 6
    - Update the skill table to list ONLY the 6 remaining skills: idea-refine, task-intake, shipping-and-launch, code-review-and-quality, api-and-interface-design, deprecation-and-migration
    - Remove all references to removed skills from any upstream matrix or import history sections
    - Add a note that 11 skills were trimmed and their guidance merged into core/references/ and core/workflows/
    - Update any reference to the `references/` directory to point to `core/references/` instead

    **Step 5 — Update CONTRIBUTING.md:**
    - Update the packaged skills list to show only the 6 remaining skills
    - Update any mention of `references/` directory to `core/references/`
    - Remove references to removed skills

    **Step 6 — Update README.md:**
    - Update the packaged skills table/section to list only the 6 remaining skills
    - Update skill count references
    - Remove references to removed skills

    **Step 7 — Update docs/USER-GUIDE.md:**
    - Update the packaged skills section to list only the 6 remaining skills
    - Update any command examples that reference removed skills
    - Update any mention of `references/` to `core/references/`

    **Important:** When updating docs, read each file first to understand its current structure before editing. Do NOT blindly replace content — preserve surrounding context and formatting.
  </action>
  <verify>
    Run these checks:
    - `ls agents/skills/ | sort` — should show exactly: api-and-interface-design, code-review-and-quality, deprecation-and-migration, idea-refine, shipping-and-launch, task-intake
    - `ls agents/skills/ | wc -l` — should output 6
    - `test ! -d references/` — old references directory gone
    - `test ! -f commands/nf/test-driven-development.md` — command files deleted
    - `test ! -f commands/nf/security-and-hardening.md` — command files deleted
    - `grep -c "test-driven-development\|performance-optimization\|code-simplification\|frontend-ui-engineering\|browser-testing-with-devtools\|spec-driven-development\|incremental-implementation\|git-workflow-and-versioning\|ci-cd-and-automation\|documentation-and-adrs\|security-and-hardening" docs/agent-skills.md` — should be 0 or only in historical/attribution context
    - `npm run test:ci` — all tests pass
    - `npm run lint:isolation` — portable paths check passes
  </verify>
  <done>
    11 skill directories deleted. 11 command routing files deleted. Old references/ directory deleted. All four docs (agent-skills.md, CONTRIBUTING.md, README.md, USER-GUIDE.md) updated to reflect exactly 6 packaged skills. No broken references to removed skills or old references/ path. Test suite and lint pass.
  </done>
</task>

<task type="auto">
  <name>Task 3: Install sync and final verification</name>
  <files>
    bin/install.js
  </files>
  <action>
    **Step 1 — Verify install.js handles core/references/ correctly:**
    Read `bin/install.js` and confirm it already copies `core/references/` to `~/.claude/nf/references/`. If it does, no code change needed — the 4 new checklist files will be picked up automatically. If it does NOT copy the full directory (e.g., it only copies specific files), add the 4 new filenames to the copy list: `testing-patterns.md`, `security-checklist.md`, `performance-checklist.md`, `accessibility-checklist.md`.

    **Step 2 — Run install:**
    ```bash
    node bin/install.js --claude --global
    ```

    **Step 3 — Verify installed references:**
    ```bash
    ls ~/.claude/nf/references/
    ```
    Confirm the 4 new checklist files appear alongside the existing 14 reference files (total should be 18).

    **Step 4 — Run full CI gate suite:**
    ```bash
    npm run test:ci && npm run lint:isolation && npm run check:assets
    ```

    **Step 5 — Verify no stale references in installed workflows:**
    Check that the installed verify-phase.md and cleanup-review.md at `~/.claude/nf/workflows/` contain the new quality checklist scan and simplification scanning sections (installer copies from `core/workflows/`).
  </action>
  <verify>
    - `ls ~/.claude/nf/references/testing-patterns.md ~/.claude/nf/references/security-checklist.md ~/.claude/nf/references/performance-checklist.md ~/.claude/nf/references/accessibility-checklist.md` — all 4 files exist
    - `ls ~/.claude/nf/references/ | wc -l` — should be 18 (14 existing + 4 new)
    - `grep "quality_checklist_scan" ~/.claude/nf/workflows/verify-phase.md` — installed workflow has the new step
    - `grep "Simplification opportunities" ~/.claude/nf/workflows/cleanup-review.md` — installed workflow has the new category
    - `npm run test:ci` passes
    - `npm run lint:isolation` passes
    - `npm run check:assets` passes
  </verify>
  <done>
    Install.js correctly copies all 18 reference files to ~/.claude/nf/references/. Installed workflows at ~/.claude/nf/workflows/ contain the enriched verify-phase and cleanup-review content. All CI gates pass. The system is fully consistent: 6 packaged skills, 18 core references, enriched verifier and cleanup workflows.
  </done>
</task>

</tasks>

<verification>
1. Exactly 6 skill directories exist in agents/skills/
2. No command routing files exist for removed skills in commands/nf/
3. Old references/ directory deleted
4. 4 new checklist files exist in core/references/ with enrichments
5. core/references/tdd.md contains Prove-It Pattern and anti-patterns
6. core/references/git-integration.md contains pre-commit checklist
7. core/references/verification-patterns.md contains slicing strategies
8. agents/nf-planner.md contains ADR task suggestion
9. core/workflows/verify-phase.md contains quality checklist scan step
10. core/workflows/cleanup-review.md contains simplification scanning category
11. All 4 docs updated to reflect 6 skills
12. `node bin/install.js --claude --global` installs all references and workflows
13. `npm run test:ci && npm run lint:isolation && npm run check:assets` all pass
</verification>

<success_criteria>
- agents/skills/ contains exactly 6 directories: api-and-interface-design, code-review-and-quality, deprecation-and-migration, idea-refine, shipping-and-launch, task-intake
- core/references/ contains 18 files (14 existing + 4 moved checklists)
- No trace of removed skills in command routing files
- All removed skills' unique guidance preserved in core files
- Full CI suite passes
- Install syncs all new content to ~/.claude/nf/
</success_criteria>

<output>
After completion, create `.planning/quick/380-trim-packaged-skills-to-6-merge-removed-/380-SUMMARY.md`
</output>

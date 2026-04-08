---
phase: quick-380
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - core/bin/gsd-tools.cjs
  - core/bin/gsd-tools.test.cjs
autonomous: true
requirements: [INTENT-01]
formal_artifacts: none

must_haves:
  truths:
    - "getMilestoneInfo returns config default_milestone when STATE.md and ROADMAP.md are absent"
    - "getMilestoneInfo falls back to STATE.md/ROADMAP.md when default_milestone is not set"
    - "cmdInitQuick populates chosen_milestone and default_milestone_used from config"
    - "cmdPhasePlanIndex populates chosen_milestone and default_milestone_used from config"
    - "default_milestone appears in config.json template via cmdConfigEnsureSection"
    - "Various default_milestone string formats are parsed correctly (v0.9, v0.9 Name, v0.9: Name, 0.9)"
  artifacts:
    - path: "core/bin/gsd-tools.cjs"
      provides: "default_milestone config integration in loadConfig, getMilestoneInfo, cmdInitQuick, cmdPhasePlanIndex, cmdConfigEnsureSection"
    - path: "core/bin/gsd-tools.test.cjs"
      provides: "Test coverage for default_milestone feature"
      contains: "describe.*default_milestone"
  key_links:
    - from: "loadConfig()"
      to: "getMilestoneInfo()"
      via: "config.default_milestone read in getMilestoneInfo before STATE.md fallback"
      pattern: "cfg\\.default_milestone"
    - from: "getMilestoneInfo()"
      to: "cmdInitQuick()"
      via: "chosen_milestone populated from getMilestoneInfo result"
      pattern: "getMilestoneInfo.*chosen_milestone"
    - from: "getMilestoneInfo()"
      to: "cmdPhasePlanIndex()"
      via: "chosen_milestone populated from getMilestoneInfo result"
      pattern: "getMilestoneInfo.*chosen_milestone"
---

<objective>
Complete the default_milestone config feature for issue #64 -- fix the incomplete cmdInitQuick milestone population, and add comprehensive tests.

Purpose: Allow projects to set `default_milestone` in config.json so milestone workflows work without requiring STATE.md or ROADMAP.md. The core logic already exists in the uncommitted diff on feature branch; this plan fixes a gap (cmdInitQuick never populates chosen_milestone) and adds test coverage.

Output: Working default_milestone feature with tests passing.
</objective>

<execution_context>
@./.claude/nf/workflows/execute-plan.md
@./.claude/nf/templates/summary.md
</execution_context>

<context>
@core/bin/gsd-tools.cjs
@core/bin/gsd-tools.test.cjs
@.planning/quick/380-issue-64-make-auto-the-default-for-miles/scope-contract.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix cmdInitQuick milestone population and verify cmdPhasePlanIndex</name>
  <files>core/bin/gsd-tools.cjs</files>
  <action>
  In `cmdInitQuick()` (around line 4972-4974), the fields `chosen_milestone` and `default_milestone_used` are declared as null/false but never populated. Add milestone population logic after the result object is constructed (before `output(result, raw)`), using the same pattern as `cmdPhasePlanIndex()` (lines 2017-2031):

  ```javascript
  // Populate milestone context
  try {
    const milestone = getMilestoneInfo(cwd);
    if (milestone && milestone.version) {
      result.chosen_milestone = milestone.version;
      try {
        if (config.default_milestone && typeof config.default_milestone === 'string') {
          const dm = config.default_milestone.trim();
          if (dm && dm.toLowerCase() !== 'auto') {
            result.default_milestone_used = true;
          }
        }
      } catch {}
    }
  } catch {}
  ```

  Note: `config` is already available in scope from line 4878 (`const config = loadConfig(cwd)`). No need to call loadConfig again (unlike cmdPhasePlanIndex which does a redundant loadConfig call inside the try block).

  Verify the existing getMilestoneInfo() logic is correct:
  - It should check config.default_milestone FIRST (before STATE.md/ROADMAP.md)
  - The regex should accept: "v0.9", "v0.9 Name", "v0.9: Name", "0.9", "0.9 My Milestone"
  - The "auto" string value should be treated as "not set" (skip config, fall through to STATE.md)
  - null/undefined/empty string should fall through to STATE.md
  </action>
  <verify>
  Run: `node core/bin/gsd-tools.cjs init quick "test task" --raw` in a temp directory with a `.planning/config.json` containing `{"default_milestone": "v0.42 Test"}` and NO STATE.md/ROADMAP.md. The output JSON should have `chosen_milestone: "v0.42"` and `default_milestone_used: true`.
  </verify>
  <done>cmdInitQuick returns populated chosen_milestone and default_milestone_used when default_milestone is set in config. Both cmdInitQuick and cmdPhasePlanIndex expose milestone context consistently.</done>
</task>

<task type="auto">
  <name>Task 2: Add comprehensive tests for default_milestone feature</name>
  <files>core/bin/gsd-tools.test.cjs</files>
  <action>
  Add a new describe block at the end of the test file (before the closing of the file) titled `'default_milestone config feature'`. Use the existing test patterns (createTempProject, cleanup, runGsdTools helper).

  Write these test cases:

  **getMilestoneInfo via init quick (indirect testing through CLI):**

  1. `DM-TC-01: default_milestone "v0.42 My Milestone" populates init quick output` -- Write config.json with `{"default_milestone": "v0.42 My Milestone"}` to tmpDir. Do NOT create STATE.md or ROADMAP.md. Run `init quick "test task" --raw`. Assert: `chosen_milestone === "v0.42"`, `default_milestone_used === true`.

  2. `DM-TC-02: default_milestone null falls back to STATE.md` -- Write config.json with `{"default_milestone": null}`. Create STATE.md with `**Milestone:** v0.41 milestone`. Run `init quick "test task" --raw`. Assert: `chosen_milestone === "v0.41"`, `default_milestone_used === false`.

  3. `DM-TC-03: default_milestone "auto" is treated as not-set` -- Write config.json with `{"default_milestone": "auto"}`. Create STATE.md with `**Milestone:** v0.41 milestone`. Run `init quick "test task" --raw`. Assert: `chosen_milestone === "v0.41"`, `default_milestone_used === false`.

  4. `DM-TC-04: default_milestone without v-prefix normalizes correctly` -- Write config.json with `{"default_milestone": "0.42"}`. No STATE.md. Run `init quick "test task" --raw`. Assert: `chosen_milestone === "v0.42"`.

  5. `DM-TC-05: default_milestone with colon format "v0.42: Release"` -- Write config.json with `{"default_milestone": "v0.42: Release"}`. No STATE.md. Run `init quick "test task" --raw`. Assert: `chosen_milestone === "v0.42"`.

  6. `DM-TC-06: default_milestone takes priority over STATE.md` -- Write config.json with `{"default_milestone": "v0.99 Override"}`. Create STATE.md with `**Milestone:** v0.41 milestone`. Run `init quick "test task" --raw`. Assert: `chosen_milestone === "v0.99"`, `default_milestone_used === true`.

  7. `DM-TC-07: no config and no STATE.md yields null chosen_milestone` -- Create empty tmpDir with .planning/phases/ only (no config.json, no STATE.md, no ROADMAP.md). Run `init quick "test task" --raw`. Assert: `chosen_milestone === null`, `default_milestone_used === false`.

  8. `DM-TC-08: config-ensure-section includes default_milestone in template` -- Run `config ensure-section --raw` in a tmpDir with NO existing config.json. Read the generated `.planning/config.json`. Assert: the parsed JSON has a `default_milestone` key (value should be null).

  **Pattern:** Each test should use `beforeEach`/`afterEach` from the describe block for tmpDir lifecycle. Parse output with `JSON.parse(result.output)`. Use `assert.strictEqual` for value checks.
  </action>
  <verify>Run: `node --test --test-name-pattern="default_milestone" core/bin/gsd-tools.test.cjs` -- all 8 tests pass. Then run `npm run test:ci` to confirm no regressions.</verify>
  <done>8 test cases pass covering: config parsing, priority over STATE.md, "auto" bypass, format normalization (with/without v-prefix, colon format), null fallback, cmdInitQuick population, and config template generation.</done>
</task>

</tasks>

<verification>
1. `node --test --test-name-pattern="default_milestone" core/bin/gsd-tools.test.cjs` -- all DM-TC-* tests pass
2. `npm run test:ci` -- full test suite passes (no regressions)
3. Manual smoke test: create temp dir with `.planning/config.json` containing `{"default_milestone": "v0.42 Test"}`, run `node core/bin/gsd-tools.cjs init quick "smoke test" --raw`, confirm `chosen_milestone` is populated
</verification>

<success_criteria>
- cmdInitQuick correctly populates chosen_milestone and default_milestone_used from config
- getMilestoneInfo prefers config.default_milestone over STATE.md/ROADMAP.md
- 8 test cases pass covering all default_milestone code paths
- Full test suite passes with no regressions
- All changes committed on feature/issue-64-auto-default-milestone branch
</success_criteria>

<output>
After completion, create `.planning/quick/380-issue-64-make-auto-the-default-for-miles/380-SUMMARY.md`
</output>

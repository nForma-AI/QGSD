---
phase: quick-40
plan: 40
type: execute
wave: 1
depends_on: []
files_modified:
  - get-shit-done/workflows/plan-phase.md
autonomous: true
requirements: []

must_haves:
  truths:
    - "Research always runs when /qgsd:plan-phase is invoked unless --skip-research or --gaps is explicitly passed"
    - "An existing RESEARCH.md does NOT cause research to be silently skipped"
    - "The success_criteria comment no longer says 'unless ... or exists'"
  artifacts:
    - path: "get-shit-done/workflows/plan-phase.md"
      provides: "Updated Step 5 with research-always policy"
      contains: "Research always runs"
    - path: "/Users/jonathanborduas/.claude/get-shit-done/workflows/plan-phase.md"
      provides: "Installed copy updated to match (disk-only)"
      contains: "Research always runs"
  key_links:
    - from: "get-shit-done/workflows/plan-phase.md Step 5"
      to: "qgsd-phase-researcher spawn"
      via: "removal of has_research shortcut"
      pattern: "Research always runs"
---

<objective>
Remove the silent research-skip shortcut in the plan-phase workflow. Currently, if a RESEARCH.md already exists for a phase, Step 5 uses it without re-running the researcher. This means research only runs once ever, even if the phase evolved or the researcher would find something new.

The fix: delete the "use existing" branch so research ALWAYS runs unless `--skip-research` or `--gaps` is explicitly passed (or `research_enabled` is false in config).

Purpose: Enforce the ALWAYS-run-research policy documented in project memory. Research is cheap; stale research is expensive.
Output: Updated workflow file in repo + installed copy updated on disk.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remove has_research shortcut from Step 5 in plan-phase.md (repo + installed)</name>
  <files>
    get-shit-done/workflows/plan-phase.md
    /Users/jonathanborduas/.claude/get-shit-done/workflows/plan-phase.md
  </files>
  <action>
    In `get-shit-done/workflows/plan-phase.md`, make the following surgical edits to Step 5:

    1. Replace the three-line research-skip block (lines ~68-72):

    BEFORE:
    ```
    **Skip if:** `--gaps` flag, `--skip-research` flag, or `research_enabled` is false (from init) without `--research` override.

    **If `has_research` is true (from init) AND no `--research` flag:** Use existing, skip to step 6.

    **If RESEARCH.md missing OR `--research` flag:**
    ```

    AFTER:
    ```
    **Skip if:** `--gaps` flag, `--skip-research` flag, or `research_enabled` is false (from init) without `--research` override.

    **Research always runs** (overwriting any existing RESEARCH.md unless skipped via flags above). Research is not cached between plan-phase invocations.
    ```

    Remove the `**If RESEARCH.md missing OR `--research` flag:**` conditional header entirely. The Display banner + Spawn block that follows it should remain but no longer be inside a conditional — it always executes (unless the skip conditions above apply).

    2. In `<success_criteria>` at the bottom, update the research line:

    BEFORE:
    ```
    - [ ] Research completed (unless --skip-research or --gaps or exists)
    ```

    AFTER:
    ```
    - [ ] Research completed (unless --skip-research or --gaps or research_enabled=false)
    ```

    3. In the `offer_next` template section, update the Research status options to remove "Used existing":

    BEFORE:
    ```
    Research: {Completed | Used existing | Skipped}
    ```

    AFTER:
    ```
    Research: {Completed | Skipped}
    ```

    4. After editing the repo file, copy it verbatim to the installed path:
    ```bash
    cp /Users/jonathanborduas/code/QGSD/get-shit-done/workflows/plan-phase.md \
       /Users/jonathanborduas/.claude/get-shit-done/workflows/plan-phase.md
    ```

    The installed file is disk-only per project convention — no git commit for the installed copy.
  </action>
  <verify>
    Run:
    ```bash
    grep -n "has_research" /Users/jonathanborduas/code/QGSD/get-shit-done/workflows/plan-phase.md
    grep -n "has_research" /Users/jonathanborduas/.claude/get-shit-done/workflows/plan-phase.md
    grep -n "Research always runs" /Users/jonathanborduas/code/QGSD/get-shit-done/workflows/plan-phase.md
    grep -n "or exists" /Users/jonathanborduas/code/QGSD/get-shit-done/workflows/plan-phase.md
    ```

    Expected:
    - `has_research` returns zero matches in both files (shortcut gone)
    - `Research always runs` appears in the repo file
    - `or exists` returns zero matches (success_criteria updated)
    - `Used existing` returns zero matches in repo file (offer_next updated)
  </verify>
  <done>
    Step 5 of plan-phase.md no longer has a `has_research` branch. Research runs on every invocation of /qgsd:plan-phase unless --skip-research, --gaps, or research_enabled=false. Both repo and installed copies are consistent.
  </done>
</task>

</tasks>

<verification>
grep -c "has_research" /Users/jonathanborduas/code/QGSD/get-shit-done/workflows/plan-phase.md
# Expected: 0 (no remaining references to has_research shortcut)

grep "Research always runs" /Users/jonathanborduas/code/QGSD/get-shit-done/workflows/plan-phase.md
# Expected: line visible

diff /Users/jonathanborduas/code/QGSD/get-shit-done/workflows/plan-phase.md \
     /Users/jonathanborduas/.claude/get-shit-done/workflows/plan-phase.md
# Expected: no diff (files identical)
</verification>

<success_criteria>
- Invoking /qgsd:plan-phase always spawns qgsd-phase-researcher regardless of whether RESEARCH.md already exists
- The only research skip paths are: --skip-research flag, --gaps flag, research_enabled=false in config
- Repo file and installed file are identical
- Repo change is committed
</success_criteria>

<output>
After completion, create `.planning/quick/40-we-should-never-skip-research-just-run-i/40-SUMMARY.md`
</output>

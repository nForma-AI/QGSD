---
phase: quick-361
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - core/workflows/verify-work.md
  - core/workflows/execute-phase.md
autonomous: true
requirements: [INTENT-01]
formal_artifacts: none

must_haves:
  truths:
    - "verify-work.md defaults to automated verification (Playwright/agent-browser) before falling back to manual user testing"
    - "execute-phase.md human_needed path attempts automated verification before escalating to user"
    - "Both workflow changes are synced to installed copies at ~/.claude/nf/workflows/"
  artifacts:
    - path: "core/workflows/verify-work.md"
      provides: "Automation-first UAT workflow"
      contains: "automation-first"
    - path: "core/workflows/execute-phase.md"
      provides: "Automation-first human_needed path"
      contains: "automation-first"
  key_links:
    - from: "core/workflows/verify-work.md"
      to: "~/.claude/nf/workflows/verify-work.md"
      via: "install sync copy"
      pattern: "verify-work"
    - from: "core/workflows/execute-phase.md"
      to: "~/.claude/nf/workflows/execute-phase.md"
      via: "install sync copy"
      pattern: "execute-phase"
---

<objective>
Add automation-first bias to verify-work and execute-phase workflows so that UAT and human_needed verification paths default to Playwright/agent-browser automated testing before falling back to manual user interaction.

Purpose: Currently both workflows immediately ask the user to manually test features. This wastes user time when automated tools (Playwright, agent-browser MCP, curl, grep) can verify most behaviors programmatically. The change makes automation the default, with human interaction reserved for subjective judgment, real credential flows, and genuinely unavailable automation.

Output: Updated verify-work.md and execute-phase.md with automation-first sections, synced to installed copies.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@core/workflows/verify-work.md
@core/workflows/execute-phase.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add automation-first bias to verify-work.md and execute-phase.md</name>
  <files>core/workflows/verify-work.md, core/workflows/execute-phase.md</files>
  <action>
**verify-work.md changes:**

1. Update the `<philosophy>` section to add automation-first principle. Replace the current philosophy with:
   - Keep existing "Show expected, ask if reality matches" principle
   - Add new principle: "Automate first, ask second. For each test, attempt automated verification using available tools before presenting to the user."

2. Add a new `<automation_first>` section immediately after the `<philosophy>` section with this content:

```xml
<automation_first>
**Default: Automate verification. Fallback: Ask user.**

Before presenting ANY test to the user for manual verification, attempt automated verification using available tools in this priority order:

1. **Playwright/agent-browser** — If a browser MCP tool is available, use it to:
   - Navigate to the relevant URL
   - Take screenshots and verify visual state
   - Check browser console for errors
   - Verify DOM elements exist and contain expected content
   - Test interactive flows (click, type, submit)

2. **CLI verification** — Use curl, grep, file reads, or test commands:
   - API endpoints: `curl` the endpoint and verify response shape/status
   - File artifacts: Read the file, verify contents match expectations
   - Test suites: Run relevant test commands and check output
   - Build output: Verify build artifacts exist and are valid

3. **Code inspection** — Read source files to verify:
   - Correct imports and wiring between modules
   - Expected patterns present (e.g., error handling, type usage)
   - No regressions in related code

**Fall back to manual user testing ONLY when:**
- Subjective judgment required (design aesthetics, UX feel, copy tone)
- Real authentication credentials needed (OAuth flows, payment testing)
- Physical device interaction required (mobile gestures, hardware)
- All automated tools genuinely unavailable or insufficient

**For each test, record the verification method used:**
- `auto:browser` — Verified via Playwright/agent-browser
- `auto:cli` — Verified via curl/grep/test commands
- `auto:inspect` — Verified via code inspection
- `manual` — Required user interaction (state why)

When automated verification passes, auto-mark the test as passed and move to the next one. Only pause for user interaction when automation cannot resolve the test.
</automation_first>
```

3. Update the `present_test` step: Before presenting the checkpoint box to the user, add a preamble that says:
   - "Before presenting this test, attempt automated verification per the `<automation_first>` protocol."
   - "If automated verification succeeds: update the test result to `pass` with method `auto:{type}`, skip user presentation, and proceed to the next test."
   - "If automated verification fails or is insufficient: present to user as normal (existing checkpoint box flow)."

4. Update the `process_response` step: In the pass result format, add a `method:` field:
   ```
   ### {N}. {name}
   expected: {expected}
   result: pass
   method: {auto:browser|auto:cli|auto:inspect|manual}
   ```

5. Update the `<success_criteria>` section to add:
   - `- [ ] Automated verification attempted for each test before user presentation`
   - `- [ ] Verification method recorded for each test result`

**execute-phase.md changes:**

6. In the `verify_phase_goal` step, find the `**If human_needed:**` section (around line 526-570). Add an automation-first preamble BEFORE the quorum resolution loop. Insert immediately after "Before escalating to the user, run a quorum resolution loop to attempt automated resolution:" and before step 1:

```
**Automation-first attempt (before quorum):**

Before dispatching quorum workers, attempt to resolve each human_needed item using available automation tools:

a. Read each item from the `human_verification` section of VERIFICATION.md.
b. For each item, classify whether it can be verified automatically:
   - **URL/UI checks**: Use agent-browser or Playwright to navigate, screenshot, and verify DOM state
   - **API checks**: Use curl to verify endpoint responses
   - **File/artifact checks**: Use file reads and grep to verify existence and content
   - **Build/test checks**: Run relevant test or build commands
c. Attempt automated verification for each classifiable item.
d. If ALL items pass automated verification: treat as `passed` (skip quorum entirely). Log: `Automation resolved all human_needed items — treating as passed`. Proceed to update_roadmap.
e. If SOME items remain unresolved: include only the unresolved items in the quorum question (reduce quorum scope to genuinely ambiguous items).
f. If NO items could be automated: proceed to quorum as before (existing flow unchanged).
```

This ensures automation runs first, quorum runs second (on reduced scope), and user escalation is last resort.
  </action>
  <verify>
    1. `grep -c "automation_first" core/workflows/verify-work.md` returns >= 1
    2. `grep -c "automation-first" core/workflows/execute-phase.md` returns >= 1
    3. `grep "auto:browser\|auto:cli\|auto:inspect\|manual" core/workflows/verify-work.md` returns matches
    4. `grep "Automation-first attempt" core/workflows/execute-phase.md` returns a match
    5. Both files parse as valid markdown (no broken XML tags)
  </verify>
  <done>
    - verify-work.md has automation-first philosophy, automation_first protocol section, updated present_test step with auto-verify-before-present logic, method field in test results, updated success criteria
    - execute-phase.md has automation-first preamble in human_needed path that attempts tool-based verification before quorum dispatch
  </done>
</task>

<task type="auto">
  <name>Task 2: Sync updated workflows to installed copies</name>
  <files>~/.claude/nf/workflows/verify-work.md, ~/.claude/nf/workflows/execute-phase.md</files>
  <action>
Copy the updated workflow files from the repo source to the installed location. Per MEMORY.md workflow sync requirement, the repo source (`core/workflows/`) is the durable copy and the installer copies from there to `~/.claude/nf/workflows/`.

```bash
cp core/workflows/verify-work.md ~/.claude/nf/workflows/verify-work.md
cp core/workflows/execute-phase.md ~/.claude/nf/workflows/execute-phase.md
```

Verify the installed copies match the repo source:
```bash
diff core/workflows/verify-work.md ~/.claude/nf/workflows/verify-work.md
diff core/workflows/execute-phase.md ~/.claude/nf/workflows/execute-phase.md
```

Both diffs should be empty (files identical).
  </action>
  <verify>
    1. `diff core/workflows/verify-work.md ~/.claude/nf/workflows/verify-work.md` produces no output (files match)
    2. `diff core/workflows/execute-phase.md ~/.claude/nf/workflows/execute-phase.md` produces no output (files match)
    3. `grep "automation_first" ~/.claude/nf/workflows/verify-work.md` returns a match (confirming new content is in installed copy)
  </verify>
  <done>
    - Installed copies at ~/.claude/nf/workflows/ match repo source at core/workflows/
    - Both files contain the automation-first additions
    - Next install.js run will not revert changes (repo source is authoritative)
  </done>
</task>

</tasks>

<verification>
1. `grep -c "automation_first" core/workflows/verify-work.md` >= 1
2. `grep -c "Automation-first attempt" core/workflows/execute-phase.md` >= 1
3. `diff core/workflows/verify-work.md ~/.claude/nf/workflows/verify-work.md` is empty
4. `diff core/workflows/execute-phase.md ~/.claude/nf/workflows/execute-phase.md` is empty
5. No broken XML tags in either file: both open tags have matching close tags
</verification>

<success_criteria>
- verify-work.md defaults to automated verification before manual user testing
- execute-phase.md human_needed path tries automation before quorum and user escalation
- Installed copies synced and matching repo source
- Fallback to manual testing preserved for subjective/credential/unavailable scenarios
</success_criteria>

<output>
After completion, create `.planning/quick/361-add-automation-first-bias-to-verify-work/361-SUMMARY.md`
</output>

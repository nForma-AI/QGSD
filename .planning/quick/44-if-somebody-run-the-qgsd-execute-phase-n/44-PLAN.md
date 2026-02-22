---
phase: quick-44
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - /Users/jonathanborduas/.claude/qgsd/workflows/execute-phase.md
  - /Users/jonathanborduas/.claude/qgsd/workflows/plan-phase.md
  - /Users/jonathanborduas/.claude/qgsd/workflows/transition.md
autonomous: true
requirements: []

must_haves:
  truths:
    - "Running /qgsd:execute-phase N --auto completes phase N, then automatically plans and executes phase N+1, continuing until the milestone is complete or a gap/failure stops the chain"
    - "If CONTEXT.md does not exist for the next phase, --auto skips the discuss-phase gate and proceeds directly to plan-phase without user interaction"
    - "plan-phase with --auto skips the AskUserQuestion gate when no CONTEXT.md is found, using research+requirements only"
    - "The chain stops cleanly at milestone boundary (is_last_phase: true) or when gaps_found in verification"
  artifacts:
    - path: "/Users/jonathanborduas/.claude/qgsd/workflows/execute-phase.md"
      provides: "offer_next step with --auto chain propagation through transition"
    - path: "/Users/jonathanborduas/.claude/qgsd/workflows/plan-phase.md"
      provides: "step 4 auto-bypass of AskUserQuestion when --auto + no CONTEXT.md"
    - path: "/Users/jonathanborduas/.claude/qgsd/workflows/transition.md"
      provides: "offer_next_phase yolo branch routes to plan-phase (not discuss-phase) when --auto"
  key_links:
    - from: "execute-phase.md offer_next"
      to: "transition.md offer_next_phase"
      via: "inline execution with --auto flag propagated"
      pattern: "passing through the --auto flag"
    - from: "transition.md offer_next_phase yolo"
      to: "plan-phase [X+1] --auto"
      via: "SlashCommand regardless of CONTEXT.md existence"
      pattern: "SlashCommand.*plan-phase.*--auto"
    - from: "plan-phase.md step 4"
      to: "step 5 (research)"
      via: "auto-bypass when --auto flag present and no CONTEXT.md"
      pattern: "--auto.*Continue without context"
---

<objective>
Enable /qgsd:execute-phase N --auto to chain through all remaining phases of a milestone automatically: execute -> transition -> plan -> execute -> plan -> execute, stopping only on gaps_found, real failures, or milestone completion.

Purpose: The user wants a single command to run the full milestone pipeline unattended. Currently two gates break the chain: (1) transition routes to discuss-phase when CONTEXT.md is absent, and (2) plan-phase blocks with AskUserQuestion when no CONTEXT.md is found.

Output: Three workflow files updated with targeted edits to the two blocking gates.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/jonathanborduas/code/QGSD/.planning/STATE.md
@/Users/jonathanborduas/code/QGSD/.planning/ROADMAP.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix transition.md — route --auto to plan-phase regardless of CONTEXT.md</name>
  <files>/Users/jonathanborduas/.claude/qgsd/workflows/transition.md</files>
  <action>
In `transition.md`, the `offer_next_phase` step has a yolo branch (Route A: More phases remain) with two sub-branches: "If CONTEXT.md exists" and "If CONTEXT.md does NOT exist". Currently when CONTEXT.md does not exist, yolo mode invokes `SlashCommand("/qgsd:discuss-phase [X+1] --auto")`. This breaks the execute -> plan -> execute chain because discuss-phase is interactive.

Change the yolo Route A behavior so that BOTH sub-branches (CONTEXT.md exists AND not exists) invoke `SlashCommand("/qgsd:plan-phase [X+1] --auto")`. The distinction between "exists" and "not exists" is still worth noting for the display message, but the routing must always go to plan-phase when --auto is set.

Specifically, replace this block in the yolo section of Route A:

```
**If CONTEXT.md does NOT exist:**

```
Phase [X] marked complete.

Next: Phase [X+1] — [Name]

⚡ Auto-continuing: Discuss Phase [X+1] first
```

Exit skill and invoke SlashCommand("/qgsd:discuss-phase [X+1] --auto")
```

With:

```
**If CONTEXT.md does NOT exist:**

```
Phase [X] marked complete.

Next: Phase [X+1] — [Name]

⚡ Auto-continuing: Plan Phase [X+1] directly (no context, --auto mode)
```

Exit skill and invoke SlashCommand("/qgsd:plan-phase [X+1] --auto")
```

This is a surgical change — only the yolo/Route A/no-CONTEXT.md branch changes. The interactive mode branch (which routes to discuss-phase) is unchanged.
  </action>
  <verify>
    grep -n "Auto-continuing: Discuss Phase" /Users/jonathanborduas/.claude/qgsd/workflows/transition.md
    # Should return NO results — the discuss-phase routing in yolo mode should be gone
    grep -n "plan-phase.*--auto" /Users/jonathanborduas/.claude/qgsd/workflows/transition.md
    # Should show 2 lines (both CONTEXT.md exists and not-exists cases now point to plan-phase)
  </verify>
  <done>transition.md yolo Route A always invokes plan-phase --auto, never discuss-phase --auto</done>
</task>

<task type="auto">
  <name>Task 2: Fix plan-phase.md — bypass AskUserQuestion when --auto and no CONTEXT.md</name>
  <files>/Users/jonathanborduas/.claude/qgsd/workflows/plan-phase.md</files>
  <action>
In `plan-phase.md`, step 4 "Load CONTEXT.md" currently blocks with AskUserQuestion when CONTEXT.md is not found:

```
**If `context_path` is null (no CONTEXT.md exists):**

Use AskUserQuestion:
- header: "No context"
- question: "No CONTEXT.md found for Phase {X}. Plans will use research and requirements only..."
- options:
  - "Continue without context" — Plan using research + requirements only
  - "Run discuss-phase first" — Capture design decisions before planning

If "Continue without context": Proceed to step 5.
If "Run discuss-phase first": Display `/qgsd:discuss-phase {X}` and exit workflow.
```

Add an --auto fast-path BEFORE the AskUserQuestion. When the `--auto` flag is present and `context_path` is null, skip the question and automatically proceed as "Continue without context". The user has explicitly requested unattended operation by passing --auto.

Replace the block with:

```
**If `context_path` is null (no CONTEXT.md exists):**

**If `--auto` flag is present:** Log `⚡ Auto-continuing without context (--auto mode)` and proceed to step 5 — no question asked.

**Otherwise:** Use AskUserQuestion:
- header: "No context"
- question: "No CONTEXT.md found for Phase {X}. Plans will use research and requirements only — your design preferences won't be included. Continue or capture context first?"
- options:
  - "Continue without context" — Plan using research + requirements only
  - "Run discuss-phase first" — Capture design decisions before planning

If "Continue without context": Proceed to step 5.
If "Run discuss-phase first": Display `/qgsd:discuss-phase {X}` and exit workflow.
```

This is a targeted addition of a guard clause — the interactive flow (no --auto) is completely unchanged.
  </action>
  <verify>
    grep -n "Auto-continuing without context" /Users/jonathanborduas/.claude/qgsd/workflows/plan-phase.md
    # Should return 1 line confirming the auto-bypass is present
    grep -n "AskUserQuestion" /Users/jonathanborduas/.claude/qgsd/workflows/plan-phase.md
    # Should still return 1 line — the interactive path is preserved
  </verify>
  <done>plan-phase.md step 4 skips AskUserQuestion and auto-proceeds when --auto flag is set and no CONTEXT.md</done>
</task>

<task type="auto">
  <name>Task 3: Verify the full chain is complete and commit</name>
  <files>/Users/jonathanborduas/.claude/qgsd/workflows/execute-phase.md</files>
  <action>
Before committing, trace the full chain to verify no other gates break it:

1. Read execute-phase.md `offer_next` step — confirm it already propagates --auto to transition inline (it does: "Read and follow transition.md, passing through the --auto flag"). No change needed.

2. Read plan-phase.md step 14 "Auto-Advance Check" — confirm it already spawns execute-phase as Task with --auto when --auto or AUTO_CFG is true. No change needed.

3. Confirm the full chain is now:
   - `/qgsd:execute-phase N --auto`
   - → Phase N executes all plans
   - → Verification passes → offer_next detects --auto → inline transition.md
   - → transition yolo: `SlashCommand("/qgsd:plan-phase [N+1] --auto")`  [FIXED: even without CONTEXT.md]
   - → plan-phase step 4: no CONTEXT.md + --auto → auto-continues [FIXED]
   - → plan-phase step 14: --auto → `Task(execute-phase [N+1] --auto)`
   - → next phase executes ... cycle repeats until is_last_phase or gaps_found

4. If execute-phase.md needs no changes, commit only transition.md and plan-phase.md. If a minor documentation note is warranted in execute-phase.md (e.g., adding a note in the offer_next step about the full chain), add it now.

5. Commit the changes:
   ```bash
   node /Users/jonathanborduas/.claude/qgsd/bin/gsd-tools.cjs commit \
     "feat(workflow): chain execute-phase --auto through all milestone phases" \
     --files \
     /Users/jonathanborduas/.claude/qgsd/workflows/transition.md \
     /Users/jonathanborduas/.claude/qgsd/workflows/plan-phase.md
   ```
   (Add execute-phase.md to --files only if it was modified.)
  </action>
  <verify>
    # Confirm both changed files have no syntax errors (valid markdown):
    grep -c "SlashCommand" /Users/jonathanborduas/.claude/qgsd/workflows/transition.md
    # Should return 3 (two plan-phase invocations in yolo Route A + one complete-milestone)
    grep -c "auto-bypass\|Auto-continuing without context" /Users/jonathanborduas/.claude/qgsd/workflows/plan-phase.md
    # Should return 1
    # Confirm commit exists:
    git -C /Users/jonathanborduas/code/QGSD log --oneline -1
    # Should show the feat(workflow) commit
  </verify>
  <done>Chain verified end-to-end; changes committed; /qgsd:execute-phase N --auto now cycles through all milestone phases automatically</done>
</task>

</tasks>

<verification>
End-to-end chain trace:
1. execute-phase N --auto → runs phase N → verification passes → offer_next detects --auto
2. transition.md inline → offer_next_phase yolo → SlashCommand(plan-phase [N+1] --auto) [both CONTEXT.md cases]
3. plan-phase [N+1] --auto → step 4: no CONTEXT.md → auto-continues (no AskUserQuestion)
4. plan-phase step 14: --auto → Task(execute-phase [N+1] --auto)
5. Repeat until is_last_phase=true OR gaps_found

Chain-stopping conditions (still correct):
- gaps_found in verify_phase_goal → stops at gap closure prompt, no auto-advance
- is_last_phase=true → transition Route B → complete-milestone (yolo) or display completion
- Real execution failure with no diagnosis → asks user
</verification>

<success_criteria>
- transition.md yolo Route A (no CONTEXT.md) routes to plan-phase --auto, not discuss-phase --auto
- plan-phase.md step 4 has --auto fast-path before AskUserQuestion
- Full chain verified by code trace: execute -> transition -> plan -> execute cycles automatically
- Changes committed to git
</success_criteria>

<output>
After completion, create /Users/jonathanborduas/code/QGSD/.planning/quick/44-if-somebody-run-the-qgsd-execute-phase-n/44-SUMMARY.md
</output>

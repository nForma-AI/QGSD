---
quick: 132
type: execute
wave: 1
depends_on: []
files_modified:
  - qgsd-core/workflows/plan-phase.md
  - qgsd-core/workflows/verify-work.md
autonomous: true
formal_artifacts: none
must_haves:
  truths:
    - "plan-phase PHASE_COMPLETE in --auto mode invokes SlashCommand to continue the chain rather than displaying text and stopping"
    - "plan-phase PHASE_COMPLETE checks for NEXT_PHASE CONTEXT.md and routes to discuss-phase (no context) or plan-phase (context exists)"
    - "verify-work present_ready in --auto mode with gaps invokes execute-phase --gaps-only --auto instead of displaying text"
    - "verify-work present_ready in --auto mode with no gaps invokes discuss-phase NEXT_PHASE --auto instead of displaying text"
    - "Interactive mode (no --auto) is unchanged in both files"
  artifacts:
    - path: "qgsd-core/workflows/plan-phase.md"
      provides: "Auto-advance chain continuation after PHASE_COMPLETE"
    - path: "qgsd-core/workflows/verify-work.md"
      provides: "Auto-advance chain continuation after gap verification"
  key_links:
    - from: "plan-phase.md PHASE_COMPLETE handler"
      to: "discuss-phase or plan-phase"
      via: "SlashCommand with --auto flag"
      pattern: "SlashCommand.*discuss-phase|SlashCommand.*plan-phase"
    - from: "verify-work.md present_ready"
      to: "execute-phase --gaps-only or discuss-phase"
      via: "SlashCommand with --auto flag"
      pattern: "SlashCommand.*execute-phase.*gaps-only|SlashCommand.*discuss-phase"
---

<objective>
Fix two broken auto-advance chain links: plan-phase stops after PHASE_COMPLETE instead of continuing, and verify-work stops after gap verification instead of routing to the next step.

Purpose: Auto-advance pipeline requires each workflow to invoke the next step via SlashCommand — displaying text and stopping breaks the chain.
Output: Both workflows continue the chain when --auto is active; interactive mode unchanged.
</objective>

<context>
@.planning/STATE.md
@qgsd-core/workflows/plan-phase.md
@qgsd-core/workflows/verify-work.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix plan-phase PHASE_COMPLETE auto-advance</name>
  <files>qgsd-core/workflows/plan-phase.md</files>
  <action>
Replace the PHASE_COMPLETE handler in Step 14 (lines ~737-747). The current block displays text and stops with no SlashCommand. Replace with:

```
**Handle execute-phase return:**
- **PHASE COMPLETE** → In --auto mode, determine NEXT_PHASE routing:

  1. Determine NEXT_PHASE from the execute-phase result (use the `next_phase` field returned by the transition/phase-complete call — same field used in execute-phase.md line ~639).

  2. Check if NEXT_PHASE already has CONTEXT.md:
     ```bash
     NEXT_CONTEXT=$(ls .planning/phases/*${NEXT_PHASE}*/*-CONTEXT.md 2>/dev/null | head -1)
     ```

  3. Display banner:
     ```
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      QGSD ► PHASE ${PHASE} COMPLETE ✓
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

     Auto-advance pipeline finished.

     Next: /qgsd:discuss-phase ${NEXT_PHASE} --auto
     ```
     (If CONTEXT.md exists, show `Next: /qgsd:plan-phase ${NEXT_PHASE} --auto` instead)

  4. Invoke SlashCommand:
     - If `$NEXT_CONTEXT` is non-empty (CONTEXT.md exists): `SlashCommand("/qgsd:plan-phase ${NEXT_PHASE} --auto")`
     - Otherwise: `SlashCommand("/qgsd:discuss-phase ${NEXT_PHASE} --auto")`

- **GAPS FOUND / VERIFICATION FAILED** → Display result, stop chain (unchanged):
  ```
  Auto-advance stopped: Execution needs review.

  Review the output above and continue manually:
  /qgsd:execute-phase ${PHASE}
  ```
```

Pattern from transition.md (lines 361-393) is the authoritative model for this CONTEXT.md check + SlashCommand pattern.

Do NOT change the "If neither --auto nor config enabled" branch — route to `<offer_next>` remains unchanged.
  </action>
  <verify>
Read qgsd-core/workflows/plan-phase.md around line 737-760. Confirm:
- PHASE_COMPLETE block now has a bash command checking for NEXT_PHASE CONTEXT.md
- SlashCommand invocation is present for both routing branches (discuss-phase and plan-phase)
- "GAPS FOUND" branch still displays text and stops (no SlashCommand)
- Interactive fallback to `<offer_next>` is unchanged
  </verify>
  <done>plan-phase.md PHASE_COMPLETE handler invokes SlashCommand in --auto mode with CONTEXT.md-aware routing. Interactive mode routes to offer_next unchanged.</done>
</task>

<task type="auto">
  <name>Task 2: Fix verify-work present_ready auto-advance</name>
  <files>qgsd-core/workflows/verify-work.md</files>
  <action>
Replace the `present_ready` step (lines ~491-518). The current block renders a static "FIXES READY" banner with a `/clear` hint and stops. Add auto-advance logic after the banner:

After the closing `───` line and before `</step>`, insert:

```
**Auto-advance (when --auto flag present OR `workflow.auto_advance` config is true):**

Check for --auto flag and config:
```bash
AUTO_CFG=$(node ~/.claude/qgsd/bin/gsd-tools.cjs config-get workflow.auto_advance 2>/dev/null || echo "true")
```

**If `--auto` flag present OR `AUTO_CFG` is true:**

Two sub-cases based on gap result:

**Sub-case A — Gaps found (fix plans were created):**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► AUTO-ADVANCING TO EXECUTE GAPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Gap fix plans ready. Spawning execute-phase --gaps-only...
```
Invoke: `SlashCommand("/qgsd:execute-phase ${PHASE} --gaps-only --auto")`

**Sub-case B — All tests pass (no gaps found):**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► VERIFICATION COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

All tests pass. Advancing to next phase...
```
Invoke: `SlashCommand("/qgsd:discuss-phase ${NEXT_PHASE} --auto")`

(NEXT_PHASE = the phase number immediately after the current phase, read from ROADMAP.md or `gsd-tools.cjs roadmap get-phase` next field)

**If neither --auto nor config enabled:** Keep existing display-and-stop behavior unchanged.
```

Determine gap/no-gap distinction from the result of the gap-plan creation step — if gap plans were created (gap_count > 0), use Sub-case A. If gap_count == 0, use Sub-case B.
  </action>
  <verify>
Read qgsd-core/workflows/verify-work.md around the `present_ready` step. Confirm:
- Auto-advance section exists after the static banner
- Sub-case A: gaps found → SlashCommand("execute-phase ... --gaps-only --auto")
- Sub-case B: no gaps → SlashCommand("discuss-phase NEXT_PHASE --auto")
- AUTO_CFG bash check is present
- Static banner + "/clear" hint still exists for interactive mode (no change to that block)
  </verify>
  <done>verify-work.md present_ready continues the chain via SlashCommand when --auto is active. Gaps → execute gaps; no gaps → discuss next phase. Interactive mode shows existing static banner unchanged.</done>
</task>

</tasks>

<verification>
After both edits:
1. plan-phase.md: grep for "SlashCommand" near the PHASE_COMPLETE block — must be present
2. verify-work.md: grep for "SlashCommand" in present_ready — must have both gaps-only and discuss-phase variants
3. Confirm no `Skill(` calls were introduced — the project uses `SlashCommand(` for workflow continuation (per transition.md pattern)
4. Confirm interactive (no --auto) paths in both files are structurally identical to before the edit
</verification>

<success_criteria>
- plan-phase.md PHASE_COMPLETE handler invokes SlashCommand in --auto mode (CONTEXT.md-aware routing: discuss-phase or plan-phase)
- verify-work.md present_ready invokes SlashCommand in --auto mode (gaps → execute-phase --gaps-only --auto; no gaps → discuss-phase NEXT_PHASE --auto)
- Both files leave interactive-mode paths unchanged
- No Skill() calls introduced (wrong pattern — SlashCommand is correct)
</success_criteria>

<output>
After completion, create `.planning/quick/132-fix-auto-advance-chain-breaks-in-plan-ph/132-SUMMARY.md`
</output>

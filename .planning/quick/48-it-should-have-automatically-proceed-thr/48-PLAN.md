---
phase: quick-48
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - commands/qgsd/quick.md
autonomous: true
requirements: [QUICK-48]

must_haves:
  truths:
    - "When --full mode verification finds gaps, the orchestrator automatically spawns a fix executor without pausing for user input"
    - "After the fix executor runs, quorum-test is invoked to verify the fix resolved the gaps"
    - "Only if quorum-test returns BLOCK or all models are UNAVAILABLE does the orchestrator escalate to human review"
    - "The auto-fix loop is capped (max 1 retry) to prevent infinite cycles"
  artifacts:
    - path: "commands/qgsd/quick.md"
      provides: "QGSD quick command with auto-proceed gap closure in --full verification step"
      contains: "gaps_found.*quorum-test"
  key_links:
    - from: "commands/qgsd/quick.md"
      to: "commands/qgsd/quorum-test.md"
      via: "inline quorum-test invocation in gaps_found branch"
      pattern: "quorum-test"
    - from: "gaps_found branch"
      to: "gsd-executor spawn"
      via: "automatic re-execution without user prompt"
      pattern: "gaps_found.*spawn.*executor"
---

<objective>
Extend QGSD's `--full` quick mode so that when post-execution verification detects gaps, the orchestrator automatically proceeds through fix + quorum-test without pausing for human input.

Purpose: The current `gaps_found` handling stops and asks: "1) Re-run executor to fix gaps, 2) Accept as-is." This defeats the purpose of `--full` mode, which is quality guarantees without ceremony. The same auto-proceed pattern already exists in `execute-phase.md` for `checkpoint:verify` tasks — quick mode should mirror it.

Output: Updated `commands/qgsd/quick.md` with a `## Verification Gap Handling Override` section that replaces the pause-and-ask `gaps_found` branch with an automated fix loop backed by quorum-test.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@commands/qgsd/quick.md
@commands/qgsd/execute-phase.md
@commands/qgsd/quorum-test.md
@/Users/jonathanborduas/.claude/get-shit-done/workflows/quick.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add auto-proceed gap closure to QGSD quick.md</name>
  <files>commands/qgsd/quick.md</files>
  <action>
Read the current `commands/qgsd/quick.md`. It delegates execution to the upstream GSD `quick.md` workflow via `@~/.claude/get-shit-done/workflows/quick.md`.

The upstream workflow's Step 6.5 has this gap handling logic (line ~352):
  | `gaps_found` | Display gap summary, offer: 1) Re-run executor to fix gaps, 2) Accept as-is. Store `$VERIFICATION_STATUS = "Gaps"` |

QGSD must override this to auto-proceed. Follow the same extension pattern used in `commands/qgsd/execute-phase.md` (which adds a `<process>` section overriding checkpoint handling rules).

Add a new `## Verification Gap Auto-Proceed Override` section to `commands/qgsd/quick.md` after the existing `<process>` block. The section must specify these rules:

**Rule: gaps_found → auto-fix loop (replaces pause-and-ask)**

When Step 6.5 of the GSD quick workflow reaches `gaps_found` status:

1. Do NOT pause for user input. Do NOT offer "accept as-is."

2. Display:
   ```
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    QGSD ► GAPS FOUND — AUTO-FIX
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   ◆ Verification found gaps. Spawning fix executor...
   ```

3. Initialize `$GAP_FIX_ITERATION = 1`. Max iterations = 2.

4. **Spawn fix executor** with the VERIFICATION.md and PLAN.md as context:
   ```
   Task(
     prompt="
   Fix gaps identified in verification.

   <files_to_read>
   - ${QUICK_DIR}/${next_num}-PLAN.md (Original plan)
   - ${QUICK_DIR}/${next_num}-VERIFICATION.md (Gaps to fix)
   - .planning/STATE.md (Project state)
   - ./CLAUDE.md (Project instructions, if exists)
   </files_to_read>

   <constraints>
   - Address only the gaps listed in VERIFICATION.md
   - Do not re-implement tasks already marked as passing
   - Commit fixes atomically using gsd-tools.cjs commit
   - Return the fix commit hash in your response (format: 'Fix Commit: {hash}')
   </constraints>
   ",
     subagent_type="gsd-executor",
     model="{executor_model}",
     description="Fix gaps: ${DESCRIPTION}"
   )
   ```

5. After fix executor returns, **run quorum-test** to verify gaps are closed:

   Determine test scope from VERIFICATION.md artifacts. If test files exist (*.test.js, *.test.ts, etc.), call `/qgsd:quorum-test` with those files. If no test files are present (non-testable gaps), skip quorum-test and proceed directly to step 6.

   Evaluate quorum-test consensus:
   - **PASS:** Gaps confirmed closed. Set `$VERIFICATION_STATUS = "Verified"`. Proceed to status update.
   - **REVIEW-NEEDED:** Treat as passing (gap closure confirmed, concerns noted). Set `$VERIFICATION_STATUS = "Verified (Review Noted)"`. Proceed to status update.
   - **BLOCK:** Gaps not resolved. If `$GAP_FIX_ITERATION < 2`, increment `$GAP_FIX_ITERATION` and repeat from step 4.
   - **ALL models UNAVAILABLE:** Escalate to human. Display:
     ```
     All quorum models unavailable — cannot verify gap closure automatically.
     Please manually verify and type "verified" to continue, or "skip" to record as Needs Review.
     ```
     Wait for human response. Set `$VERIFICATION_STATUS` accordingly.

6. **If BLOCK after max iterations (2):** Set `$VERIFICATION_STATUS = "Gaps"`. Display:
   ```
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    QGSD ► AUTO-FIX EXHAUSTED
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   Max fix iterations reached. Quorum still reports gaps.

   Options:
   1. Provide guidance and retry: describe the issue
   2. Accept current state: type "accept"
   ```
   Wait for human response.

The rule replaces ONLY the `gaps_found` branch. The `passed` and `human_needed` branches from the upstream workflow are unchanged.
  </action>
  <verify>
    Read the updated `commands/qgsd/quick.md` and confirm:
    - It contains a `## Verification Gap Auto-Proceed Override` section (or similar heading)
    - The section specifies the auto-fix loop with gsd-executor spawn
    - It references quorum-test for post-fix verification
    - It specifies max iterations = 2
    - It defines the BLOCK-after-max escalation path to human
    - The `passed` and `human_needed` branches are NOT modified (only `gaps_found` overridden)
  </verify>
  <done>
    `commands/qgsd/quick.md` contains the auto-proceed gap closure override. When --full verification finds gaps, the workflow automatically spawns a fix executor and runs quorum-test, pausing for human input only when quorum blocks after 2 attempts or all models are unavailable.
  </done>
</task>

</tasks>

<verification>
- Read `commands/qgsd/quick.md` and confirm the override section is present and well-formed
- Confirm the rule covers: auto-spawn executor, quorum-test call, iteration cap, UNAVAIL escalation, BLOCK-after-max escalation
- Confirm the section does NOT alter passed/human_needed behavior from upstream workflow
</verification>

<success_criteria>
`commands/qgsd/quick.md` is updated with an auto-proceed gap closure rule. The `gaps_found` branch no longer pauses for user input under normal conditions. Quorum-test gates the fix. Human escalation is reserved for quorum BLOCK (max iterations) or all-models-UNAVAILABLE.
</success_criteria>

<output>
After completion, create `.planning/quick/48-it-should-have-automatically-proceed-thr/48-SUMMARY.md`
</output>

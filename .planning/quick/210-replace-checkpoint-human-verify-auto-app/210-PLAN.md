---
phase: quick-210
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - core/references/checkpoints.md
  - core/workflows/execute-phase.md
  - agents/nf-executor.md
  - CHANGELOG.md
autonomous: true
requirements: [QUICK-210]
formal_artifacts: none

must_haves:
  truths:
    - "checkpoint:human-verify in auto-mode triggers quorum consensus gate instead of auto-approving"
    - "100% APPROVE from all quorum workers required to proceed past checkpoint"
    - "Any BLOCK vote or quorum unavailability escalates to user"
    - "checkpoint:decision and checkpoint:human-action behavior unchanged"
    - "Quorum question text includes the specific checkpoint criteria (what-built, how-to-verify) so workers have sufficient context for informed APPROVE/BLOCK decisions"
    - "Quorum consensus gate logs its outcome (APPROVED vs ESCALATED) for audit trail"
  artifacts:
    - path: "core/references/checkpoints.md"
      provides: "Updated golden rule #5 describing quorum consensus gate"
      contains: "quorum consensus"
    - path: "core/workflows/execute-phase.md"
      provides: "Quorum consensus gate replacing auto-approve for human-verify"
      contains: "100% APPROVE"
    - path: "agents/nf-executor.md"
      provides: "Executor delegates human-verify to orchestrator quorum gate"
      contains: "quorum"
    - path: "CHANGELOG.md"
      provides: "Breaking change entry for checkpoint quorum gate"
      contains: "checkpoint:human-verify"
  key_links:
    - from: "agents/nf-executor.md"
      to: "core/workflows/execute-phase.md"
      via: "executor delegates checkpoint to orchestrator"
      pattern: "orchestrator.*quorum"
    - from: "core/workflows/execute-phase.md"
      to: "commands/nf/quorum.md"
      via: "R3 dispatch_pattern for quorum consensus"
      pattern: "nf-quorum-slot-worker"
    - from: "core/references/checkpoints.md"
      to: "core/workflows/execute-phase.md"
      via: "golden rule #5 matches actual auto-mode behavior"
      pattern: "quorum consensus"
---

<objective>
Replace the auto-approve behavior for checkpoint:human-verify in auto-mode with a quorum consensus gate requiring unanimous (100%) APPROVE from all available quorum workers. Falls back to user escalation on any BLOCK vote or quorum unavailability.

Purpose: Prevent autonomous execution from silently skipping human verification checkpoints. Quorum consensus provides multi-model agreement that the checkpoint criteria are met before proceeding, closing a safety gap where auto-mode could bypass meaningful verification.

Output: Updated workflow docs (checkpoints reference, execute-phase workflow, executor agent) and CHANGELOG entry.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@core/references/checkpoints.md
@core/workflows/execute-phase.md
@agents/nf-executor.md
@CHANGELOG.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace auto-approve with quorum consensus gate in workflow and reference docs</name>
  <files>
    core/references/checkpoints.md
    core/workflows/execute-phase.md
    agents/nf-executor.md
  </files>
  <action>
**core/references/checkpoints.md** — Find golden rule #5 (anchor: the line matching `Auto-mode bypasses verification/decision checkpoints`):
Replace the current text:
`5. **Auto-mode bypasses verification/decision checkpoints** — When workflow.auto_advance is true in config: human-verify auto-approves, decision auto-selects first option, human-action still stops (auth gates cannot be automated)`
With:
`5. **Auto-mode uses quorum consensus for verification checkpoints** — When workflow.auto_advance is true in config: human-verify triggers a quorum consensus gate (100% APPROVE required from all workers, falls back to user on any BLOCK or quorum unavailability), decision auto-selects first option, human-action still stops (auth gates cannot be automated)`

**core/workflows/execute-phase.md** — Find the auto-mode checkpoint handling block (anchor: the line matching `**human-verify** → Auto-spawn continuation agent`). Replace the `human-verify` bullet:
OLD: `- **human-verify** → Auto-spawn continuation agent with {user_response} = "approved". Log ⚡ Auto-approved checkpoint.`
NEW (model on the human_needed quorum pattern at lines 462-482):
```
- **human-verify** → Run quorum consensus gate:
  1. Extract checkpoint details: `what-built` and `how-to-verify` from the checkpoint task XML. These MUST be included verbatim in the quorum question so workers have sufficient context for informed decisions.
  2. Form your own position: can each verification criterion be confirmed via available tools (grep, file reads, test runs, curl)? Vote APPROVE or BLOCK with rationale.
  3. Run quorum inline (R3 dispatch_pattern from `commands/nf/quorum.md`):
     - Mode A — pure question
     - Question: "Checkpoint verification for auto-mode: [what-built]. Criteria: [how-to-verify]. Can each criterion be confirmed programmatically using available tools (grep, file inspection, test output, curl)? Vote APPROVE if all criteria are verifiable and met, or BLOCK if any criterion genuinely requires human eyes."
     - Include the full checkpoint task XML as context (what-built, how-to-verify, resume-signal) so workers can evaluate each criterion independently.
     - risk_level: Use `medium` (yielding FAN_OUT_COUNT=3) unless the task envelope specifies a different risk_level, in which case inherit it. This gives 2 external workers + Claude for a 3-way consensus.
     - Build `$DISPATCH_LIST` (quorum.md Adaptive Fan-Out: read risk_level → compute FAN_OUT_COUNT → take first FAN_OUT_COUNT-1 slots from active working list). Dispatch as sibling `nf-quorum-slot-worker` Tasks with `model="haiku", max_turns=100`
     - Synthesize results inline, deliberate up to 10 rounds per R3.3
     - **Unanimous gate: 100% APPROVE required.** Unlike standard quorum majority, ALL responding workers must vote APPROVE.
     Fail-open: if all slots error or no slots respond, treat as BLOCK (escalate to user).
  4. Route on quorum_result:
     - **APPROVED (unanimous)** → Log `⚡ Quorum-approved checkpoint: [what-built]`. Spawn continuation agent with `{user_response}` = `"approved"`.
     - **BLOCKED (any BLOCK vote)** → Present checkpoint to user (standard flow below). Log `⚡ Quorum blocked checkpoint — escalating to user`.
     - **ESCALATED** → Present checkpoint to user with escalation details. Log `⚡ Quorum escalated checkpoint — presenting to user`.
```
Keep the `decision` and `human-action` bullets unchanged.

**agents/nf-executor.md** — Find the auto-mode checkpoint behavior block (anchor: the line matching `checkpoint:human-verify` followed by `Auto-approve`). Replace the `human-verify` bullet:
OLD: `- **checkpoint:human-verify** → Auto-approve. Log ⚡ Auto-approved: [what-built]. Continue to next task.`
NEW: `- **checkpoint:human-verify** → Do NOT auto-approve. Return structured checkpoint message using checkpoint_return_format so the orchestrator can run a quorum consensus gate (100% APPROVE required). The orchestrator handles quorum dispatch and user escalation.`

IMPORTANT: Do not modify any other sections. The decision and human-action bullets remain as-is. Preserve all surrounding context and formatting.

Formal invariant compliance:
- EventualConsensus (quorum): The quorum gate uses the same R3 dispatch pattern with weak fairness on vote collection, ensuring eventual consensus.
- ConvergenceEventuallyResolves (convergence): The fail-open fallback to user escalation ensures the checkpoint always resolves even if quorum is unavailable.
  </action>
  <verify>
    - `grep -n "quorum consensus" core/references/checkpoints.md` returns match at the golden rule #5 line (find via `grep -n "Auto-mode uses quorum"`)
    - `grep -n "100% APPROVE" core/workflows/execute-phase.md` returns match in auto-mode checkpoint section
    - `grep -n "risk_level.*medium" core/workflows/execute-phase.md` returns match confirming default risk_level is specified
    - `grep -n "what-built.*how-to-verify" core/workflows/execute-phase.md` returns match confirming checkpoint criteria are passed to quorum question
    - `grep -n "quorum consensus gate" agents/nf-executor.md` returns match in auto-mode section
    - `grep -c "Auto-approve" agents/nf-executor.md` returns 0 (no more auto-approve for human-verify)
    - Verify old auto-approve pattern is gone: `grep -c "human-verify.*Auto-spawn" core/workflows/execute-phase.md` returns 0 (not just checking for "Auto-spawn continuation.*approved" which could match other patterns)
    - `grep -n "Log.*Quorum" core/workflows/execute-phase.md` returns matches for all three outcomes (APPROVED, BLOCKED, ESCALATED) confirming audit trail logging
  </verify>
  <done>
    All three files updated: golden rule #5 describes quorum consensus, execute-phase uses quorum gate pattern for human-verify with explicit risk_level default (medium/FAN_OUT_COUNT=3), quorum question includes full checkpoint criteria (what-built, how-to-verify), all three outcome paths log their result for audit trail, executor delegates to orchestrator instead of auto-approving. Decision and human-action behaviors unchanged.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add CHANGELOG entry for breaking change</name>
  <files>CHANGELOG.md</files>
  <action>
Add a new entry under `## [Unreleased]` in CHANGELOG.md. Find the line matching `## [Unreleased]` and insert after it, before the next `## [` section header:

```markdown
### Changed
- **BREAKING: checkpoint:human-verify quorum gate** — Auto-mode no longer auto-approves `checkpoint:human-verify` tasks. Instead, a quorum consensus gate requires 100% APPROVE from all available workers before proceeding. Falls back to user escalation on any BLOCK vote or quorum unavailability. Affects `core/workflows/execute-phase.md`, `agents/nf-executor.md`, `core/references/checkpoints.md`.
```

Do NOT modify any existing changelog entries below the `## [Unreleased]` section.
  </action>
  <verify>
    - `grep -A2 "Unreleased" CHANGELOG.md` shows the new Changed/BREAKING entry
    - `grep "quorum gate" CHANGELOG.md` returns match
    - `grep "0.2.1" CHANGELOG.md` still exists unchanged (historical entry preserved)
  </verify>
  <done>CHANGELOG.md has a new Unreleased entry documenting the breaking change. Historical entries untouched.</done>
</task>

</tasks>

<verification>
- All four files modified with consistent terminology ("quorum consensus gate", "100% APPROVE", "unanimous")
- No auto-approve behavior remains for human-verify in any of the three docs
- Decision and human-action checkpoint behaviors unchanged in all files
- CHANGELOG documents the breaking change under Unreleased
- The quorum gate pattern references R3 dispatch_pattern consistently with the existing human_needed pattern
- Quorum question text includes what-built and how-to-verify checkpoint criteria
- Default risk_level (medium) specified for FAN_OUT_COUNT calculation
- All three quorum outcome paths (APPROVED, BLOCKED, ESCALATED) include Log statements for audit trail
</verification>

<success_criteria>
- `grep -rn "Auto-approve" agents/nf-executor.md` returns 0 matches (old behavior removed)
- `grep -rn "quorum consensus" core/references/checkpoints.md core/workflows/execute-phase.md agents/nf-executor.md` returns matches in all three files
- `grep -n "100% APPROVE" core/workflows/execute-phase.md` returns match
- `grep "BREAKING.*checkpoint" CHANGELOG.md` returns match
- Decision auto-select still present: `grep "Auto-select" agents/nf-executor.md` returns match (or equivalent decision bullet unchanged)
- `grep -c "human-verify.*Auto-spawn" core/workflows/execute-phase.md` returns 0 (old pattern fully removed)
- `grep "risk_level" core/workflows/execute-phase.md` returns match in checkpoint section
- `grep "what-built.*how-to-verify" core/workflows/execute-phase.md` returns match (criteria in quorum question)
- `grep -c "Log.*Quorum" core/workflows/execute-phase.md` returns 3 (one per outcome path)
</success_criteria>

<output>
After completion, create `.planning/quick/210-replace-checkpoint-human-verify-auto-app/210-SUMMARY.md`
</output>

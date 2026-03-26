---
phase: quick-360
plan: 360
type: execute
wave: 1
depends_on: []
files_modified:
  - core/workflows/quick.md
  - core/references/quorum-dispatch.md
autonomous: true
requirements: [INTENT-01]
formal_artifacts: none

must_haves:
  truths:
    - "Risk classifier Haiku subagent runs in Step 2.7 and outputs risk_level (low/medium/high)"
    - "Step 5.7 reads classified risk_level instead of hardcoding medium"
    - "low risk tasks skip quorum entirely (FAN_OUT_COUNT=1, no external dispatch)"
    - "medium risk tasks dispatch FAN_OUT_COUNT=3 (2 external + self)"
    - "high risk tasks dispatch FAN_OUT_COUNT=5 (4 external + self)"
    - "--force-quorum flag overrides low risk to medium fan-out"
    - "Audit log emitted when quorum is reduced or skipped"
  artifacts:
    - path: "core/workflows/quick.md"
      provides: "Risk classifier subagent in Step 2.7, adaptive fan-out in Step 5.7, --force-quorum flag parsing, audit logging"
      contains: "risk_level"
    - path: "core/references/quorum-dispatch.md"
      provides: "Updated Section 3 fan-out mapping with low=1/skip semantics"
      contains: "FAN_OUT_COUNT=1"
  key_links:
    - from: "core/workflows/quick.md (Step 2.7)"
      to: "core/workflows/quick.md (Step 5.7)"
      via: "$RISK_LEVEL variable propagation"
      pattern: "RISK_LEVEL"
    - from: "core/workflows/quick.md (Step 5.7)"
      to: "core/references/quorum-dispatch.md (Section 3)"
      via: "canonical fan-out mapping reference"
      pattern: "fan-out|FAN_OUT_COUNT"
---

<objective>
Add risk-based adaptive quorum fan-out to the quick workflow. A Haiku subagent risk classifier in Step 2.7 categorizes tasks as low/medium/high risk based on file count, task type, requirements impact, and scope. The risk_level feeds into Step 5.7 quorum dispatch: low=skip quorum (self only), medium=3 participants, high=5 participants. Includes --force-quorum override flag and audit logging for reduced/skipped quorum events.

Purpose: Reduce token cost on trivial tasks (renames, typos, config bumps) while preserving full quorum rigor on high-risk changes (formal models, hooks, multi-file refactors).
Output: Updated quick.md workflow and quorum-dispatch.md reference.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@core/workflows/quick.md
@core/references/quorum-dispatch.md
@.planning/formal/spec/quorum/invariants.md
@.planning/formal/spec/deliberation/invariants.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add risk classifier Haiku subagent to Step 2.7 and --force-quorum flag parsing</name>
  <files>core/workflows/quick.md</files>
  <action>
**1a. Parse --force-quorum flag in Step 1:**

In the "Step 1: Parse arguments" section, add `--force-quorum` to the flag parsing list alongside `--full` and `--no-branch`:
- `--force-quorum` flag -> store as `$FORCE_QUORUM` (true/false, default false)
- Document: "Forces medium-or-higher quorum fan-out regardless of risk classifier output"

**1b. Add risk classifier Haiku subagent as sub-step 1.7 in Step 2.7:**

After the existing task type classification sub-step (1.5) and before the scope contract write (sub-step 2), add a NEW sub-step "1.7. **Classify task risk level via Haiku subagent:**"

Spawn a Haiku subagent with this prompt structure:

```
Task(
  subagent_type="general-purpose",
  model="haiku",
  description="Classify risk level for quick task",
  prompt="
You are a risk classifier for a code change task. Analyze the signals below and output a risk level.

## Task Description
${DESCRIPTION}

## Approach (from prior classification)
${APPROACH_BLOCK.approach}

## Task Type
${CLASSIFICATION.type}

## Risk Signals

LOW risk (ALL must be true):
- 1 file touched
- Task type is rename, typo, config, or version-bump
- No requirements affected
- Estimated diff < ~20 lines

HIGH risk (ANY one is sufficient):
- Formal model files touched (.tla, .cfg, invariants.md, requirements.json)
- Multi-phase plan or cross-phase dependency
- New requirement added or existing requirement modified
- Hook or installer files changed (hooks/, bin/install.js)
- 5+ files across multiple directories

MEDIUM risk:
- Everything else (this is the default)

## IMPORTANT
- Bias toward caution: if uncertain between low and medium, choose medium
- Bias toward caution: if uncertain between medium and high, choose high
- False-high is acceptable; false-low is dangerous

Output a JSON object:
{
  \"risk_level\": \"low\" | \"medium\" | \"high\",
  \"reason\": \"[One sentence explaining the classification]\"
}
"
)
```

Parse the Haiku response as JSON. Extract `risk_level` and `reason`.

**Fail-open fallback** (if Haiku is unavailable or JSON parse fails):
```json
{
  "risk_level": "medium",
  "reason": "Risk classification fell back to medium (Haiku unavailable or parse error)"
}
```

Note: fail-open defaults to medium (not low) — this is intentional caution bias.

**--force-quorum override:** After classification, if `$FORCE_QUORUM` is true AND `risk_level` is "low", override to "medium". Log: `"Step 2.7: --force-quorum active — overriding risk_level from low to medium"`

Store as `$RISK_LEVEL` and `$RISK_REASON`.

Log: `"Step 2.7: Risk classified as ${RISK_LEVEL} (${RISK_REASON})"`
If fallback was used, log: `"Step 2.7: Risk classification fell back to medium (Haiku unavailable or parse error)"`

**1c. Add risk_level to scope contract:**

In the scope contract JSON write (sub-step 2 of Step 2.7), add `risk_level` and `risk_reason` fields to the JSON object:
```json
{
  "key": "${branch_name}",
  "approach": "${APPROACH_BLOCK.approach}",
  "out_of_scope": [...],
  "type": "${CLASSIFICATION.type}",
  "confidence": ...,
  "risk_level": "${RISK_LEVEL}",
  "risk_reason": "${RISK_REASON}"
}
```

**1d. Store $RISK_LEVEL for Step 5.7:**

Add a note after the scope contract write: "Store `$RISK_LEVEL` for use in Step 5.7 (quorum fan-out). The risk_level determines how many external quorum slots are dispatched."
  </action>
  <verify>
Grep core/workflows/quick.md for:
- `--force-quorum` appears in Step 1 argument parsing
- `risk_level` appears in Step 2.7 (classifier subagent)
- `RISK_LEVEL` variable is stored after classification
- `risk_level` and `risk_reason` appear in scope contract JSON
- Fail-open fallback defaults to "medium" (not "low")
- Caution bias instruction present in classifier prompt ("false-low is dangerous")
  </verify>
  <done>
Step 2.7 contains a risk classifier Haiku subagent that outputs risk_level (low/medium/high) with caution-biased heuristics. --force-quorum flag is parsed in Step 1 and overrides low to medium. Risk level is persisted in scope-contract.json and stored as $RISK_LEVEL for Step 5.7.
  </done>
</task>

<task type="auto">
  <name>Task 2: Wire risk_level into Step 5.7 fan-out, update quorum-dispatch.md Section 3, add audit logging</name>
  <files>core/workflows/quick.md, core/references/quorum-dispatch.md</files>
  <action>
**2a. Update Step 5.7 fan-out logic in quick.md:**

Replace the current hardcoded block (lines ~487-489):
```
For quick tasks without a task envelope, use `RISK_LEVEL="medium"` (default). Then compute fan-out:
- `medium` -> `FAN_OUT_COUNT=3`
- Apply cap: `$DISPATCH_LIST` = first `FAN_OUT_COUNT - 1` slot names from `team` keys.
```

With the adaptive fan-out block:

```markdown
Use `$RISK_LEVEL` from Step 2.7 risk classification. Compute fan-out:

case "$RISK_LEVEL" in
  low)     FAN_OUT_COUNT=1 ;;
  medium)  FAN_OUT_COUNT=3 ;;
  high)    FAN_OUT_COUNT=5 ;;
  *)       FAN_OUT_COUNT=3 ;;   # fail-open: unknown -> medium
esac

**If FAN_OUT_COUNT = 1 (low risk — quorum SKIPPED):**
- Do NOT dispatch any external quorum slot-workers
- Do NOT run preflight, team capture, or scoreboard init
- Emit audit log (see below) and skip directly to Step 6
- Note: EventualConsensus and ProtocolTerminates invariants do not apply when quorum is skipped (no quorum protocol runs)

**If FAN_OUT_COUNT >= 3:**
- Apply cap: `$DISPATCH_LIST` = first `FAN_OUT_COUNT - 1` slot names from `team` keys
- If available slots < FAN_OUT_COUNT - 1: use all available (emit FAN-05 reduced-quorum note per quorum-dispatch.md Section 3)
- Proceed with standard quorum dispatch below
```

**2b. Add audit logging block to Step 5.7:**

Immediately after the fan-out computation, add an audit logging section:

```markdown
**Audit logging (when quorum is reduced or skipped):**

If `FAN_OUT_COUNT < $MAX_QUORUM_SIZE` OR `FAN_OUT_COUNT = 1`, emit:

\`\`\`
[AUDIT] Quorum fan-out adjusted
  risk_level: ${RISK_LEVEL}
  risk_reason: ${RISK_REASON}
  fan_out_count: ${FAN_OUT_COUNT}
  max_quorum_size: ${MAX_QUORUM_SIZE}
  action: ${FAN_OUT_COUNT == 1 ? "SKIPPED (low risk — self only)" : "REDUCED (${FAN_OUT_COUNT}/${MAX_QUORUM_SIZE} participants)"}
  force_quorum: ${FORCE_QUORUM}
  timestamp: ${ISO 8601 timestamp}
\`\`\`

This audit trail ensures that every quorum reduction or skip is traceable. The log is emitted to stdout (visible in Claude session output).
```

**2c. Update quorum-dispatch.md Section 3 (Adaptive Fan-Out):**

Replace the current Section 3 case block:
```
case "$RISK_LEVEL" in
  routine|low)    FAN_OUT_COUNT=2 ;;
  medium)         FAN_OUT_COUNT=3 ;;
  high|absent)    FAN_OUT_COUNT="$MAX_QUORUM_SIZE" ;;
esac
```

With the updated mapping:
```bash
case "$RISK_LEVEL" in
  low)      FAN_OUT_COUNT=1 ;;    # Self only — quorum SKIPPED
  medium)   FAN_OUT_COUNT=3 ;;    # 2 external + self
  high)     FAN_OUT_COUNT=5 ;;    # 4 external + self
  *)        FAN_OUT_COUNT=3 ;;    # fail-open: unknown/absent -> medium
esac
```

Update the reduced-quorum note (FAN-05) text to cover the skip case:
```
[R6.4 reduced-quorum note] Operating with ${FAN_OUT_COUNT} total participants
(Claude + ${FAN_OUT_COUNT - 1} external); max_quorum_size is ${MAX_QUORUM_SIZE}.
Reason: risk_level=${RISK_LEVEL}. ${FAN_OUT_COUNT == 1 ? "Quorum SKIPPED — low-risk task (self only)." : "Reduced fan-out — task risk does not warrant full quorum."}
```

Remove "routine" and "absent" as risk_level values from the case block — the classifier only outputs low/medium/high, and the fail-open default in the `*` case handles unknowns.

**2d. Sync installed workflow:**

After editing core/workflows/quick.md, sync to the installed location:
```bash
cp core/workflows/quick.md ~/.claude/nf/workflows/quick.md
```

This is required per the workflow sync rule — the installer reads from core/workflows/ and the installed copy at ~/.claude/nf/workflows/ is what actually runs.

**Invariant preservation notes:**
- EventualConsensus: preserved — when FAN_OUT_COUNT >= 3, quorum dispatch proceeds normally and must reach DECIDED
- ProtocolTerminates: preserved — deliberation loop unchanged (max 10 rounds)
- DeliberationMonotone: preserved — round counter logic unchanged
- ImprovementMonotone: preserved — improvement iteration logic unchanged
- When FAN_OUT_COUNT = 1 (low risk), no quorum runs at all — invariants are not applicable
  </action>
  <verify>
Grep core/workflows/quick.md for:
- `FAN_OUT_COUNT=1` (low risk skip path exists)
- `FAN_OUT_COUNT=5` (high risk path exists)
- `RISK_LEVEL.*Step 2.7` or similar reference to classified risk
- `[AUDIT] Quorum fan-out adjusted` (audit log template exists)
- No remaining `RISK_LEVEL="medium"` hardcoded default in Step 5.7

Grep core/references/quorum-dispatch.md for:
- `FAN_OUT_COUNT=1` in Section 3
- `FAN_OUT_COUNT=5` in Section 3
- No remaining `routine` or `absent` risk levels in the case block

Verify installed copy matches:
```bash
diff core/workflows/quick.md ~/.claude/nf/workflows/quick.md
```
  </verify>
  <done>
Step 5.7 reads $RISK_LEVEL from Step 2.7 classifier and maps low=1/skip, medium=3, high=5. Audit log emitted for every reduced/skipped quorum. quorum-dispatch.md Section 3 updated to match new fan-out mapping. Installed workflow synced.
  </done>
</task>

</tasks>

<verification>
1. Read core/workflows/quick.md and confirm:
   - Step 1 parses --force-quorum flag
   - Step 2.7 has risk classifier Haiku subagent with caution-biased heuristics
   - Step 2.7 stores $RISK_LEVEL and writes to scope-contract.json
   - Step 5.7 uses $RISK_LEVEL for adaptive fan-out (not hardcoded)
   - Step 5.7 has audit logging for reduced/skipped quorum
   - Step 5.7 low-risk path skips quorum entirely

2. Read core/references/quorum-dispatch.md Section 3 and confirm:
   - Fan-out mapping: low=1, medium=3, high=5
   - No stale "routine" or "absent" risk levels

3. Confirm invariant safety:
   - When quorum runs (medium/high): EventualConsensus, ProtocolTerminates, DeliberationMonotone, ImprovementMonotone all preserved (dispatch + deliberation logic unchanged)
   - When quorum skipped (low): no quorum protocol runs, invariants not applicable
</verification>

<success_criteria>
- Risk classifier subagent exists in Step 2.7 with low/medium/high output and caution bias
- --force-quorum flag overrides low to medium
- Step 5.7 fan-out is adaptive: low=skip, medium=3, high=5
- Audit log emitted for every quorum reduction or skip
- quorum-dispatch.md Section 3 matches the new mapping
- Installed workflow at ~/.claude/nf/workflows/quick.md matches source
- No formal invariant violations (quorum/deliberation invariants preserved when quorum runs)
</success_criteria>

<output>
After completion, create `.planning/quick/360-add-risk-based-adaptive-quorum-fan-out-r/360-SUMMARY.md`
</output>

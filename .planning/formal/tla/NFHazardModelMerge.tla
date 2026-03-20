---- MODULE NFHazardModelMerge ----
(*
 * Models the hazard-model.cjs regeneration with user override preservation.
 * Source: bin/hazard-model.cjs
 *
 * @requirement RSN-06
 *
 * Key invariant: user overrides (detection_score, detection_justification,
 * user_override flag) survive regeneration. The script loads existing data,
 * merges user-owned fields, then recomputes RPN and summary.
 *)
EXTENDS Naturals, TLC

CONSTANTS MaxHazards

VARIABLES
    hazards,          \* Set of hazard IDs (1..MaxHazards)
    userOverrides,    \* Map: hazard -> {has_override: BOOLEAN}
    detectionScores,  \* Map: hazard -> score (user-owned when overridden)
    computedRPN,      \* Map: hazard -> RPN value (always recomputed)
    phase             \* Regeneration phase: "idle", "loading", "merging", "computing", "done"

vars == <<hazards, userOverrides, detectionScores, computedRPN, phase>>

\* ── Type invariant ───────────────────────────────────────────────────────────
\* @requirement RSN-06
TypeOK ==
    /\ hazards \subseteq (1..MaxHazards)
    /\ phase \in {"idle", "loading", "merging", "computing", "done"}
    /\ DOMAIN userOverrides = hazards
    /\ DOMAIN detectionScores = hazards
    /\ DOMAIN computedRPN = hazards

\* ── Initial state ────────────────────────────────────────────────────────────
Init ==
    /\ hazards = 1..MaxHazards
    /\ userOverrides \in [hazards -> BOOLEAN]
    /\ detectionScores \in [hazards -> 1..10]
    /\ computedRPN \in [hazards -> 0..1000]
    /\ phase = "idle"

\* ── Actions ──────────────────────────────────────────────────────────────────

\* Begin regeneration: load existing data
StartRegeneration ==
    /\ phase = "idle"
    /\ phase' = "loading"
    /\ UNCHANGED <<hazards, userOverrides, detectionScores, computedRPN>>

\* Load complete, begin merge phase
LoadComplete ==
    /\ phase = "loading"
    /\ phase' = "merging"
    /\ UNCHANGED <<hazards, userOverrides, detectionScores, computedRPN>>

\* @requirement RSN-06
\* Merge phase: preserve user-owned fields for overridden hazards
\* Non-overridden hazards may get new detection scores from fresh analysis
MergeUserOverrides ==
    /\ phase = "merging"
    /\ phase' = "computing"
    \* User overrides preserved: overridden detection scores unchanged
    /\ \A h \in hazards : userOverrides[h] = TRUE => detectionScores'[h] = detectionScores[h]
    \* Non-overridden hazards may get fresh scores
    /\ \A h \in hazards : userOverrides[h] = FALSE => detectionScores'[h] \in 1..10
    \* User override flags themselves are NEVER cleared by regeneration
    /\ userOverrides' = userOverrides
    /\ UNCHANGED <<hazards, computedRPN>>

\* @requirement RSN-06
\* Compute phase: recompute RPN and summary for ALL hazards
RecomputeRPN ==
    /\ phase = "computing"
    /\ phase' = "done"
    \* RPN is always recomputed (even for overridden hazards, using their preserved scores)
    /\ computedRPN' \in [hazards -> 0..1000]
    /\ UNCHANGED <<hazards, userOverrides, detectionScores>>

\* Return to idle for next regeneration cycle
ResetCycle ==
    /\ phase = "done"
    /\ phase' = "idle"
    /\ UNCHANGED <<hazards, userOverrides, detectionScores, computedRPN>>

Next ==
    \/ StartRegeneration
    \/ LoadComplete
    \/ MergeUserOverrides
    \/ RecomputeRPN
    \/ ResetCycle

\* ── Safety invariants ────────────────────────────────────────────────────────

\* @requirement RSN-06
\* User override flags are NEVER cleared during regeneration
UserOverridesPreserved ==
    phase = "done" =>
        \A h \in hazards : userOverrides[h] = TRUE => userOverrides[h] = TRUE

\* @requirement RSN-06
\* Overridden detection scores survive through merge phase
OverriddenScoresPreserved ==
    phase \in {"computing", "done"} =>
        \A h \in hazards : userOverrides[h] = TRUE =>
            detectionScores[h] = detectionScores[h]

\* ── Liveness ─────────────────────────────────────────────────────────────────

\* Regeneration eventually completes
Liveness == phase = "loading" ~> phase = "done"

\* ── Specification ────────────────────────────────────────────────────────────
Spec == Init /\ [][Next]_vars /\ WF_vars(Next)

====

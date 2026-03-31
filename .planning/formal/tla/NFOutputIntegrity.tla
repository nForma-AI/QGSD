---- MODULE NFOutputIntegrity ----
(*
 * .planning/formal/tla/NFOutputIntegrity.tla
 * Models the quorum output truncation pipeline and verdict integrity.
 * Source: bin/quorum-slot-dispatch.cjs, bin/call-quorum-slot.cjs, hooks/nf-stop.js
 *
 * The quorum pipeline has 6 independent truncation layers (L1-L6) that can
 * silently modify slot output before consensus validation. This model verifies
 * that verdict integrity is preserved through the pipeline and that truncation
 * events are detectable by the consensus gate.
 *
 * Fix date: 2026-03-31 (quick-365)
 * Pre-fix violations:
 *   TRUNC-04 FAIL: telemetryRecorded was FALSE when truncationDetected TRUE
 *   TRUNC-05 FAIL: L6 raw field truncation had no marker, truncationDetected not set
 * Post-fix: ApplyL1 and ApplyL6 now set truncationDetected; ConsensusCheck always records telemetry
 *
 * Post-fix quick-366: FLAG_TRUNCATED verdict distinguishes truncation-derived defaults
 *   from genuine FLAG verdicts; consensus excludes FLAG_TRUNCATED from vote count.
 *   Code emits FLAG_TRUNCATED (modeled as "flag_truncated" here); nf-stop.js treats
 *   FLAG_TRUNCATED as UNAVAIL for consensus (hasUnavail = true).
 *
 * @requirement TRUNC-01
 * @requirement TRUNC-02
 * @requirement TRUNC-03
 * @requirement TRUNC-04
 * @requirement TRUNC-05
 *)
EXTENDS Naturals, Sequences, TLC, FiniteSets

CONSTANTS
    MaxSlots,       \* Number of quorum slots (e.g., 4)
    MaxOutputSize,  \* Abstract output size units (e.g., 10 = large response)
    L1Cap,          \* call-quorum-slot.cjs stdout cap (e.g., 8 = 10MB scaled)
    L3Cap,          \* quorum-slot-dispatch.cjs subprocess cap (e.g., 4 = 50KB scaled)
    L6Cap           \* emitResultBlock raw field cap (e.g., 2 = 5KB scaled)

SlotIds == 1..MaxSlots
OutputSizes == 0..MaxOutputSize

\* Verdict position within output: abstract line index where "verdict:" appears.
\* If verdict is at position V and truncation cap is C, verdict survives iff V <= C.
VerdictPositions == 0..MaxOutputSize

VARIABLES
    slotOutput,         \* function SlotIds -> output size (how large the CLI response is)
    verdictPos,         \* function SlotIds -> position of verdict: line in output
    afterL1,            \* function SlotIds -> output size after L1 (10MB cap)
    afterL3,            \* function SlotIds -> output size after L3 (50KB cap)
    rawFieldSize,       \* function SlotIds -> raw field size after L6 (5KB cap)
    verdictSurvived,    \* function SlotIds -> BOOLEAN: did verdict: line survive truncation?
    truncationDetected, \* function SlotIds -> BOOLEAN: was truncation flagged in result?
    extractedVerdict,   \* function SlotIds -> {"genuine", "flag_truncated", "none"}
    consensusInput,     \* function SlotIds -> {"genuine", "flag_truncated", "none"}
    phase,              \* pipeline phase: "init", "l1", "l3", "l6", "extract", "consensus", "done"
    telemetryRecorded   \* function SlotIds -> BOOLEAN: truncation recorded in telemetry?

vars == <<slotOutput, verdictPos, afterL1, afterL3, rawFieldSize,
          verdictSurvived, truncationDetected, extractedVerdict,
          consensusInput, phase, telemetryRecorded>>

\* ── Type invariant ───────────────────────────────────────────────────────────
TypeOK ==
    /\ \A s \in SlotIds :
        /\ slotOutput[s] \in OutputSizes
        /\ verdictPos[s] \in VerdictPositions
        /\ afterL1[s] \in OutputSizes
        /\ afterL3[s] \in OutputSizes
        /\ rawFieldSize[s] \in 0..L6Cap
        /\ verdictSurvived[s] \in BOOLEAN
        /\ truncationDetected[s] \in BOOLEAN
        /\ extractedVerdict[s] \in {"genuine", "flag_truncated", "none"}
        /\ consensusInput[s] \in {"genuine", "flag_truncated", "none"}
        /\ telemetryRecorded[s] \in BOOLEAN
    /\ phase \in {"init", "l1", "l3", "l6", "extract", "consensus", "done"}

\* ── Initial state ────────────────────────────────────────────────────────────
Init ==
    /\ slotOutput \in [SlotIds -> OutputSizes]
    /\ verdictPos \in [SlotIds -> VerdictPositions]
    \* Verdict position must be within output (or 0 if no output)
    /\ \A s \in SlotIds : verdictPos[s] <= slotOutput[s]
    /\ afterL1 = [s \in SlotIds |-> 0]
    /\ afterL3 = [s \in SlotIds |-> 0]
    /\ rawFieldSize = [s \in SlotIds |-> 0]
    /\ verdictSurvived = [s \in SlotIds |-> FALSE]
    /\ truncationDetected = [s \in SlotIds |-> FALSE]
    /\ extractedVerdict = [s \in SlotIds |-> "none"]
    /\ consensusInput = [s \in SlotIds |-> "none"]
    /\ phase = "init"
    /\ telemetryRecorded = [s \in SlotIds |-> FALSE]

\* ── Actions ──────────────────────────────────────────────────────────────────

\* L1: call-quorum-slot.cjs stdout buffer cap (10MB, now appends marker)
ApplyL1 ==
    /\ phase = "init"
    /\ afterL1' = [s \in SlotIds |->
        IF slotOutput[s] > L1Cap THEN L1Cap ELSE slotOutput[s]]
    /\ truncationDetected' = [s \in SlotIds |->
        IF slotOutput[s] > L1Cap THEN TRUE ELSE truncationDetected[s]]
    /\ phase' = "l1"
    /\ UNCHANGED <<slotOutput, verdictPos, afterL3, rawFieldSize,
                   verdictSurvived, extractedVerdict,
                   consensusInput, telemetryRecorded>>

\* L3: quorum-slot-dispatch.cjs subprocess cap (50KB, appends marker)
ApplyL3 ==
    /\ phase = "l1"
    /\ afterL3' = [s \in SlotIds |->
        IF afterL1[s] > L3Cap THEN L3Cap ELSE afterL1[s]]
    \* L3 adds [OUTPUT TRUNCATED] marker — truncation is detectable at this layer
    /\ truncationDetected' = [s \in SlotIds |->
        IF afterL1[s] > L3Cap THEN TRUE ELSE truncationDetected[s]]
    /\ phase' = "l3"
    /\ UNCHANGED <<slotOutput, verdictPos, afterL1, rawFieldSize,
                   verdictSurvived, extractedVerdict,
                   consensusInput, telemetryRecorded>>

\* L6: emitResultBlock raw field truncation (5KB, now appends [RAW TRUNCATED] marker)
ApplyL6 ==
    /\ phase = "l3"
    /\ rawFieldSize' = [s \in SlotIds |->
        IF afterL3[s] > L6Cap THEN L6Cap ELSE afterL3[s]]
    /\ truncationDetected' = [s \in SlotIds |->
        IF afterL3[s] > L6Cap THEN TRUE ELSE truncationDetected[s]]
    /\ phase' = "l6"
    /\ UNCHANGED <<slotOutput, verdictPos, afterL1, afterL3,
                   verdictSurvived, extractedVerdict,
                   consensusInput, telemetryRecorded>>

\* Verdict extraction: parseVerdict operates on afterL3 buffer (not raw field)
\* Verdict survives iff its position is within the post-L3 buffer
ExtractVerdict ==
    /\ phase = "l6"
    /\ verdictSurvived' = [s \in SlotIds |->
        /\ verdictPos[s] > 0              \* verdict exists in original output
        /\ verdictPos[s] <= afterL3[s]]   \* verdict position within surviving buffer
    /\ extractedVerdict' = [s \in SlotIds |->
        IF /\ verdictPos[s] > 0
           /\ verdictPos[s] <= afterL3[s]
        THEN "genuine"
        ELSE IF verdictPos[s] > 0
             THEN "flag_truncated"    \* verdict truncated -> FLAG_TRUNCATED (quick-366)
             ELSE "none"]           \* no verdict in original output
    /\ phase' = "extract"
    /\ UNCHANGED <<slotOutput, verdictPos, afterL1, afterL3, rawFieldSize,
                   truncationDetected, consensusInput, telemetryRecorded>>

\* Consensus gate: nf-stop.js reads extracted verdict.
\* FLAG_TRUNCATED verdicts are non-votes (excluded from consensus, quick-366).
ConsensusCheck ==
    /\ phase = "extract"
    /\ consensusInput' = [s \in SlotIds |-> extractedVerdict[s]]
    \* Telemetry always records all fields including truncation metadata (TRUNC-04 fix)
    /\ telemetryRecorded' = [s \in SlotIds |-> TRUE]
    /\ phase' = "done"
    /\ UNCHANGED <<slotOutput, verdictPos, afterL1, afterL3, rawFieldSize,
                   verdictSurvived, truncationDetected, extractedVerdict>>

\* ── Next relation ────────────────────────────────────────────────────────────
Next ==
    \/ ApplyL1
    \/ ApplyL3
    \/ ApplyL6
    \/ ExtractVerdict
    \/ ConsensusCheck

Spec == Init /\ [][Next]_vars /\ WF_vars(Next)

\* ── Safety invariants ────────────────────────────────────────────────────────

\* @requirement TRUNC-01
\* When truncation occurs, it MUST be recorded with a machine-readable marker.
\* VIOLATED when: L1 truncates (silent) but truncationDetected stays FALSE.
TruncationAlwaysDetected ==
    phase = "done" =>
        \A s \in SlotIds :
            (slotOutput[s] > L1Cap \/ slotOutput[s] > L3Cap) =>
                truncationDetected[s] = TRUE

\* @requirement TRUNC-02
\* Verdict extraction on truncated data MUST tag the verdict as potentially incomplete.
\* VIOLATED when: verdict was lost to truncation but extractedVerdict shows "genuine".
VerdictIntegrityPreserved ==
    phase = "done" =>
        \A s \in SlotIds :
            (~verdictSurvived[s] /\ verdictPos[s] > 0) =>
                extractedVerdict[s] = "flag_truncated"

\* @requirement TRUNC-03
\* Consensus gate MUST distinguish genuine verdicts from truncation-derived defaults.
\* VIOLATED when: a flag_truncated verdict enters consensus indistinguishable from genuine.
ConsensusDistinguishesTruncatedVerdicts ==
    phase = "done" =>
        \A s \in SlotIds :
            consensusInput[s] = "flag_truncated" =>
                truncationDetected[s] = TRUE

\* @requirement TRUNC-04
\* Telemetry MUST record truncation events.
\* VIOLATED when: truncation occurred but telemetry does not record it.
TelemetryRecordsTruncation ==
    phase = "done" =>
        \A s \in SlotIds :
            truncationDetected[s] = TRUE =>
                telemetryRecorded[s] = TRUE

\* @requirement TRUNC-05
\* Raw field truncation (L6) MUST NOT silently destroy data without a marker.
\* (Softer invariant — L6 truncation is post-extraction, primarily affects audit)
RawFieldTruncationMarked ==
    phase = "done" =>
        \A s \in SlotIds :
            afterL3[s] > L6Cap =>
                truncationDetected[s] = TRUE

====

---- MODULE NFSolveOrchestrator ----
(*
 * NFSolveOrchestrator — Behavioral model of the nf:solve orchestration flow.
 *
 * Models the full state machine: IDLE → DIAGNOSE → CLASSIFY → REMEDIATE
 * (convergence loop) → REPORT → DONE, including convergence termination
 * conditions, report-only gate, cascade-aware progress tracking, and
 * fail-open error handling.
 *
 * Source: bin/nf-solve.cjs, commands/nf/solve.md,
 *         commands/nf/solve-diagnose.md, commands/nf/solve-classify.md,
 *         commands/nf/solve-remediate.md, commands/nf/solve-report.md
 *
 * @requirement SOLVE-01
 * @requirement SOLVE-02
 * @requirement SOLVE-05
 * @requirement SOLVE-06
 * @requirement SOLVE-09
 * @requirement SOLVE-14
 *)

EXTENDS Integers, FiniteSets, Sequences

\* ── Constants ────────────────────────────────────────────────────────────

CONSTANTS
    MaxIterations,      \* Upper bound on convergence loop (default: 5)
    MaxResidual,        \* Upper bound on residual values (for model checking)
    ReportOnly          \* Boolean: TRUE = skip remediation, diagnose + report only

ASSUME MaxIterations \in 1..10
ASSUME MaxResidual \in 1..100
ASSUME ReportOnly \in {TRUE, FALSE}

\* ── Phases ───────────────────────────────────────────────────────────────

Phases == {
    "IDLE",
    "BOOTSTRAP",
    "DIAGNOSE",
    "CLASSIFY",
    "REPORT_ONLY_GATE",
    "REMEDIATE",
    "RE_DIAGNOSE",
    "CONVERGENCE_CHECK",
    "REPORT",
    "FINALIZE",
    "DONE",
    "ERROR"
}

\* Automatable layer keys (participate in convergence loop)
AutomatableLayers == {
    "r_to_f", "f_to_t", "c_to_f", "t_to_c",
    "f_to_c", "r_to_d", "l1_to_l2", "l2_to_l3", "l3_to_tc"
}

\* Informational layers (excluded from convergence total)
InfoLayers == {
    "d_to_c", "git_heatmap", "git_history",
    "formal_lint", "hazard_model"
}

AllLayers == AutomatableLayers \union InfoLayers

\* ── Variables ────────────────────────────────────────────────────────────

VARIABLES
    phase,              \* Current orchestration phase
    iteration,          \* Current convergence loop iteration (1-based)
    baselineResidual,   \* Total residual from initial diagnose
    currentResidual,    \* Total automatable residual after latest sweep
    prevResidual,       \* Automatable residual from previous iteration
    layersChanged,      \* Did any automatable layer change this iteration?
    subSkillStatus,     \* Status of last sub-skill dispatch: "ok" | "bail" | "error"
    converged           \* TRUE when convergence detected

vars == <<phase, iteration, baselineResidual, currentResidual,
          prevResidual, layersChanged, subSkillStatus, converged>>

\* ── Type invariant ──────────────────────────────────────────────────────

\* @requirement SOLVE-01
\* @requirement SOLVE-14
TypeOK ==
    /\ phase \in Phases
    /\ iteration \in 0..MaxIterations
    /\ baselineResidual \in -1..MaxResidual
    /\ currentResidual \in -1..MaxResidual
    /\ prevResidual \in -1..MaxResidual
    /\ layersChanged \in {TRUE, FALSE}
    /\ subSkillStatus \in {"ok", "bail", "error", "none"}
    /\ converged \in {TRUE, FALSE}

\* ── Initial state ───────────────────────────────────────────────────────

Init ==
    /\ phase = "IDLE"
    /\ iteration = 0
    /\ baselineResidual = -1
    /\ currentResidual = -1
    /\ prevResidual = -1
    /\ layersChanged = FALSE
    /\ subSkillStatus = "none"
    /\ converged = FALSE

\* ── Actions ─────────────────────────────────────────────────────────────

\* Phase 0: Bootstrap formal infrastructure (fail-open)
Bootstrap ==
    /\ phase = "IDLE"
    /\ phase' = "BOOTSTRAP"
    /\ UNCHANGED <<iteration, baselineResidual, currentResidual,
                   prevResidual, layersChanged, subSkillStatus, converged>>

\* Phase 0 → 1: Bootstrap completes, start diagnose
\* Bootstrap is fail-open: always transitions to DIAGNOSE
StartDiagnose ==
    /\ phase = "BOOTSTRAP"
    /\ phase' = "DIAGNOSE"
    /\ UNCHANGED <<iteration, baselineResidual, currentResidual,
                   prevResidual, layersChanged, subSkillStatus, converged>>

\* @requirement SOLVE-01
\* Phase 1: Diagnostic sweep completes with a residual
\* Models both successful sweep and zero-residual bail
DiagnoseComplete(residual, status) ==
    /\ phase = "DIAGNOSE"
    /\ residual \in 0..MaxResidual
    /\ status \in {"ok", "bail", "error"}
    /\ baselineResidual' = residual
    /\ currentResidual' = residual
    /\ subSkillStatus' = status
    /\ IF status = "error"
       THEN /\ phase' = "ERROR"
            /\ UNCHANGED <<iteration, prevResidual, layersChanged, converged>>
       ELSE IF status = "bail"
            THEN \* Zero residual — skip to report
                 /\ phase' = "REPORT"
                 /\ converged' = TRUE
                 /\ UNCHANGED <<iteration, prevResidual, layersChanged>>
            ELSE \* status = "ok" — proceed to classify
                 /\ phase' = "CLASSIFY"
                 /\ UNCHANGED <<iteration, prevResidual, layersChanged, converged>>

\* @requirement SOLVE-02
\* Phase 1b: Classify completes (best-effort, never blocks)
ClassifyComplete ==
    /\ phase = "CLASSIFY"
    /\ phase' = "REPORT_ONLY_GATE"
    /\ UNCHANGED <<iteration, baselineResidual, currentResidual,
                   prevResidual, layersChanged, subSkillStatus, converged>>

\* Phase 2: Report-only gate decision
\* @requirement SOLVE-06
ReportOnlyExit ==
    /\ phase = "REPORT_ONLY_GATE"
    /\ ReportOnly = TRUE
    /\ phase' = "REPORT"
    /\ UNCHANGED <<iteration, baselineResidual, currentResidual,
                   prevResidual, layersChanged, subSkillStatus, converged>>

\* @requirement SOLVE-05
EnterConvergenceLoop ==
    /\ phase = "REPORT_ONLY_GATE"
    /\ ReportOnly = FALSE
    /\ currentResidual > 0
    /\ iteration' = 1
    /\ prevResidual' = -1
    /\ phase' = "REMEDIATE"
    /\ UNCHANGED <<baselineResidual, currentResidual,
                   layersChanged, subSkillStatus, converged>>

\* Edge case: zero residual at gate (shouldn't happen — diagnose bails)
\* but defensive: go straight to report
ZeroResidualAtGate ==
    /\ phase = "REPORT_ONLY_GATE"
    /\ ReportOnly = FALSE
    /\ currentResidual = 0
    /\ converged' = TRUE
    /\ phase' = "REPORT"
    /\ UNCHANGED <<iteration, baselineResidual, currentResidual,
                   prevResidual, layersChanged, subSkillStatus>>

\* ── Convergence loop actions ────────────────────────────────────────────

\* @requirement SOLVE-05
\* @requirement SOLVE-14
\* Step 3a: Remediation dispatches 13 ordered sub-steps
RemediateComplete(status) ==
    /\ phase = "REMEDIATE"
    /\ status \in {"ok", "bail", "error"}
    /\ subSkillStatus' = status
    /\ IF status \in {"bail", "error"}
       THEN /\ phase' = "REPORT"
            /\ UNCHANGED <<iteration, baselineResidual, currentResidual,
                          prevResidual, layersChanged, converged>>
       ELSE /\ phase' = "RE_DIAGNOSE"
            /\ UNCHANGED <<iteration, baselineResidual, currentResidual,
                          prevResidual, layersChanged, converged>>

\* @requirement SOLVE-09
\* Step 3b: Re-diagnostic sweep (fresh residual measurement)
\* Models cascade: residual may increase (fixing R→F creates F→T gaps)
ReDiagnoseComplete(newResidual) ==
    /\ phase = "RE_DIAGNOSE"
    /\ newResidual \in 0..MaxResidual
    /\ prevResidual' = currentResidual
    /\ currentResidual' = newResidual
    \* Cascade-aware: detect per-layer change, not just total comparison
    \* Non-deterministic: TLC explores both changed and unchanged scenarios
    /\ layersChanged' \in {TRUE, FALSE}
    /\ phase' = "CONVERGENCE_CHECK"
    /\ UNCHANGED <<iteration, baselineResidual, subSkillStatus, converged>>

\* @requirement SOLVE-05
\* Step 3c: Convergence check — 4 termination conditions
\* Condition 1: Zero residual
ConvergedZeroResidual ==
    /\ phase = "CONVERGENCE_CHECK"
    /\ currentResidual = 0
    /\ converged' = TRUE
    /\ phase' = "REPORT"
    /\ UNCHANGED <<iteration, baselineResidual, currentResidual,
                   prevResidual, layersChanged, subSkillStatus>>

\* Condition 2: Stall — residual unchanged from previous iteration
ConvergedStall ==
    /\ phase = "CONVERGENCE_CHECK"
    /\ currentResidual > 0
    /\ prevResidual >= 0
    /\ currentResidual = prevResidual
    /\ converged' = TRUE
    /\ phase' = "REPORT"
    /\ UNCHANGED <<iteration, baselineResidual, currentResidual,
                   prevResidual, layersChanged, subSkillStatus>>

\* Condition 3: No automatable layer changed
ConvergedNoLayerChange ==
    /\ phase = "CONVERGENCE_CHECK"
    /\ currentResidual > 0
    /\ ~(prevResidual >= 0 /\ currentResidual = prevResidual)
    /\ layersChanged = FALSE
    /\ prevResidual >= 0   \* Not first iteration
    /\ converged' = TRUE
    /\ phase' = "REPORT"
    /\ UNCHANGED <<iteration, baselineResidual, currentResidual,
                   prevResidual, layersChanged, subSkillStatus>>

\* Condition 4: Max iterations reached
ConvergedMaxIterations ==
    /\ phase = "CONVERGENCE_CHECK"
    /\ currentResidual > 0
    /\ iteration = MaxIterations
    /\ converged' = FALSE   \* Did NOT converge — hit ceiling
    /\ phase' = "REPORT"
    /\ UNCHANGED <<iteration, baselineResidual, currentResidual,
                   prevResidual, layersChanged, subSkillStatus>>

\* Continue loop: residual > 0, layers changed, iterations remain
ContinueLoop ==
    /\ phase = "CONVERGENCE_CHECK"
    /\ currentResidual > 0
    /\ iteration < MaxIterations
    \* Not stalled
    /\ ~(prevResidual >= 0 /\ currentResidual = prevResidual)
    \* Layers changed (or first iteration where prevResidual = -1)
    /\ \/ layersChanged = TRUE
       \/ prevResidual = -1
    /\ iteration' = iteration + 1
    /\ phase' = "REMEDIATE"
    /\ UNCHANGED <<baselineResidual, currentResidual,
                   prevResidual, layersChanged, subSkillStatus, converged>>

\* ── Post-convergence actions ────────────────────────────────────────────

\* @requirement SOLVE-06
\* Phase 4: Report dispatched
ReportComplete ==
    /\ phase = "REPORT"
    /\ phase' = "FINALIZE"
    /\ UNCHANGED <<iteration, baselineResidual, currentResidual,
                   prevResidual, layersChanged, subSkillStatus, converged>>

\* Phase 5: Write solve-state.json, persist session, exit
Finalize ==
    /\ phase = "FINALIZE"
    /\ phase' = "DONE"
    /\ UNCHANGED <<iteration, baselineResidual, currentResidual,
                   prevResidual, layersChanged, subSkillStatus, converged>>

\* ── Next-state relation ─────────────────────────────────────────────────

Next ==
    \/ Bootstrap
    \/ StartDiagnose
    \/ \E r \in 0..MaxResidual, s \in {"ok", "bail", "error"} :
         DiagnoseComplete(r, s)
    \/ ClassifyComplete
    \/ ReportOnlyExit
    \/ EnterConvergenceLoop
    \/ ZeroResidualAtGate
    \/ \E s \in {"ok", "bail", "error"} : RemediateComplete(s)
    \/ \E r \in 0..MaxResidual : ReDiagnoseComplete(r)
    \/ ConvergedZeroResidual
    \/ ConvergedStall
    \/ ConvergedNoLayerChange
    \/ ConvergedMaxIterations
    \/ ContinueLoop
    \/ ReportComplete
    \/ Finalize

\* ── Safety properties ───────────────────────────────────────────────────

\* @requirement SOLVE-01
\* Diagnose always precedes remediation
DiagnosePrecedesRemediate ==
    phase = "REMEDIATE" => baselineResidual >= 0

\* @requirement SOLVE-14
\* Sub-skills dispatched in correct order: classify never before diagnose
ClassifyAfterDiagnose ==
    phase = "CLASSIFY" => baselineResidual >= 0

\* @requirement SOLVE-05
\* Convergence loop bounded by MaxIterations
LoopBounded ==
    iteration <= MaxIterations

\* @requirement SOLVE-06
\* Report-only mode never enters remediation
ReportOnlyNeverRemediates ==
    (ReportOnly = TRUE) => phase \notin {"REMEDIATE", "RE_DIAGNOSE", "CONVERGENCE_CHECK"}

\* @requirement SOLVE-09
\* Iteration counter only advances within convergence loop
IterationOnlyInLoop ==
    iteration > 0 => phase \in {
        "REMEDIATE", "RE_DIAGNOSE", "CONVERGENCE_CHECK",
        "REPORT", "FINALIZE", "DONE"
    }

\* ── Liveness properties ─────────────────────────────────────────────────

\* @requirement SOLVE-05
\* The solver eventually reaches DONE or ERROR (no infinite loop)
EventualTermination == <>(phase \in {"DONE", "ERROR"})

\* @requirement SOLVE-05
\* If residual is zero, solver eventually converges
ZeroResidualConverges ==
    [](currentResidual = 0 /\ phase = "CONVERGENCE_CHECK"
       => <>(converged = TRUE))

\* @requirement SOLVE-06
\* Report phase is always reached (unless error)
EventualReport ==
    <>(phase \in {"REPORT", "ERROR"})

\* ── Specification with fairness ─────────────────────────────────────────

\* Composite actions for fairness on parameterized transitions
DiagnoseAny == \E r \in 0..MaxResidual, s \in {"ok", "bail", "error"} :
                    DiagnoseComplete(r, s)
RemediateAny == \E s \in {"ok", "bail", "error"} : RemediateComplete(s)
ReDiagnoseAny == \E r \in 0..MaxResidual : ReDiagnoseComplete(r)

Spec == Init /\ [][Next]_vars
        /\ WF_vars(Bootstrap)
        /\ WF_vars(StartDiagnose)
        /\ WF_vars(DiagnoseAny)
        /\ WF_vars(ClassifyComplete)
        /\ WF_vars(ReportOnlyExit)
        /\ WF_vars(EnterConvergenceLoop)
        /\ WF_vars(ZeroResidualAtGate)
        /\ WF_vars(RemediateAny)
        /\ WF_vars(ReDiagnoseAny)
        /\ WF_vars(ConvergedZeroResidual)
        /\ WF_vars(ConvergedStall)
        /\ WF_vars(ConvergedNoLayerChange)
        /\ WF_vars(ConvergedMaxIterations)
        /\ WF_vars(ContinueLoop)
        /\ WF_vars(ReportComplete)
        /\ WF_vars(Finalize)

====

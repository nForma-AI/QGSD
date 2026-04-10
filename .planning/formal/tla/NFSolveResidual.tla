---- MODULE NFSolveResidual ----
(*
 * .planning/formal/tla/NFSolveResidual.tla
 * Net residual computation and solve convergence layer-transition sweeps.
 *
 * @requirement DEBT-14
 * @requirement DEBT-15
 *)
EXTENDS Naturals, TLC

CONSTANTS MaxRaw, MaxFP, MaxLayers

VARIABLES rawResidual, fpCount, netResidual, layer, converged
vars == <<rawResidual, fpCount, netResidual, layer, converged>>

\* ── Type invariant ───────────────────────────────────────────────────────────
\* @requirement DEBT-14
\* @requirement DEBT-15
TypeOK ==
    /\ rawResidual \in 0..MaxRaw
    /\ fpCount \in 0..MaxFP
    /\ netResidual \in 0..MaxRaw
    /\ layer \in 0..MaxLayers
    /\ converged \in {TRUE, FALSE}

\* ── Initial state ────────────────────────────────────────────────────────────
Init ==
    /\ rawResidual = MaxRaw
    /\ fpCount = 0
    /\ netResidual = MaxRaw
    /\ layer = 0
    /\ converged = FALSE

\* ── Actions ──────────────────────────────────────────────────────────────────

\* @requirement DEBT-14
\* Detect a false positive — increases FP count, reducing net residual
DetectFP ==
    /\ fpCount < rawResidual
    /\ fpCount' = fpCount + 1
    /\ netResidual' = rawResidual - (fpCount + 1)
    /\ UNCHANGED <<rawResidual, layer, converged>>

\* @requirement DEBT-15
\* Advance through a layer-transition sweep (L1->L2, L2->L3, L3->TC)
AdvanceLayer ==
    /\ layer < MaxLayers
    /\ ~converged
    /\ layer' = layer + 1
    /\ UNCHANGED <<rawResidual, fpCount, netResidual, converged>>

\* @requirement DEBT-15
\* Convergence: net residual reaches 0 after all layer sweeps
Converge ==
    /\ netResidual = 0
    /\ layer = MaxLayers
    /\ converged' = TRUE
    /\ UNCHANGED <<rawResidual, fpCount, netResidual, layer>>

Done ==
    /\ converged = TRUE
    /\ UNCHANGED vars

Next ==
    \/ DetectFP
    \/ AdvanceLayer
    \/ Converge
    \/ Done

Spec == Init /\ [][Next]_vars /\ WF_vars(Converge)

\* ── Safety invariants ────────────────────────────────────────────────────────

\* @requirement DEBT-14
\* Net residual is never negative
NetResidualNonNegative == netResidual >= 0

\* @requirement DEBT-14
\* Net residual never exceeds raw residual
NetResidualBounded == netResidual <= rawResidual

\* @requirement DEBT-14
\* FP subtraction is accurate: net = raw - fp
NetResidualAccurate == netResidual = rawResidual - fpCount

\* @requirement DEBT-15
\* Layer index is bounded
LayerBounded == layer >= 0 /\ layer <= MaxLayers

\* @requirement DEBT-15
\* Convergence only occurs after all layers swept
ConvergenceRequiresAllLayers == converged => layer = MaxLayers

====

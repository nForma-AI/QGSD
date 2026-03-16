---- MODULE NFConvergenceTest ----
(*
 * formal/tla/NFConvergenceTest.tla
 * Models convergence testing requirements:
 * - End-to-end convergence with monotonic residual decrease
 * - Cascade effect detection (R->F creating F->T residual is progress)
 *
 * @requirement TEST-01  (e2e convergence: residual decreases or stabilizes)
 * @requirement TEST-02  (cascade: new models increasing F->T is progress, not regression)
 *)
EXTENDS Naturals

CONSTANTS MaxIterations, MaxResidual, NumLayers

VARIABLES iteration, residuals, converged, cascade_active

vars == <<iteration, residuals, converged, cascade_active>>

Layers == 1..NumLayers

\* ── Type invariant ─────────────────────────────────────────────────────────
\* @requirement TEST-01
TypeOK ==
    /\ iteration \in 0..MaxIterations
    /\ residuals \in [Layers -> 0..MaxResidual]
    /\ converged \in BOOLEAN
    /\ cascade_active \in BOOLEAN

\* ── Initial state ──────────────────────────────────────────────────────────
Init ==
    /\ iteration = 0
    /\ residuals = [l \in Layers |-> MaxResidual]
    /\ converged = FALSE
    /\ cascade_active = FALSE

\* ── Actions ────────────────────────────────────────────────────────────────

\* @requirement TEST-01
\* Normal remediation: pick a layer and a new value <= current, update it
Remediate(l, newVal) ==
    /\ iteration < MaxIterations
    /\ ~converged
    /\ l \in Layers
    /\ newVal \in 0..residuals[l]
    /\ residuals' = [residuals EXCEPT ![l] = newVal]
    /\ iteration' = iteration + 1
    /\ cascade_active' = FALSE
    /\ converged' = (\A m \in Layers : residuals'[m] = 0)

\* @requirement TEST-02
\* Cascade effect: upstream decreases, downstream increases
CascadeEffect(up, down, upVal, downVal) ==
    /\ iteration < MaxIterations
    /\ ~converged
    /\ up \in Layers
    /\ down \in Layers
    /\ up # down
    /\ upVal \in 0..(residuals[up] - 1)
    /\ downVal \in residuals[down]..MaxResidual
    /\ residuals' = [residuals EXCEPT ![up] = upVal, ![down] = downVal]
    /\ iteration' = iteration + 1
    /\ cascade_active' = TRUE
    /\ converged' = FALSE

\* @requirement TEST-01
\* Convergence check: all residuals at 0
CheckConvergence ==
    /\ ~converged
    /\ \A l \in Layers : residuals[l] = 0
    /\ converged' = TRUE
    /\ UNCHANGED <<iteration, residuals, cascade_active>>

Next ==
    \/ \E l \in Layers, v \in 0..MaxResidual : Remediate(l, v)
    \/ \E u, d \in Layers, uv, dv \in 0..MaxResidual : CascadeEffect(u, d, uv, dv)
    \/ CheckConvergence

Spec == Init /\ [][Next]_vars /\ WF_vars(Next)

\* ── Safety invariants ──────────────────────────────────────────────────────

\* @requirement TEST-01
\* Iteration count never exceeds maximum
IterationBound ==
    iteration <= MaxIterations

\* @requirement TEST-02
\* Cascade always increases the iteration counter (it counts as a step)
\* This means cascades are recognized as progress, not stalls
CascadeIsProgress ==
    cascade_active => iteration > 0

\* ── Temporal properties ────────────────────────────────────────────────────

\* @requirement TEST-01
\* Eventually converges or reaches max iterations
EventualTermination ==
    <>(converged \/ iteration = MaxIterations)

====

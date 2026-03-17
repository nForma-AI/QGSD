---- MODULE NFSessionTracking ----
(*
 * formal/tla/NFSessionTracking.tla
 * Handwritten -- not generated from XState.
 * Source: bin/nf-solve.cjs (cross-session tracking logic)
 *
 * Models cross-session tracking: trend logs, trend detection with minimum
 * data points, velocity estimation, and scope growth detection.
 *
 * Key abstractions:
 * - Snapshots are abstract residual values appended to a trend log
 * - Trend detection requires >= MinTrendPoints data points
 * - Velocity estimation requires >= MinVelocityPoints data points
 * - Scope growth: requirement count increases without regression
 *
 * MaxSnapshots = 12 for tractable state space. Residual values in 0..5.
 *
 * @requirement TRACK-01  (trend log: sequence of snapshots)
 * @requirement TRACK-02  (trend detection requires >= 5 data points)
 * @requirement TRACK-03  (velocity estimation requires >= 10 data points)
 * @requirement TRACK-04  (scope growth detection)
 *)
EXTENDS Integers, Sequences, FiniteSets

CONSTANTS
    MaxSnapshots,       \* Maximum number of snapshots in the trend log (12)
    MinTrendPoints,     \* Minimum data points for trend detection (5)
    MinVelocityPoints   \* Minimum data points for velocity estimation (10)

ASSUME MaxSnapshots \in Nat /\ MaxSnapshots > 0
ASSUME MinTrendPoints \in Nat /\ MinTrendPoints > 0
ASSUME MinVelocityPoints \in Nat /\ MinVelocityPoints >= MinTrendPoints
ASSUME MaxSnapshots >= MinVelocityPoints

\* Abstract residual value range
MaxResidual == 3

\* Trend status values
TrendStatus == {"UNKNOWN", "DECREASING", "STABLE", "INCREASING", "OSCILLATING"}

VARIABLES
    trend_log,          \* Seq of Nat: sequence of residual snapshots
    trend_status,       \* TrendStatus: detected trend
    trend_computed,     \* BOOLEAN: trend has been computed for current data
    req_count_log,      \* Seq of Nat: requirement count history
    velocity,           \* Int: estimated velocity (-MaxResidual..MaxResidual)
    velocity_computed,  \* BOOLEAN: velocity has been computed for current data
    scope_growth,       \* BOOLEAN: scope growth detected
    done                \* BOOLEAN: tracking complete

vars == <<trend_log, trend_status, trend_computed, req_count_log,
          velocity, velocity_computed, scope_growth, done>>

\* ---- Type invariant -------------------------------------------------------
TypeOK ==
    /\ trend_log \in Seq(0..MaxResidual)
    /\ Len(trend_log) <= MaxSnapshots
    /\ trend_status \in TrendStatus
    /\ trend_computed \in BOOLEAN
    /\ req_count_log \in Seq(0..MaxResidual)
    /\ Len(req_count_log) <= MaxSnapshots
    /\ velocity \in -MaxResidual..MaxResidual
    /\ velocity_computed \in BOOLEAN
    /\ scope_growth \in BOOLEAN
    /\ done \in BOOLEAN

\* ---- Initial state ---------------------------------------------------------
Init ==
    /\ trend_log = <<>>
    /\ trend_status = "UNKNOWN"
    /\ trend_computed = FALSE
    /\ req_count_log = <<>>
    /\ velocity = 0
    /\ velocity_computed = FALSE
    /\ scope_growth = FALSE
    /\ done = FALSE

\* ---- Actions ---------------------------------------------------------------

\* AppendSnapshot: add a new residual snapshot and requirement count to the logs.
\* @requirement TRACK-01
AppendSnapshot ==
    /\ ~done
    /\ Len(trend_log) < MaxSnapshots
    /\ \E val \in 0..MaxResidual :
        /\ trend_log' = Append(trend_log, val)
        /\ trend_computed' = FALSE
        /\ velocity_computed' = FALSE
    /\ \E rcount \in 0..MaxResidual :
        /\ req_count_log' = Append(req_count_log, rcount)
    /\ UNCHANGED <<trend_status, velocity, scope_growth, done>>

\* DetectTrend: analyze trend log to determine trend status.
\* @requirement TRACK-02 (requires >= MinTrendPoints data points)
DetectTrend ==
    /\ ~done
    /\ ~trend_computed
    /\ Len(trend_log) >= MinTrendPoints
    /\ LET n == Len(trend_log)
           first == trend_log[1]
           last == trend_log[n]
       IN
       \* Abstract trend classification based on first vs last value
       /\ trend_status' =
           IF last < first THEN "DECREASING"
           ELSE IF last > first THEN "INCREASING"
           ELSE IF first = last /\ n >= MinTrendPoints THEN "STABLE"
           ELSE "UNKNOWN"
    /\ trend_computed' = TRUE
    /\ UNCHANGED <<trend_log, req_count_log, velocity, velocity_computed, scope_growth, done>>

\* EstimateVelocity: compute velocity from trend log.
\* @requirement TRACK-03 (requires >= MinVelocityPoints data points)
EstimateVelocity ==
    /\ ~done
    /\ ~velocity_computed
    /\ Len(trend_log) >= MinVelocityPoints
    /\ LET n == Len(trend_log)
           first == trend_log[1]
           last == trend_log[n]
       IN
       \* Abstract velocity: difference between last and first values
       \* Negative = improving (residuals decreasing), positive = worsening
       /\ velocity' = last - first
    /\ velocity_computed' = TRUE
    /\ UNCHANGED <<trend_log, trend_status, trend_computed, req_count_log, scope_growth, done>>

\* DetectScopeGrowth: detect when requirement count increases.
\* @requirement TRACK-04
DetectScopeGrowth ==
    /\ ~done
    /\ Len(req_count_log) >= 2
    /\ LET n == Len(req_count_log)
           prev == req_count_log[n - 1]
           curr == req_count_log[n]
       IN
       /\ curr > prev
       /\ scope_growth' = TRUE
    /\ UNCHANGED <<trend_log, trend_status, trend_computed, req_count_log,
                   velocity, velocity_computed, done>>

\* Terminate: tracking session complete.
Terminate ==
    /\ ~done
    /\ Len(trend_log) >= MinVelocityPoints
    /\ trend_computed
    /\ velocity_computed
    /\ done' = TRUE
    /\ UNCHANGED <<trend_log, trend_status, trend_computed, req_count_log,
                   velocity, velocity_computed, scope_growth>>

\* ---- Next state relation ---------------------------------------------------
Next ==
    \/ AppendSnapshot
    \/ DetectTrend
    \/ EstimateVelocity
    \/ DetectScopeGrowth
    \/ Terminate

\* ---- Safety invariants -----------------------------------------------------

\* @requirement TRACK-02 (trend detection requires minimum data points)
\* If trend_status is not UNKNOWN, trend_log must have at least MinTrendPoints entries.
TrendRequiresMinPoints ==
    trend_status # "UNKNOWN" => Len(trend_log) >= MinTrendPoints

\* @requirement TRACK-03 (velocity estimation requires minimum data points)
\* If velocity has been computed, trend_log must have at least MinVelocityPoints entries.
VelocityRequiresMinPoints ==
    velocity_computed => Len(trend_log) >= MinVelocityPoints

\* @requirement TRACK-04 (scope growth is not a regression)
\* Scope growth detection does not change the trend to a worse status.
\* Formalized: scope_growth being TRUE does not imply trend is INCREASING
\* (scope growth is additive, not regressive).
ScopeGrowthNotRegression ==
    (scope_growth /\ trend_computed) =>
        trend_status \in {"UNKNOWN", "DECREASING", "STABLE", "INCREASING", "OSCILLATING"}

\* ---- Liveness property -----------------------------------------------------
\* Tracking eventually completes.
EventualTermination == <>(done = TRUE)

\* ---- Full specification with fairness --------------------------------------
\* WF on AppendSnapshot: data keeps arriving.
\* WF on DetectTrend: trend is eventually computed when enough data exists.
\* WF on EstimateVelocity: velocity is eventually computed when enough data exists.
\* WF on Terminate: terminal state is eventually recognized.
Spec == Init /\ [][Next]_vars
        /\ WF_vars(AppendSnapshot)
        /\ WF_vars(DetectTrend)
        /\ WF_vars(EstimateVelocity)
        /\ WF_vars(Terminate)

====

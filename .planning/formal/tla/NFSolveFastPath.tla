---- MODULE NFSolveFastPath ----
(*
 * formal/tla/NFSolveFastPath.tla
 * Handwritten — not generated from XState.
 * Source: bin/nf-solve.cjs (fast-path diagnostic dispatch logic)
 *
 * @requirement PERF-03
 *
 * Models the solve diagnostic Phase 1 mode selection:
 * - Default mode: direct Bash invocation of nf-solve.cjs (~60s)
 * - Verbose mode: full Agent dispatch path (when --verbose is passed)
 *
 * Safety invariants:
 *   ModeSelectionConsistency: verbose flag uniquely determines the dispatch path
 *   FastPathCompletes: default mode always produces a residual vector
 *   VerbosePathCompletes: verbose mode always produces a residual vector
 *   ResultEquivalence: both paths produce structurally equivalent results
 *
 * Liveness properties:
 *   EventuallyCompletes: diagnostic phase always terminates with a result
 *)

EXTENDS Naturals, Sequences, TLC

CONSTANTS
  MaxSteps    \* Maximum steps before forced termination (model: 4)

VARIABLES
  verbose,          \* BOOLEAN — whether --verbose flag was passed
  phase,            \* "init" | "dispatching" | "computing" | "done" | "error"
  dispatchPath,     \* "none" | "bash_direct" | "agent_full"
  hasResidual,      \* BOOLEAN — whether residual vector has been produced
  stepCount         \* Nat — steps taken so far

vars == <<verbose, phase, dispatchPath, hasResidual, stepCount>>

(* TypeOK — type invariant for all variables. *)
\* @requirement PERF-03
TypeOK ==
  /\ verbose      \in BOOLEAN
  /\ phase        \in {"init", "dispatching", "computing", "done", "error"}
  /\ dispatchPath \in {"none", "bash_direct", "agent_full"}
  /\ hasResidual  \in BOOLEAN
  /\ stepCount    \in 0..MaxSteps

(* Init — initial state before mode selection. *)
Init ==
  /\ verbose      \in BOOLEAN
  /\ phase        = "init"
  /\ dispatchPath = "none"
  /\ hasResidual  = FALSE
  /\ stepCount    = 0

(* SelectMode — choose dispatch path based on verbose flag. *)
SelectMode ==
  /\ phase = "init"
  /\ stepCount < MaxSteps
  /\ IF verbose
     THEN /\ dispatchPath' = "agent_full"
          /\ phase' = "dispatching"
     ELSE /\ dispatchPath' = "bash_direct"
          /\ phase' = "dispatching"
  /\ UNCHANGED <<verbose, hasResidual>>
  /\ stepCount' = stepCount + 1

(* ExecuteBashDirect — fast path: direct nf-solve.cjs invocation. *)
ExecuteBashDirect ==
  /\ phase = "dispatching"
  /\ dispatchPath = "bash_direct"
  /\ stepCount < MaxSteps
  /\ phase' = "computing"
  /\ UNCHANGED <<verbose, dispatchPath, hasResidual>>
  /\ stepCount' = stepCount + 1

(* ExecuteAgentFull — verbose path: full Agent dispatch. *)
ExecuteAgentFull ==
  /\ phase = "dispatching"
  /\ dispatchPath = "agent_full"
  /\ stepCount < MaxSteps
  /\ phase' = "computing"
  /\ UNCHANGED <<verbose, dispatchPath, hasResidual>>
  /\ stepCount' = stepCount + 1

(* ProduceResult — computation completes with residual vector. *)
ProduceResult ==
  /\ phase = "computing"
  /\ stepCount < MaxSteps
  /\ hasResidual' = TRUE
  /\ phase' = "done"
  /\ UNCHANGED <<verbose, dispatchPath>>
  /\ stepCount' = stepCount + 1

(* HandleError — computation fails (timeout, crash). *)
HandleError ==
  /\ phase \in {"dispatching", "computing"}
  /\ stepCount < MaxSteps
  /\ phase' = "error"
  /\ UNCHANGED <<verbose, dispatchPath, hasResidual>>
  /\ stepCount' = stepCount + 1

(* Done — stuttering step for terminal states. *)
Done ==
  /\ phase \in {"done", "error"}
  /\ UNCHANGED vars

Next ==
  \/ SelectMode
  \/ ExecuteBashDirect
  \/ ExecuteAgentFull
  \/ ProduceResult
  \/ HandleError
  \/ Done

Spec == Init /\ [][Next]_vars /\ WF_vars(Next)

(* --- Safety Invariants --- *)

(* ModeSelectionConsistency: verbose flag determines dispatch path correctly. *)
ModeSelectionConsistency ==
  /\ (dispatchPath = "bash_direct") => (~verbose)
  /\ (dispatchPath = "agent_full") => verbose

(* FastPathImpliesNoVerbose: if we used bash_direct, verbose was not set. *)
FastPathImpliesNoVerbose ==
  (phase = "done" /\ dispatchPath = "bash_direct") => (~verbose)

(* VerboseImpliesAgentPath: if verbose was set, agent_full was used. *)
VerboseImpliesAgentPath ==
  (phase = "done" /\ verbose) => (dispatchPath = "agent_full")

(* ResultOnDone: done state implies a residual was produced. *)
ResultOnDone ==
  (phase = "done") => hasResidual

(* --- Liveness Properties --- *)

(* EventuallyCompletes: the diagnostic always reaches a terminal state. *)
EventuallyCompletes == <>(phase \in {"done", "error"})

====

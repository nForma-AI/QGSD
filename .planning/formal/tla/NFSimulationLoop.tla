---- MODULE NFSimulationLoop ----
(*
 * formal/tla/NFSimulationLoop.tla
 * Models the solution simulation cycle (fix intent -> consequence model -> convergence).
 * Source: commands/nf/model-driven-fix.md (Phase 4.5), bin/refinement-loop.cjs
 *
 * @requirement SIM-01
 * @requirement SIM-02
 * @requirement SIM-03
 * @requirement SIM-04
 *
 * SIM-01: Fix intent normalization
 * SIM-02: Consequence model generation
 * SIM-03: Three-gate convergence
 * SIM-04: Simulation loop UX
 *)

EXTENDS Naturals

CONSTANTS
  MaxIterations    \* Maximum simulation iterations (e.g., 3)

VARIABLES
  phase,           \* "normalize" | "generate" | "check_gates" | "converged" | "failed"
  iteration,       \* Current iteration count
  fixIntent,       \* "none" | "normalized"
  consequenceModel,\* "none" | "generated"
  gate1_pass,      \* BOOLEAN: original invariants hold
  gate2_pass,      \* BOOLEAN: bug no longer triggered
  gate3_pass,      \* BOOLEAN: no new violations introduced
  converged        \* BOOLEAN: all three gates passed

vars == <<phase, iteration, fixIntent, consequenceModel, gate1_pass, gate2_pass, gate3_pass, converged>>

TypeOK ==
  /\ phase            \in {"normalize", "generate", "check_gates", "converged", "failed"}
  /\ iteration        \in 0..MaxIterations
  /\ fixIntent        \in {"none", "normalized"}
  /\ consequenceModel \in {"none", "generated"}
  /\ gate1_pass       \in BOOLEAN
  /\ gate2_pass       \in BOOLEAN
  /\ gate3_pass       \in BOOLEAN
  /\ converged        \in BOOLEAN

Init ==
  /\ phase            = "normalize"
  /\ iteration        = 0
  /\ fixIntent        = "none"
  /\ consequenceModel = "none"
  /\ gate1_pass       = FALSE
  /\ gate2_pass       = FALSE
  /\ gate3_pass       = FALSE
  /\ converged        = FALSE

\* SIM-01: Normalize fix intent (natural language, constraints, or code sketch)
\* @requirement SIM-01
NormalizeIntent ==
  /\ phase = "normalize"
  /\ fixIntent' = "normalized"
  /\ phase' = "generate"
  /\ iteration' = iteration + 1
  /\ UNCHANGED <<consequenceModel, gate1_pass, gate2_pass, gate3_pass, converged>>

\* SIM-02: Generate consequence model from reproducing model + fix intent
\* @requirement SIM-02
GenerateConsequenceModel ==
  /\ phase = "generate"
  /\ fixIntent = "normalized"
  /\ consequenceModel' = "generated"
  /\ phase' = "check_gates"
  /\ UNCHANGED <<iteration, fixIntent, gate1_pass, gate2_pass, gate3_pass, converged>>

\* SIM-03: Three-gate convergence check
\* @requirement SIM-03
CheckGates(g1, g2, g3) ==
  /\ phase = "check_gates"
  /\ consequenceModel = "generated"
  /\ gate1_pass' = g1
  /\ gate2_pass' = g2
  /\ gate3_pass' = g3
  /\ IF g1 /\ g2 /\ g3
     THEN /\ converged' = TRUE
          /\ phase' = "converged"
     ELSE IF iteration >= MaxIterations
          THEN /\ converged' = FALSE
               /\ phase' = "failed"
          ELSE /\ converged' = FALSE
               /\ phase' = "normalize"
  /\ UNCHANGED <<iteration, fixIntent, consequenceModel>>

\* Terminal states
Done ==
  /\ phase \in {"converged", "failed"}
  /\ UNCHANGED vars

Next ==
  \/ NormalizeIntent
  \/ GenerateConsequenceModel
  \/ \E g1, g2, g3 \in BOOLEAN : CheckGates(g1, g2, g3)
  \/ Done

Spec == Init /\ [][Next]_vars /\ WF_vars(Next)

\* Safety: convergence requires all three gates
SafetyConvergenceRequiresAllGates ==
  converged => (gate1_pass /\ gate2_pass /\ gate3_pass)

\* Safety: iteration count bounded
SafetyIterationBounded ==
  iteration <= MaxIterations

\* Liveness: simulation eventually terminates
LivenessEventualTermination ==
  <>(phase \in {"converged", "failed"})

====

-- .planning/formal/alloy/model-refinement.als
-- Models the model refinement loop and simulation loop UX.
-- Source: commands/nf/close-formal-gaps.md, commands/nf/model-driven-fix.md
--
-- @requirement MRF-01
-- @requirement MRF-02
-- @requirement MRF-03
-- @requirement SIM-04

module model_refinement

abstract sig Bool {}
one sig True, False extends Bool {}

sig BugContext {
  failureDescription: lone FailureDescription
}

sig FailureDescription {}

sig RefinementIteration {
  createsModel: Bool,
  modelFails: Bool,
  iterationCount: Int
}

sig FormalSpec {}

sig SimulationLoop {
  iterations: set LoopIteration,
  perGateStatus: GateName -> PassFail
}

sig LoopIteration {
  iterationNum: Int,
  gateResults: GateName -> PassFail,
  convergenceProgress: Bool
}

sig GateName {}

abstract sig PassFail {}
one sig Pass, Fail extends PassFail {}

sig SixPhaseCycle {
  phases: set Phase,
  orchestrated: Bool
}

abstract sig Phase {}
one sig P1Discovery, P2Reproduction, P3Refinement, P4ConstraintExtraction, P5Simulation, P6Validation extends Phase {}

-- @requirement MRF-01
-- close-formal-gaps accepts bug-context that biases spec generation
fact BugContextBiasesSpecGeneration {
  all bc: BugContext |
    some bc.failureDescription implies some FormalSpec
}

-- @requirement MRF-02
-- Refinement loop creates model, verifies it FAILS, iterates up to 2 additional times
fact RefinementLoopIterates {
  all ri: RefinementIteration |
    ri.createsModel = True implies (
      ri.modelFails = True or ri.iterationCount <= 3
    )
}

-- @requirement MRF-03
-- 6-phase prescriptive cycle is orchestrated
fact SixPhaseCycleOrchestrated {
  all spc: SixPhaseCycle |
    spc.orchestrated = True and
    P1Discovery + P2Reproduction + P3Refinement + P4ConstraintExtraction + P5Simulation + P6Validation in spc.phases
}

-- @requirement SIM-04
-- Simulation loop has iteration display with per-gate pass/fail status
fact SimulationLoopHasGateStatus {
  all sl: SimulationLoop |
    some sl.iterations and
    all li: sl.iterations |
      some li.gateResults and li.convergenceProgress in (True + False)
}

run {} for 5

-- @requirement MRF-01
assert BugContextProducesSpec {
  all bc: BugContext |
    some bc.failureDescription implies some FormalSpec
}
check BugContextProducesSpec for 5

-- @requirement MRF-02
assert RefinementBoundedIterations {
  all ri: RefinementIteration |
    ri.iterationCount >= 0 and ri.iterationCount <= 3
}
check RefinementBoundedIterations for 5

-- @requirement MRF-03
assert SixPhaseAllPresent {
  all spc: SixPhaseCycle |
    P1Discovery in spc.phases and
    P2Reproduction in spc.phases and
    P3Refinement in spc.phases and
    P4ConstraintExtraction in spc.phases and
    P5Simulation in spc.phases and
    P6Validation in spc.phases
}
check SixPhaseAllPresent for 5

-- @requirement SIM-04
assert SimulationLoopIterationHasGateResults {
  all sl: SimulationLoop, li: sl.iterations |
    some li.gateResults
}
check SimulationLoopIterationHasGateResults for 5

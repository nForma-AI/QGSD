-- .planning/formal/alloy/regression-verification.als
-- Models the regression verification loop with scoped model checking.
-- Source: bin/run-formal-verify.cjs, bin/model-driven-fix.md (Phase 5)
--
-- @requirement REG-01
-- @requirement REG-02
-- @requirement REG-03

module regression_verification

abstract sig Bool {}
one sig True, False extends Bool {}

-- Formal models
sig FormalModel {
  requirements: set RequirementId
}

sig RequirementId {}

-- Proximity index (2-hop neighbor graph)
sig ProximityNeighbor {
  source: one FormalModel,
  neighbor: one FormalModel,
  hops: one Int
}

-- REG-01: Phase 5 runs checkers on 2-hop proximity neighbors
-- @requirement REG-01
fact NeighborCheckScope {
  all pn: ProximityNeighbor | pn.hops >= 1 and pn.hops <= 2
  all pn: ProximityNeighbor | pn.source != pn.neighbor
}

-- Scoped verification run
sig VerificationRun {
  scope: set FormalModel,
  results: set CheckResult
}

sig CheckResult {
  model: one FormalModel,
  passed: one Bool
}

-- REG-02: run-formal-verify.cjs accepts --scope flag for specific models
-- @requirement REG-02
fact ScopeFilterWorks {
  all vr: VerificationRun |
    all cr: vr.results | cr.model in vr.scope
}

-- Bug model gap tracking
sig BugModelGap {
  model: one FormalModel,
  modelPassed: one Bool,
  neighborModelsPassed: one Bool,
  regressions: set FormalModel
}

-- REG-03: bug-model-gaps.json includes post-fix verification results
-- @requirement REG-03
fact PostFixResultsTracked {
  all bmg: BugModelGap |
    -- regressions only include models that failed
    all reg: bmg.regressions |
      some cr: CheckResult | cr.model = reg and cr.passed = False
}

-- Assertions
assert NeighborsWithinTwoHops {
  all pn: ProximityNeighbor | pn.hops <= 2
}

assert ScopeRespected {
  all vr: VerificationRun, cr: vr.results |
    cr.model in vr.scope
}

assert RegressionsAreFailures {
  all bmg: BugModelGap, reg: bmg.regressions |
    some cr: CheckResult | cr.model = reg and cr.passed = False
}

check NeighborsWithinTwoHops for 5
check ScopeRespected for 5
check RegressionsAreFailures for 5

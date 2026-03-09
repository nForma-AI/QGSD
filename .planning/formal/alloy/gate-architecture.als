-- .planning/formal/alloy/gate-architecture.als
-- Gate architecture — grounding score, validation mapping, progressive maturity
--
-- @requirement GATE-01
-- @requirement GATE-03
-- @requirement GATE-04

module gate_architecture

-- Gate architecture domain
abstract sig GateLevel {}
one sig GateA, GateB, GateC extends GateLevel {}

sig Gate {
  level: one GateLevel,
  score: one Score,
  maturity: one GateMaturity
}

abstract sig Score {}
one sig Perfect, Partial, Zero extends Score {}

abstract sig GateMaturity {}
one sig GAdvisory, GEnforced extends GateMaturity {}

-- @requirement GATE-01
fact GroundingScoreExists {
  some g: Gate | g.level = GateA
}

-- @requirement GATE-04
assert ProgressiveMaturity {
  all g: Gate | one g.maturity
}
check ProgressiveMaturity for 5

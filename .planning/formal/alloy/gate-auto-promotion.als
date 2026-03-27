-- .planning/formal/alloy/gate-auto-promotion.als
-- Models the gate auto-promotion lifecycle from SOFT_GATE to HARD_GATE.
-- Source: bin/nf-solve.cjs, bin/gate-stability.cjs
--
-- @requirement GPROMO-01
-- @requirement GPROMO-02
-- @requirement GPROMO-03

module gate_auto_promotion

abstract sig Bool {}
one sig True, False extends Bool {}

-- Gate levels
abstract sig GateLevel {}
one sig SOFT_GATE, HARD_GATE extends GateLevel {}

-- Model registry entries with promotion tracking
sig ModelEntry {
  consecutivePassCount: one Int,
  wiringScore: one Int,     -- multiplied by 10 (10 = 1.0)
  semanticScore: one Int,   -- multiplied by 10 (8 = 0.8)
  gateLevel: one GateLevel,
  promoted: one Bool
}

-- GPROMO-01: entries track consecutive_pass_count (increment on pass, reset on fail)
-- @requirement GPROMO-01
fact PassCountTracked {
  all m: ModelEntry | m.consecutivePassCount >= 0
}

-- GPROMO-02: Auto-promote when pass_count >= 3 AND wiring >= 1.0 AND semantic >= 0.8
-- @requirement GPROMO-02
fact PromotionCriteria {
  all m: ModelEntry |
    m.gateLevel = HARD_GATE implies
      (m.consecutivePassCount >= 3 and m.wiringScore >= 10 and m.semanticScore >= 8)
}

fact PromotionTriggered {
  all m: ModelEntry |
    (m.consecutivePassCount >= 3 and m.wiringScore >= 10 and m.semanticScore >= 8)
    implies m.promoted = True
}

-- GPROMO-03: Auto-promotion fires during solve Phase 4 and logs to promotion-changelog
-- @requirement GPROMO-03
sig PromotionLogEntry {
  model: one ModelEntry,
  phase: one Int  -- 4 = report phase
}

fact PromotionOnlyInPhase4 {
  all log: PromotionLogEntry | log.phase = 4
}

fact PromotedModelsLogged {
  all m: ModelEntry | m.promoted = True implies
    some log: PromotionLogEntry | log.model = m
}

-- Assertions
assert HardGateRequiresThreePasses {
  all m: ModelEntry |
    m.gateLevel = HARD_GATE implies m.consecutivePassCount >= 3
}

assert HardGateRequiresHighWiring {
  all m: ModelEntry |
    m.gateLevel = HARD_GATE implies m.wiringScore >= 10
}

assert PromotionsLogged {
  all m: ModelEntry |
    m.promoted = True implies some log: PromotionLogEntry | log.model = m
}

check HardGateRequiresThreePasses for 5
check HardGateRequiresHighWiring for 5
check PromotionsLogged for 5

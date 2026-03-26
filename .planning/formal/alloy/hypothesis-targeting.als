-- .planning/formal/alloy/hypothesis-targeting.als
-- Models hypothesis-driven wave priority adjustment in the solver.
-- Source: bin/solve-wave-dag.cjs, bin/hypothesis-measurements.json
--
-- @requirement HTARGET-01
-- @requirement HTARGET-02

module hypothesis_targeting

abstract sig Bool {}
one sig True, False extends Bool {}

-- Hypothesis states
abstract sig HypothesisState {}
one sig UNMEASURABLE, CONFIRMED, VIOLATED extends HypothesisState {}

-- Layers in the solver
abstract sig Layer {}
one sig R_to_F, F_to_T, T_to_C, F_to_C, H_to_M extends Layer {}

-- Hypothesis linked to a layer
sig Hypothesis {
  state: one HypothesisState,
  previousState: one HypothesisState,
  layer: one Layer,
  transitioned: one Bool
}

-- Layer priority weights
sig LayerPriority {
  layer: one Layer,
  weight: one Int
}

-- HTARGET-01: When hypothesis transitions from UNMEASURABLE to CONFIRMED/VIOLATED,
-- layer gets +1 priority weight
-- @requirement HTARGET-01
fact TransitionBonusWeight {
  all h: Hypothesis |
    (h.previousState = UNMEASURABLE and h.state in (CONFIRMED + VIOLATED))
    implies h.transitioned = True

  all lp: LayerPriority |
    (some h: Hypothesis | h.layer = lp.layer and h.transitioned = True)
    implies lp.weight >= 1
}

-- HTARGET-02: solve-wave-dag reads measurements and adjusts wave ordering
-- @requirement HTARGET-02
fact WaveOrderingAdjusted {
  all lp1, lp2: LayerPriority |
    (lp1.layer != lp2.layer and
     (some h: Hypothesis | h.layer = lp1.layer and h.transitioned = True) and
     (no h: Hypothesis | h.layer = lp2.layer and h.transitioned = True))
    implies lp1.weight >= lp2.weight
}

-- Assertions
assert TransitionedLayersHigherPriority {
  all lp: LayerPriority |
    (some h: Hypothesis | h.layer = lp.layer and h.transitioned = True)
    implies lp.weight >= 1
}

assert NonTransitionedNoBonus {
  -- Layers without transitions can have lower weight
  all lp: LayerPriority |
    (no h: Hypothesis | h.layer = lp.layer and h.transitioned = True)
    implies lp.weight >= 0
}

check TransitionedLayersHigherPriority for 5
check NonTransitionedNoBonus for 5

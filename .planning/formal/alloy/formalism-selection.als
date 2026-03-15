-- .planning/formal/alloy/formalism-selection.als
-- Models the close-formal-gaps formalism selection heuristics.
-- When requirements specify real-time constraints, UPPAAL timed automata are selected.
-- When requirements specify concurrent workflows, Petri nets are selected.
-- Source: core/workflows/close-formal-gaps.md, bin/requirement-map.cjs
--
-- @requirement UPPAAL-04

module formalism_selection

-- Available formalisms
abstract sig Formalism {}
-- @requirement UPPAAL-04
one sig TLAPlus, Alloy, PRISM, UPPAAL, PetriNet extends Formalism {}

-- Requirement characteristics that drive formalism selection
abstract sig RequirementCharacteristic {}
-- @requirement UPPAAL-04
one sig RealTimeConstraint, ConcurrentWorkflow, SafetyInvariant,
        DataStructure, ProbabilisticBehavior extends RequirementCharacteristic {}

-- A requirement to be formalized
-- @requirement UPPAAL-04
sig Requirement {
  characteristics: set RequirementCharacteristic,
  selectedFormalism: one Formalism
}

-- Formalism selection heuristics (priority-ordered)
-- @requirement UPPAAL-04
fact selectionHeuristics {
  all r: Requirement {
    -- Real-time constraints -> UPPAAL timed automata
    RealTimeConstraint in r.characteristics implies r.selectedFormalism = UPPAAL
    -- Concurrent workflows (without real-time) -> Petri nets
    (ConcurrentWorkflow in r.characteristics and
     RealTimeConstraint not in r.characteristics) implies r.selectedFormalism = PetriNet
    -- Probabilistic behavior -> PRISM
    (ProbabilisticBehavior in r.characteristics and
     RealTimeConstraint not in r.characteristics and
     ConcurrentWorkflow not in r.characteristics) implies r.selectedFormalism = PRISM
    -- Data structure invariants -> Alloy
    (DataStructure in r.characteristics and
     RealTimeConstraint not in r.characteristics and
     ConcurrentWorkflow not in r.characteristics and
     ProbabilisticBehavior not in r.characteristics) implies r.selectedFormalism = Alloy
    -- Safety/liveness properties -> TLA+
    (SafetyInvariant in r.characteristics and
     RealTimeConstraint not in r.characteristics and
     ConcurrentWorkflow not in r.characteristics and
     ProbabilisticBehavior not in r.characteristics and
     DataStructure not in r.characteristics) implies r.selectedFormalism = TLAPlus
  }
}

-- Steps 3-6 integration: generation templates exist for each formalism
-- @requirement UPPAAL-04
sig GenerationTemplate {
  formalism: one Formalism,
  hasStepThree: one Bool,   -- requirement clustering
  hasStepFour: one Bool,    -- spec generation
  hasStepFive: one Bool,    -- checker execution
  hasStepSix: one Bool      -- registry update
}

abstract sig Bool {}
one sig True, False extends Bool {}

-- Every formalism has a complete generation template (steps 3-6)
-- @requirement UPPAAL-04
fact completeTemplates {
  all f: Formalism | some t: GenerationTemplate | t.formalism = f
  all t: GenerationTemplate {
    t.hasStepThree = True
    t.hasStepFour = True
    t.hasStepFive = True
    t.hasStepSix = True
  }
}

-- Real-time constraints always select UPPAAL
-- @requirement UPPAAL-04
assert realTimeSelectsUPPAAL {
  all r: Requirement |
    RealTimeConstraint in r.characteristics implies r.selectedFormalism = UPPAAL
}
check realTimeSelectsUPPAAL for 6

-- Concurrent workflows (non-realtime) always select Petri nets
-- @requirement UPPAAL-04
assert concurrentSelectsPetri {
  all r: Requirement |
    (ConcurrentWorkflow in r.characteristics and
     RealTimeConstraint not in r.characteristics)
    implies r.selectedFormalism = PetriNet
}
check concurrentSelectsPetri for 6

-- All formalisms have generation templates
-- @requirement UPPAAL-04
assert allFormalismsHaveTemplates {
  all f: Formalism | some t: GenerationTemplate | t.formalism = f
}
check allFormalismsHaveTemplates for 6

-- .planning/formal/alloy/formalism-selection.als
-- Models the close-formal-gaps formalism selection heuristics.
-- When requirements specify concurrent workflows, Petri nets are selected.
-- Source: core/workflows/close-formal-gaps.md, bin/requirement-map.cjs

module formalism_selection

-- Available formalisms
abstract sig Formalism {}
one sig TLAPlus, Alloy, PRISM, PetriNet extends Formalism {}

-- Requirement characteristics that drive formalism selection
abstract sig RequirementCharacteristic {}
one sig RealTimeConstraint, ConcurrentWorkflow, SafetyInvariant,
        DataStructure, ProbabilisticBehavior extends RequirementCharacteristic {}

-- A requirement to be formalized
sig Requirement {
  characteristics: set RequirementCharacteristic,
  selectedFormalism: one Formalism
}

-- Formalism selection heuristics (priority-ordered)
fact selectionHeuristics {
  all r: Requirement {
    -- Real-time constraints -> TLA+ (discrete step timing invariants)
    RealTimeConstraint in r.characteristics implies r.selectedFormalism = TLAPlus
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
fact completeTemplates {
  all f: Formalism | some t: GenerationTemplate | t.formalism = f
  all t: GenerationTemplate {
    t.hasStepThree = True
    t.hasStepFour = True
    t.hasStepFive = True
    t.hasStepSix = True
  }
}

-- Real-time constraints select TLA+
assert realTimeSelectsTLAPlus {
  all r: Requirement |
    RealTimeConstraint in r.characteristics implies r.selectedFormalism = TLAPlus
}
check realTimeSelectsTLAPlus for 6

-- Concurrent workflows (non-realtime) always select Petri nets
assert concurrentSelectsPetri {
  all r: Requirement |
    (ConcurrentWorkflow in r.characteristics and
     RealTimeConstraint not in r.characteristics)
    implies r.selectedFormalism = PetriNet
}
check concurrentSelectsPetri for 6

-- All formalisms have generation templates
assert allFormalismsHaveTemplates {
  all f: Formalism | some t: GenerationTemplate | t.formalism = f
}
check allFormalismsHaveTemplates for 6

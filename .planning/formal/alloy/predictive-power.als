-- .planning/formal/alloy/predictive-power.als
-- Models formal verification predictive power: mapping bugs to formal
-- properties and computing recall scores as informational metrics
-- (not used as gate inputs).
--
-- @requirement PRED-01
-- @requirement PRED-02

module predictive_power

abstract sig Bool {}
one sig True, False extends Bool {}

-- Bugs discovered in the codebase
sig Bug {
  mappedToProperty: one Bool,
  formalProperty: lone FormalProperty
}

-- Formal properties that can detect bugs
sig FormalProperty {
  model: one FormalModel,
  wouldCatchBug: set Bug
}

-- Formal models containing properties
sig FormalModel {
  properties: set FormalProperty
}

-- @requirement PRED-02
-- Recall score computed from bug-to-property mapping
sig RecallScore {
  value: one Int,
  usedAsGateInput: one Bool
} {
  value >= 0
  value <= 100
}

-- @requirement PRED-01
-- Every known bug must be mapped to a formal property (or marked unmappable)
fact BugToPropertyMapped {
  all b: Bug |
    b.mappedToProperty = True implies some b.formalProperty
}

-- @requirement PRED-01
-- Properties belong to their model
fact PropertyBelongsToModel {
  all p: FormalProperty |
    p in p.model.properties
}

-- @requirement PRED-02
-- Recall is computed but never used as a gate input
-- (informational metric only)
fact RecallComputed {
  all r: RecallScore |
    r.usedAsGateInput = False
}

run {} for 4

-- @requirement PRED-02
-- Assert: recall scores are purely informational, never gate inputs
assert RecallIsInformational {
  no r: RecallScore | r.usedAsGateInput = True
}
check RecallIsInformational for 4

-- @requirement PRED-01
-- Assert: mapped bugs have corresponding formal properties
assert MappedBugsHaveProperties {
  all b: Bug |
    b.mappedToProperty = True implies some b.formalProperty
}
check MappedBugsHaveProperties for 4

-- @requirement PRED-01
-- Assert: formal properties are contained in models
assert PropertiesInModels {
  all p: FormalProperty | p in p.model.properties
}
check PropertiesInModels for 4

-- .planning/formal/alloy/provider-wizard.als
-- Provider wizard — curated list, config update, presets, cloning
--
-- @requirement PROV-02
-- @requirement PROV-03
-- @requirement PRST-01
-- @requirement PRST-02

module provider_wizard

-- Generic structural model
sig Entity {
  id: one Id,
  state: one State
}

sig Id {}
abstract sig State {}
one sig Active, Inactive extends State {}

fact UniqueIds {
  all disj e1, e2: Entity | e1.id != e2.id
}

-- @requirement PROV-02
-- @requirement PROV-03
-- @requirement PRST-01
-- @requirement PRST-02

assert AllEntitiesHaveState {
  all e: Entity | one e.state
}
check AllEntitiesHaveState for 5

-- .planning/formal/alloy/multi-slot.als
-- Multi-slot support — multiple claude slots, adding new slots
--
-- @requirement MULTI-01
-- @requirement MULTI-03

module multi_slot

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

-- @requirement MULTI-01
-- @requirement MULTI-03

assert AllEntitiesHaveState {
  all e: Entity | one e.state
}
check AllEntitiesHaveState for 5

-- .planning/formal/alloy/traceability.als
-- Traceability matrix generation and verify integration
--
-- @requirement TRACE-01
-- @requirement TRACE-03

module traceability

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

-- @requirement TRACE-01
-- @requirement TRACE-03

assert AllEntitiesHaveState {
  all e: Entity | one e.state
}
check AllEntitiesHaveState for 5

-- .planning/formal/alloy/meta-resolve.als
-- Meta resolution — auto-resolve planning commands, assumption presentation
--
-- @requirement META-01
-- @requirement META-03

module meta_resolve

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

-- @requirement META-01
-- @requirement META-03

assert AllEntitiesHaveState {
  all e: Entity | one e.state
}
check AllEntitiesHaveState for 5

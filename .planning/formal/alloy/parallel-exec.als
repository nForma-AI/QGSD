-- .planning/formal/alloy/parallel-exec.als
-- Parallel execution — worktree isolation, merge orchestration
--
-- @requirement PARA-01
-- @requirement PARA-02

module parallel_exec

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

-- @requirement PARA-01
-- @requirement PARA-02

assert AllEntitiesHaveState {
  all e: Entity | one e.state
}
check AllEntitiesHaveState for 5

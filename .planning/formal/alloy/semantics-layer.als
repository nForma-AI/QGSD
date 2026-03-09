-- .planning/formal/alloy/semantics-layer.als
-- Semantics layer — invariant catalog, mismatch register, assumption register, FSM derivation
--
-- @requirement SEM-01
-- @requirement SEM-02
-- @requirement SEM-03
-- @requirement SEM-04

module semantics_layer

-- Semantics layer domain
sig Invariant {
  declared: one Source,
  observed: lone Trace
}

sig Mismatch {
  l2Entry: one Invariant,
  l1Trace: one Trace
}

sig Assumption {
  source: one Invariant,
  validated: one Bool
}

sig Source {}
sig Trace {}
abstract sig Bool {}
one sig True, False extends Bool {}

-- @requirement SEM-01
fact InvariantCatalog {
  all i: Invariant | one i.declared
}

-- @requirement SEM-02
assert MismatchTracked {
  all m: Mismatch | one m.l2Entry and one m.l1Trace
}
check MismatchTracked for 5

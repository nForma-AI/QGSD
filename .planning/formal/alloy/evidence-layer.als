-- .planning/formal/alloy/evidence-layer.als
-- Evidence layer — trace corpus, failure taxonomy, event vocabulary
--
-- @requirement EVID-02
-- @requirement EVID-03
-- @requirement EVID-05

module evidence_layer

-- Evidence layer domain
sig TraceEvent {
  session: one Session,
  actionType: one ActionType,
  vocabulary: lone VocabEntry
}

sig Session {}
sig ActionType {}
sig VocabEntry { canonical: one ActionType }

sig FailureEntry {
  category: one FailureCategory
}

abstract sig FailureCategory {}
one sig Crash, Timeout, Logic, Config, Infra extends FailureCategory {}

-- @requirement EVID-02
fact TraceIndexed {
  all t: TraceEvent | one t.session and one t.actionType
}

-- @requirement EVID-05
assert VocabComplete {
  all t: TraceEvent | some t.vocabulary
}
check VocabComplete for 5

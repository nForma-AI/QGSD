-- .planning/formal/alloy/diagnostics.als
-- Diagnostics — divergence rate, attribution, pivot decision
--
-- @requirement DIAG-01
-- @requirement DIAG-02
-- @requirement DIAG-03

module diagnostics

-- Diagnostics domain
sig Divergence {
  rate: one Rate,
  attribution: lone Attribution
}

abstract sig Rate {}
one sig Zero, Low, High extends Rate {}

sig Attribution {
  rootCause: one RootCause
}

abstract sig RootCause {}
one sig SpecBug, ImplBug, InstrBug extends RootCause {}

-- @requirement DIAG-01
fact DivergenceTracked {
  all d: Divergence | one d.rate
}

-- @requirement DIAG-02
assert AttributionComplete {
  all d: Divergence | d.rate != Zero => some d.attribution
}
check AttributionComplete for 5

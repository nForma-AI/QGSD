-- .planning/formal/alloy/fingerprinting.als
-- Issue fingerprinting — hierarchical strategy, drift detection, cross-source dedup
--
-- @requirement FP-01
-- @requirement FP-02
-- @requirement FP-03
-- @requirement FP-04

module fingerprinting

-- Fingerprinting domain
abstract sig FingerprintStrategy {}
one sig ExceptionType, FunctionName, MessageHash extends FingerprintStrategy {}

sig Issue {
  fingerprint: one Fingerprint,
  source: one Source
}

sig Fingerprint {
  strategy: one FingerprintStrategy,
  value: one Value
}

sig Source {}
sig Value {}

-- @requirement FP-01
fact HierarchicalStrategy {
  all i: Issue | one i.fingerprint
}

-- @requirement FP-03
fact NoDuplicateFingerprints {
  all disj i1, i2: Issue | i1.fingerprint.value = i2.fingerprint.value => i1 = i2
}

-- @requirement FP-04
assert MergePreservesSource {
  all i: Issue | one i.source
}
check MergePreservesSource for 5

assert UniqueFingerprint {
  all disj i1, i2: Issue | i1.fingerprint != i2.fingerprint
}
check UniqueFingerprint for 5

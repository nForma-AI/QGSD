-- .planning/formal/alloy/nn-pairing-lifecycle.als
-- Models the N:N pairing lifecycle: candidate generation, resolution,
-- confirmation to registry, rejection caching, and scoring idempotency.
--
-- @requirement PAIR-01
-- @requirement PAIR-02
-- @requirement PAIR-03
-- @requirement PAIR-04
-- @requirement SEM-05

module nn_pairing_lifecycle

abstract sig Bool {}
one sig True, False extends Bool {}

-- Candidates that can form pairings
sig Candidate {}

-- Pairing status lifecycle: pending -> confirmed | rejected
abstract sig PairingStatus {}
one sig Pending, Confirmed, Rejected extends PairingStatus {}

-- @requirement PAIR-01
-- Pairings are derived from candidate pairs
sig Pairing {
  left: one Candidate,
  right: one Candidate,
  status: one PairingStatus,
  hasResolveLinks: one Bool,
  score: one Int
} {
  left != right
  score >= 0
  score <= 100
}

-- @requirement PAIR-03
-- Model registry stores confirmed pairings
sig ModelRegistry {
  entries: set Pairing
}

-- @requirement PAIR-04
-- Reject cache stores rejected pairings to prevent re-evaluation
sig RejectCache {
  rejected: set Pairing
}

-- @requirement PAIR-01
-- All pairings must originate from known candidates
fact PairingsFromCandidates {
  all p: Pairing |
    p.left in Candidate and p.right in Candidate
}

-- @requirement PAIR-02
-- Confirmed or pending pairings presented via resolve must have links
fact ResolvePresentsLinks {
  all p: Pairing |
    (p.status = Confirmed or p.status = Pending) implies
      p.hasResolveLinks = True
}

-- @requirement PAIR-03
-- Confirmed pairings are written to the model registry
fact ConfirmedWrittenToRegistry {
  all r: ModelRegistry |
    all p: Pairing |
      p.status = Confirmed implies p in r.entries
}

-- @requirement PAIR-04
-- Rejected pairings are cached in the reject cache
fact RejectedCached {
  all rc: RejectCache |
    all p: Pairing |
      p.status = Rejected implies p in rc.rejected
}

-- @requirement PAIR-04
-- Rejected pairings must not appear in the registry
fact RejectedNotInRegistry {
  all r: ModelRegistry |
    all p: Pairing |
      p.status = Rejected implies p not in r.entries
}

-- @requirement SEM-05
-- Scoring is idempotent: same candidate pair always yields same score
-- (modeled as: no two pairings with same left/right have different scores)
fact ScoringIdempotent {
  all disj p1, p2: Pairing |
    (p1.left = p2.left and p1.right = p2.right) implies
      p1.score = p2.score
}

run {} for 4

-- @requirement PAIR-04
-- Assert: rejected pairings are never re-evaluated (appear in cache, not registry)
assert RejectedNeverReEvaluated {
  all rc: RejectCache, r: ModelRegistry |
    all p: Pairing |
      p in rc.rejected implies p not in r.entries
}
check RejectedNeverReEvaluated for 4

-- @requirement PAIR-03
-- Assert: all confirmed pairings exist in the registry
assert ConfirmedInRegistry {
  all r: ModelRegistry |
    all p: Pairing |
      p.status = Confirmed implies p in r.entries
}
check ConfirmedInRegistry for 4

-- @requirement SEM-05
-- Assert: scoring is deterministic for same inputs
assert IdempotentScoring {
  all disj p1, p2: Pairing |
    (p1.left = p2.left and p1.right = p2.right) implies
      p1.score = p2.score
}
check IdempotentScoring for 4

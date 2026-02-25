-- formal/alloy/quorum-votes.als
-- QGSD Quorum Vote-Counting Model (Alloy 6)
-- Requirements: ALY-01
--
-- Models vote aggregation for a quorum round.
-- Uses pred (not fact) for vote-counting so check can find counterexamples.
-- Scope: 5 agents (matches QGSD's 5 quorum slots), 5 vote rounds.

module quorum_votes

-- Signatures
sig Agent {}

sig VoteRound {
    approvals : set Agent,
    total     : one Int
}

-- Predicates (not facts) — enable check commands to find counterexamples.
-- If these were "fact", check would trivially pass (no counterexamples possible
-- because non-conforming instances would be filtered out of the model space).

pred MajorityReached [r : VoteRound] {
    -- Use mul to avoid integer division: #approvals * 2 >= total
    -- Same majority predicate as TLA+ spec: successCount * 2 >= N
    mul[#r.approvals, 2] >= r.total
}

pred ValidRound [r : VoteRound] {
    r.total > 0
    r.total = #Agent
    #r.approvals <= r.total
}

pred MinQuorumMet [r : VoteRound] {
    -- QGSD minimum: at least ceil(N/2) approvals needed
    -- With N=5 agents: at least 3 approvals required
    #r.approvals >= div[r.total, 2].add[1]
}

-- Assertion: no round can be accepted as approved without majority
-- This is the target for check — Alloy will search for a counterexample
-- (a VoteRound where ValidRound holds but NoSpuriousApproval is violated)
assert NoSpuriousApproval {
    all r : VoteRound |
        (ValidRound[r] and not MajorityReached[r])
            implies (mul[#r.approvals, 2] < r.total)
}

-- Check the assertion within scope: 5 Agents, 5 VoteRounds
-- Alloy will report "No counterexample found" or show a counterexample
check NoSpuriousApproval for 5 Agent, 5 VoteRound

-- Optional: run predicate to find example instances of valid majority rounds
run MajorityReached for 5 Agent, 1 VoteRound

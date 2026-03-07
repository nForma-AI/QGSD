-- .planning/formal/alloy/wiring-awareness.als
-- Models the planner wiring-awareness and verifier orphan-check invariants.
-- Source: commands/nf/execute-plan.md, planner/verifier agent prompts
--
-- @requirement VERIFY-05

module wiring_awareness

abstract sig Bool {}
one sig True, False extends Bool {}

-- Plan artifacts created by a planner task
sig PlanArtifact {
  hasWiringTask: one Bool,
  hasConsumer: one Bool,
  flaggedAsOrphan: one Bool
}

-- VERIFY-05: Planner includes wiring tasks for new artifacts
-- @requirement VERIFY-05
fact PlannerWiringAwareness {
  -- Every artifact that has a consumer must have a wiring task
  all a: PlanArtifact |
    a.hasConsumer = True implies a.hasWiringTask = True
}

-- VERIFY-05: Verifier flags artifacts with no consumer as orphans
-- @requirement VERIFY-05
fact VerifierOrphanCheck {
  all a: PlanArtifact |
    a.flaggedAsOrphan = True iff a.hasConsumer = False
}

-- VERIFY-05: An artifact with a consumer is never flagged as orphan
-- @requirement VERIFY-05
assert ConsumerPreventsOrphanFlag {
  all a: PlanArtifact |
    a.hasConsumer = True implies a.flaggedAsOrphan = False
}

-- VERIFY-05: All artifacts without consumers are flagged
-- @requirement VERIFY-05
assert AllOrphansDetected {
  all a: PlanArtifact |
    a.hasConsumer = False implies a.flaggedAsOrphan = True
}

check ConsumerPreventsOrphanFlag for 6
check AllOrphansDetected for 6

-- .planning/formal/alloy/root-cause-quorum.als
-- Models the quorum vote on root cause diagnosis in solve-diagnose.
-- Source: commands/nf/solve-diagnose.md (Step 0e)
--
-- @requirement ROOT-02

module root_cause_quorum

abstract sig Bool {}
one sig True, False extends Bool {}

-- Diagnostic phases
abstract sig DiagnosticPhase {}
one sig HypothesisSynthesis, QuorumVote, Remediation extends DiagnosticPhase {}

-- Root cause diagnosis
sig RootCauseDiagnosis {
  synthesized: one Bool,
  quorumApproved: one Bool,
  phase: one DiagnosticPhase
}

-- Quorum vote on diagnosis
sig DiagnosisQuorumVote {
  diagnosis: one RootCauseDiagnosis,
  voterCount: one Int,
  approved: one Bool
}

-- ROOT-02: After hypothesis synthesis, quorum vote is dispatched
-- @requirement ROOT-02
fact QuorumAfterSynthesis {
  all rcd: RootCauseDiagnosis |
    rcd.synthesized = True implies
      some qv: DiagnosisQuorumVote | qv.diagnosis = rcd
}

fact QuorumApprovalGates {
  all rcd: RootCauseDiagnosis |
    rcd.quorumApproved = True implies
      (some qv: DiagnosisQuorumVote | qv.diagnosis = rcd and qv.approved = True)
}

fact OnlyApprovedProceed {
  all rcd: RootCauseDiagnosis |
    rcd.phase = Remediation implies rcd.quorumApproved = True
}

-- Assertions
assert SynthesisTriggersQuorum {
  all rcd: RootCauseDiagnosis |
    rcd.synthesized = True implies
      some qv: DiagnosisQuorumVote | qv.diagnosis = rcd
}

assert RemediationRequiresApproval {
  all rcd: RootCauseDiagnosis |
    rcd.phase = Remediation implies rcd.quorumApproved = True
}

check SynthesisTriggersQuorum for 5
check RemediationRequiresApproval for 5

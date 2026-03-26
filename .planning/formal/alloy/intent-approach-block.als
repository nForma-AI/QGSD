-- .planning/formal/alloy/intent-approach-block.als
-- Models the APPROACH block derivation and persistence for quick tasks.
-- Source: commands/nf/quick.md, .claude/scope-contract.json
--
-- @requirement INTENT-01
-- @requirement INTENT-02
-- @requirement INTENT-03

module intent_approach_block

abstract sig Bool {}
one sig True, False extends Bool {}

-- Quick task lifecycle
sig QuickTask {
  description: one TaskDescription,
  approach: lone ApproachBlock,
  branchName: one BranchName
}

sig TaskDescription {}
sig BranchName {}

-- APPROACH block structure
sig ApproachBlock {
  whatWillBeDone: one Description,
  whatIsExcluded: one Description,
  derivedFrom: one TaskDescription,
  userPrompted: one Bool  -- must always be False per INTENT-03
}

sig Description {}

-- Scope contract persistence
sig ScopeContract {
  key: one BranchName,
  approach: one ApproachBlock
}

-- INTENT-01: Quick task derives APPROACH block automatically
-- @requirement INTENT-01
fact ApproachDerived {
  all t: QuickTask | some t.approach
  all t: QuickTask | t.approach.derivedFrom = t.description
}

-- INTENT-02: APPROACH written to scope-contract.json keyed by branch name
-- @requirement INTENT-02
fact ApproachPersisted {
  all t: QuickTask |
    some sc: ScopeContract |
      sc.key = t.branchName and sc.approach = t.approach
}

-- INTENT-03: APPROACH is non-modal (automatic, not via user dialog)
-- @requirement INTENT-03
fact ApproachNonModal {
  all ab: ApproachBlock | ab.userPrompted = False
}

-- Assertions
assert AllTasksHaveApproach {
  all t: QuickTask | some t.approach
}

assert ApproachAlwaysPersisted {
  all t: QuickTask |
    some sc: ScopeContract | sc.key = t.branchName
}

assert NeverUserPrompted {
  no ab: ApproachBlock | ab.userPrompted = True
}

check AllTasksHaveApproach for 5
check ApproachAlwaysPersisted for 5
check NeverUserPrompted for 5

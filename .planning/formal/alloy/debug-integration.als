-- .planning/formal/alloy/debug-integration.als
-- Models debug skill formal model consultation and quorum dispatch integration.
-- Source: commands/nf/debug.md, bin/quorum-slot-dispatch.cjs
--
-- @requirement DBG-01
-- @requirement DBG-02
-- @requirement DBG-03
-- @requirement DBG-04

module debug_integration

abstract sig Bool {}
one sig True, False extends Bool {}

sig FormalModel {
  covers: set FailureMode
}

sig FailureMode {}

sig DebugStep {
  phase: DebugPhase,
  formalContext: lone FormalContext
}

abstract sig DebugPhase {}
one sig StepA5, StepG extends DebugPhase {}

sig FormalContext {
  models: set FormalModel,
  verdicts: FormalModel -> Verdict
}

abstract sig Verdict {}
one sig Reproduced, NotReproduced, NoModel extends Verdict {}

sig WorkerBundle {
  formalContext: lone FormalContext,
  invariantRules: set InvariantRule
}

sig InvariantRule {
  constraintDesc: lone ConstraintText
}

sig ConstraintText {}

sig BugModelGapEntry {
  failureMode: lone FailureMode,
  noModelCovers: Bool
}

sig ResultTable {
  formalRow: lone FormalRow
}

sig FormalRow {
  verdict: Verdict
}

-- @requirement DBG-01
-- Step A5 runs formal model consultation before quorum dispatch
fact StepA5FormalConsultation {
  all ds: DebugStep |
    ds.phase = StepA5 implies some ds.formalContext
}

-- @requirement DBG-01
-- Formal context is appended to worker bundle
fact FormalContextInBundle {
  all ds: DebugStep |
    (ds.phase = StepA5 and some ds.formalContext) implies
      some wb: WorkerBundle | wb.formalContext = ds.formalContext
}

-- @requirement DBG-02
-- Worker prompts include invariant rules
fact WorkerIncludesInvariantRules {
  all wb: WorkerBundle | some wb.invariantRules
}

-- @requirement DBG-03
-- Result table has a FORMAL row with model verdict
fact ResultTableHasFormalRow {
  all rt: ResultTable |
    some rt.formalRow and
    rt.formalRow.verdict in (Reproduced + NotReproduced + NoModel)
}

-- @requirement DBG-04
-- When no model covers failure, gap is logged
fact NoModelGapLogged {
  all ds: DebugStep |
    (ds.phase = StepG and some ds.formalContext and
     all fm: FormalModel | no (fm & ds.formalContext.models))
    implies some bme: BugModelGapEntry | bme.noModelCovers = True
}

run {} for 5

-- @requirement DBG-01
assert StepA5AlwaysHasFormalContext {
  all ds: DebugStep | ds.phase = StepA5 implies some ds.formalContext
}
check StepA5AlwaysHasFormalContext for 5

-- @requirement DBG-02
assert WorkerBundleHasInvariantRules {
  all wb: WorkerBundle | some wb.invariantRules
}
check WorkerBundleHasInvariantRules for 5

-- @requirement DBG-03
assert ResultTableFormalVerdictValid {
  all rt: ResultTable |
    some rt.formalRow and
    rt.formalRow.verdict in (Reproduced + NotReproduced + NoModel)
}
check ResultTableFormalVerdictValid for 5

-- @requirement DBG-04
assert NoModelImpliesGapEntry {
  all ds: DebugStep |
    (ds.phase = StepG and some ds.formalContext and
     no ds.formalContext.models)
    implies some BugModelGapEntry
}
check NoModelImpliesGapEntry for 5

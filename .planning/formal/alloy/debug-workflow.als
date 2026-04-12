-- .planning/formal/alloy/debug-workflow.als
-- Models the debug skill's model-driven-fix workflow phases.
-- Source: commands/nf/debug.md, bin/autoresearch-refine.cjs
--
-- @requirement DBUG-01
-- @requirement DBUG-02
-- @requirement DBUG-03
-- @requirement DBUG-04

module debug_workflow

abstract sig Bool {}
one sig True, False extends Bool {}

abstract sig MDFPhase {}
one sig Discovery, Reproduction, Refinement, ConstraintExtraction extends MDFPhase {}

sig DebugSession {
  phases: set MDFPhase,
  loopRuns: set AutoResearchLoop,
  constraintsExtracted: set ExtractedConstraint,
  reproducingModel: lone FormalModel
}

sig AutoResearchLoop {
  iteration: Int,
  reproducesBug: Bool,
  refinements: set ModelRefinement
}

sig ModelRefinement {
  target: lone FormalModel,
  succeeded: Bool
}

sig FormalModel {}

sig ExtractedConstraint {
  feedsBackToFixGuidance: Bool,
  feedsBackToQuorumPrompt: Bool
}

sig FixGuidance {}
sig QuorumPrompt {}

-- @requirement DBUG-01
-- Debug absorbs MDF phases 1-4
fact DebugAbsorbsMDFPhases {
  all ds: DebugSession |
    Discovery + Reproduction + Refinement + ConstraintExtraction in ds.phases
}

-- @requirement DBUG-02
-- AutoResearch Loop 1 runs natively within debug flow
fact Loop1RunsNatively {
  all ds: DebugSession | some ds.loopRuns
}

-- @requirement DBUG-02
-- Loop is for bug reproduction
fact LoopForReproduction {
  all arl: AutoResearchLoop | arl.reproducesBug = True or arl.reproducesBug = False
}

-- @requirement DBUG-03
-- Extracted constraints feed back into fix guidance and quorum prompts
fact ConstraintsFeedBack {
  all ds: DebugSession, ec: ds.constraintsExtracted |
    ec.feedsBackToFixGuidance = True and ec.feedsBackToQuorumPrompt = True
}

-- @requirement DBUG-04
-- Debug produces a reproducing formal model as deliverable
fact ProducesReproducingModel {
  all ds: DebugSession |
    some ds.reproducingModel
}

run {} for 5

-- @requirement DBUG-01
assert DebugHasAllMDFPhases {
  all ds: DebugSession |
    Discovery in ds.phases and
    Reproduction in ds.phases and
    Refinement in ds.phases and
    ConstraintExtraction in ds.phases
}
check DebugHasAllMDFPhases for 5

-- @requirement DBUG-02
assert DebugSessionHasAutoResearchLoop {
  all ds: DebugSession | some ds.loopRuns
}
check DebugSessionHasAutoResearchLoop for 5

-- @requirement DBUG-03
assert ConstraintsFeedBackToGuidance {
  all ds: DebugSession, ec: ds.constraintsExtracted |
    ec.feedsBackToFixGuidance = True
}
check ConstraintsFeedBackToGuidance for 5

-- @requirement DBUG-03
assert ConstraintsFeedBackToQuorum {
  all ds: DebugSession, ec: ds.constraintsExtracted |
    ec.feedsBackToQuorumPrompt = True
}
check ConstraintsFeedBackToQuorum for 5

-- @requirement DBUG-04
assert DebugProducesReproducingModel {
  all ds: DebugSession | some ds.reproducingModel
}
check DebugProducesReproducingModel for 5

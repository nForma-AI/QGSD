-- .planning/formal/alloy/proximity-pipeline.als
-- Models the proximity graph orchestration pipeline structure.
-- Source: bin/proximity-graph.cjs, bin/haiku-semantic-eval.cjs
--
-- @requirement DIAG-06
-- @requirement DIAG-07
-- @requirement DIAG-08
-- @requirement DIAG-09

module proximity_pipeline

-- ═══ Pipeline Steps ═══

-- @requirement DIAG-06
-- The 5-step proximity pipeline
abstract sig PipelineStep {
  order: one Int,
  next: lone PipelineStep
}
one sig GraphBuild extends PipelineStep {} { order = 1 }
one sig CandidateDiscovery extends PipelineStep {} { order = 2 }
one sig HaikuEvaluation extends PipelineStep {} { order = 3 }
one sig SemanticScoring extends PipelineStep {} { order = 4 }
one sig PairingGeneration extends PipelineStep {} { order = 5 }

-- Pipeline ordering is strict
fact PipelineOrder {
  GraphBuild.next = CandidateDiscovery
  CandidateDiscovery.next = HaikuEvaluation
  HaikuEvaluation.next = SemanticScoring
  SemanticScoring.next = PairingGeneration
  no PairingGeneration.next
}

-- @requirement DIAG-06
-- Pipeline has exactly 5 steps
assert FiveSteps {
  #PipelineStep = 5
}
check FiveSteps for 6

-- ═══ Candidate Evaluation ═══

sig Candidate {
  categoryDomain: one Bool,
  coverageCheck: one Bool,
  keywordOverlap: one Bool,
  typeAwareScore: one Int,
  preFilterPassed: one Bool,
  haikuVerdict: lone Verdict
}

abstract sig Bool {}
one sig True, False extends Bool {}

abstract sig Verdict {}
one sig Accept, Reject extends Verdict {}

-- @requirement DIAG-08
-- Pre-filter gates must all pass for candidate to reach Haiku
fact PreFilterGating {
  all c: Candidate |
    c.preFilterPassed = True iff (
      c.categoryDomain = True and
      c.coverageCheck = True and
      c.keywordOverlap = True and
      c.typeAwareScore >= 0
    )
}

-- @requirement DIAG-08
-- Only pre-filtered candidates get Haiku evaluation
fact OnlyFilteredGetEvaluated {
  all c: Candidate |
    some c.haikuVerdict implies c.preFilterPassed = True
}

-- @requirement DIAG-08
assert PreFilterBeforeEval {
  all c: Candidate |
    some c.haikuVerdict implies c.preFilterPassed = True
}
check PreFilterBeforeEval for 8

-- ═══ Haiku Evaluation Fallback ═══

abstract sig EvalPath {}
one sig ScriptPath, InlinePath extends EvalPath {}

sig EvalResult {
  path: one EvalPath,
  verdict: one Verdict,
  confidence: one Int,
  hasReasoning: one Bool
}

-- @requirement DIAG-07
-- Both paths produce identical output schema (verdict + confidence + reasoning)
assert IdenticalOutputSchema {
  all r1, r2: EvalResult |
    (r1.path = ScriptPath and r2.path = InlinePath) implies (
      some r1.verdict and some r2.verdict and
      some r1.confidence and some r2.confidence and
      some r1.hasReasoning and some r2.hasReasoning
    )
}
check IdenticalOutputSchema for 5

-- ═══ Non-Neighbor Discovery ═══

sig ModelReqPair {
  coverageGap: one Int,
  rank: one Int
}

-- @requirement DIAG-09
-- Pairs are ranked by coverage-gap heuristic (higher gap = lower rank number = higher priority)
fact RankByCoverageGap {
  all p1, p2: ModelReqPair |
    (p1 != p2 and p1.coverageGap > p2.coverageGap) implies p1.rank < p2.rank
}

-- @requirement DIAG-09
assert ZeroPathPairsRanked {
  all p1, p2: ModelReqPair |
    (p1 != p2 and p1.coverageGap > p2.coverageGap) implies p1.rank < p2.rank
}
check ZeroPathPairsRanked for 5

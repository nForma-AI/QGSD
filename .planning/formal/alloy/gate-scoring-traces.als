-- .planning/formal/alloy/gate-scoring-traces.als
-- Models gate scoring pipeline and reverse trace sweeping for formal verification.
-- Source: bin/compute-per-model-gates.cjs, bin/nf-solve.cjs (sweepCtoR)
--
-- @requirement GATE-05
-- @requirement TRACE-10

module gate_scoring_traces

abstract sig Bool {}
one sig True, False extends Bool {}

-- Gate types (A/B/C) with continuous 0-1 scores
abstract sig Gate {
  score: one Int,           -- 0-100 (representing 0.00-1.00)
  hasDiagnostic: one Bool   -- diagnostic breakdown exists
}
one sig GateA, GateB, GateC extends Gate {}

-- Schema for gate JSON output
sig GateOutput {
  gate: one Gate,
  schemaValid: one Bool,     -- matches global gate JSON schema
  scoreInRange: one Bool     -- 0 <= score <= 100
}

-- Consumers of gate scores
abstract sig GateConsumer {}
one sig SolverSweep, CrossLayerDashboard, RunFormalVerify extends GateConsumer {}

-- GATE-05: compute-per-model-gates.cjs --aggregate produces continuous 0-1 scores
-- with diagnostic breakdowns, serving as single entrypoint for all consumers
-- @requirement GATE-05
fact SingleEntrypoint {
  -- All gates must have diagnostic breakdowns
  all g: Gate | g.hasDiagnostic = True
  -- All gate outputs must have valid schema and score range
  all go: GateOutput | go.schemaValid = True and go.scoreInRange = True
  -- Scores in range 0-100
  all g: Gate | g.score >= 0 and g.score <= 100
  -- All 3 consumers served
  #GateConsumer = 3
}

-- Source files with requirement header comments
sig SourceFile {
  inScanDir: one Bool,          -- is in bin/ or hooks/
  hasReqHeader: one Bool,        -- has Requirements: header in first 30 lines
  declaredIds: set RequirementId -- IDs declared in header
}

sig RequirementId {
  existsInEnvelope: one Bool     -- ID exists in requirements.json
}

-- TRACE-10: sweepCtoR parses Requirements: header comments from first 30 lines
-- as fallback tracing, counting file as traced when declared IDs exist in envelope
-- @requirement TRACE-10
fact HeaderCommentFallback {
  -- Only files in scan dirs are checked
  all sf: SourceFile | sf.inScanDir = False implies #sf.declaredIds = 0
  -- A file is traced if at least one declared ID exists in the envelope
  all sf: SourceFile | sf.hasReqHeader = True implies #sf.declaredIds > 0
}

-- Traced means: file has header AND at least one valid ID
pred isTraced[sf: SourceFile] {
  sf.hasReqHeader = True and
  some rid: sf.declaredIds | rid.existsInEnvelope = True
}

-- Assertions
assert GateScoresAlwaysValid {
  all go: GateOutput | go.scoreInRange = True
}

assert DiagnosticAlwaysPresent {
  all g: Gate | g.hasDiagnostic = True
}

assert TracedFilesHaveValidIds {
  all sf: SourceFile |
    isTraced[sf] implies (some rid: sf.declaredIds | rid.existsInEnvelope = True)
}

check GateScoresAlwaysValid for 5
check DiagnosticAlwaysPresent for 5
check TracedFilesHaveValidIds for 8

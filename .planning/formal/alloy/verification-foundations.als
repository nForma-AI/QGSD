-- .planning/formal/alloy/verification-foundations.als
-- Models verification mode tagging, trace comparison, and iteration limits.
-- Source: bin/run-formal-verify.cjs, bin/refinement-loop.cjs
--
-- @requirement FND-01
-- @requirement FND-02
-- @requirement FND-03

module verification_foundations

abstract sig Bool {}
one sig True, False extends Bool {}

-- Verification modes
abstract sig VerificationMode {}
one sig Diagnostic, Validation extends VerificationMode {}

-- Model checker invocations
sig CheckerInvocation {
  mode: one VerificationMode,
  tagged: one Bool
}

-- FND-01: Every invocation is tagged as diagnostic or validation
-- @requirement FND-01
fact AllInvocationsTagged {
  all inv: CheckerInvocation | inv.tagged = True
  all inv: CheckerInvocation | inv.mode in (Diagnostic + Validation)
}

-- Trace comparison structure (ITF format)
sig TraceState {
  stepIndex: one Int,
  variables: set Variable
}

sig Variable {
  name: one Name,
  value: one Value
}

sig Name, Value {}

sig TraceComparison {
  expected: set TraceState,
  actual: set TraceState,
  divergencePoint: lone Int
}

-- FND-02: Traces parsed into structured JSON with state-by-state comparison
-- @requirement FND-02
fact TracesHaveStructure {
  all tc: TraceComparison |
    (#tc.expected > 0 and #tc.actual > 0) implies
      (some tc.divergencePoint or tc.expected = tc.actual)
}

-- Iteration configuration
sig IterationConfig {
  maxIterations: one Int,
  diagnosticIterations: one Int,
  simulationIterations: one Int
}

-- FND-03: --max-iterations flag with default 3 controls both cycles
-- @requirement FND-03
fact DefaultIterationLimit {
  all cfg: IterationConfig |
    cfg.maxIterations >= 1 and
    cfg.diagnosticIterations <= cfg.maxIterations and
    cfg.simulationIterations <= cfg.maxIterations
}

-- Assertions
assert AllInvocationsHaveMode {
  all inv: CheckerInvocation | inv.mode in (Diagnostic + Validation)
}

assert TraceDivergenceDetected {
  all tc: TraceComparison |
    tc.expected != tc.actual implies some tc.divergencePoint
}

assert IterationBound {
  all cfg: IterationConfig |
    cfg.diagnosticIterations <= cfg.maxIterations
}

check AllInvocationsHaveMode for 5
check TraceDivergenceDetected for 5
check IterationBound for 5

-- .planning/formal/alloy/ci-quality-gates.als
-- Models CI quality gates: linting/formatting and type checking must pass
-- before merge is allowed.
-- Source: .github/workflows/
--
-- @requirement CI-05
-- @requirement CI-06

module ci_quality_gates

abstract sig GateStatus {}
one sig Pass, Fail extends GateStatus {}

abstract sig Bool {}
one sig True, False extends Bool {}

-- @requirement CI-05
-- Linting and formatting checks run in CI and block merge on violations
one sig LintFormatGate {
  lintResult: one GateStatus,
  formatResult: one GateStatus,
  blocksOnViolation: one Bool
} {
  (lintResult = Fail or formatResult = Fail) implies blocksOnViolation = True
  (lintResult = Pass and formatResult = Pass) implies blocksOnViolation = False
}

-- @requirement CI-06
-- Type checking runs in CI and blocks merge on type errors
one sig TypeCheckGate {
  typeCheckResult: one GateStatus,
  blocksOnError: one Bool
} {
  typeCheckResult = Fail implies blocksOnError = True
  typeCheckResult = Pass implies blocksOnError = False
}

one sig Pipeline {
  mergeAllowed: one Bool
}

-- Merge is blocked unless all quality gates pass
-- @requirement CI-05
-- @requirement CI-06
fact MergeRequiresQualityGates {
  Pipeline.mergeAllowed = True iff
    (LintFormatGate.blocksOnViolation = False and TypeCheckGate.blocksOnError = False)
}

run {} for 3

-- @requirement CI-05
assert LintViolationBlocksMerge {
  LintFormatGate.lintResult = Fail implies Pipeline.mergeAllowed = False
}
check LintViolationBlocksMerge for 3

-- @requirement CI-05
assert FormatViolationBlocksMerge {
  LintFormatGate.formatResult = Fail implies Pipeline.mergeAllowed = False
}
check FormatViolationBlocksMerge for 3

-- @requirement CI-06
assert TypeErrorBlocksMerge {
  TypeCheckGate.typeCheckResult = Fail implies Pipeline.mergeAllowed = False
}
check TypeErrorBlocksMerge for 3

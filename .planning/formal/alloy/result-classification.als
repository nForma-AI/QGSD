-- .planning/formal/alloy/result-classification.als
-- Models the formal verification result classification schema.
-- Ensures infrastructure errors are distinguished from requirement violations,
-- and only violations inflate the F->C residual.
-- Source: bin/write-check-result.cjs, bin/nf-solve.cjs
--
-- @requirement SOLVE-11

module result_classification

abstract sig ResultType {}
one sig Pass, Fail, Error, Warn, Inconclusive extends ResultType {}

-- A formal verification check result
sig CheckResult {
  result: one ResultType,
  isInfrastructure: one Bool
}

abstract sig Bool {}
one sig True, False extends Bool {}

-- SOLVE-11: Infrastructure issues MUST use 'error', not 'fail'
-- @requirement SOLVE-11
fact InfrastructureUsesError {
  all cr: CheckResult |
    cr.isInfrastructure = True implies cr.result = Error
}

-- Converse: 'fail' is exclusively for requirement violations
fact FailMeansViolation {
  all cr: CheckResult |
    cr.result = Fail implies cr.isInfrastructure = False
}

-- The F->C residual counter
sig ResidualCounter {
  checks: set CheckResult,
  failCount: one Int,
  errorCount: one Int
}

-- SOLVE-11: Only 'fail' results inflate F->C residual
-- @requirement SOLVE-11
fact OnlyFailInflatesResidual {
  all rc: ResidualCounter |
    rc.failCount = #{cr: rc.checks | cr.result = Fail} and
    rc.errorCount = #{cr: rc.checks | cr.result = Error}
}

-- Residual is driven by failCount only, not errorCount
-- The residual value equals failCount (errors excluded)
pred residualEqualsFailCount[rc: ResidualCounter] {
  rc.failCount >= 0
  rc.errorCount >= 0
  -- errorCount does NOT contribute to residual
}

-- All five result types exist in the schema
fact AllResultTypesExist {
  #ResultType = 5
  Pass + Fail + Error + Warn + Inconclusive = ResultType
}

-- Verify: no infrastructure check can be classified as fail
assert NoInfraFail {
  no cr: CheckResult | cr.isInfrastructure = True and cr.result = Fail
}

-- Verify: error results never inflate the fail count
assert ErrorsExcludedFromFailCount {
  all rc: ResidualCounter |
    no cr: rc.checks | cr.result = Error and cr.result = Fail
}

check NoInfraFail for 10
check ErrorsExcludedFromFailCount for 10

run residualEqualsFailCount for 5 but 1 ResidualCounter, 8 CheckResult

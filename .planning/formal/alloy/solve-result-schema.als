-- .planning/formal/alloy/solve-result-schema.als
-- Models the solver result classification schema and stub upgrade behavior.
-- Source: bin/nf-solve.cjs, bin/formal-test-sync.cjs
--
-- @requirement SOLVE-11
-- @requirement SOLVE-12

module solve_result_schema

abstract sig Bool {}
one sig True, False extends Bool {}

-- SOLVE-11: Result classification distinguishes infrastructure vs requirement violations
-- @requirement SOLVE-11

abstract sig CheckResult {}

abstract sig ResultCategory {}
one sig InfrastructureError, RequirementViolation, Inconclusive, Pass extends ResultCategory {}

sig FormalCheck {
  result: one ResultCategory,
  hasBinaryPath: one Bool,
  hasModelFile: one Bool,
  hasJavaVersion: one Bool,
  isRequirementFailure: one Bool
}

-- Infrastructure errors: binary not found, model missing, Java wrong
-- @requirement SOLVE-11
fact InfraErrorClassification {
  all c: FormalCheck |
    c.result = InfrastructureError iff
      (c.hasBinaryPath = False or c.hasModelFile = False or c.hasJavaVersion = False)
}

-- Requirement violations: infrastructure is fine but property fails
-- @requirement SOLVE-11
fact RequirementViolationClassification {
  all c: FormalCheck |
    c.result = RequirementViolation iff
      (c.hasBinaryPath = True and c.hasModelFile = True and c.hasJavaVersion = True
       and c.isRequirementFailure = True)
}

-- Pass: all infrastructure present and no failure
-- @requirement SOLVE-11
fact PassClassification {
  all c: FormalCheck |
    c.result = Pass iff
      (c.hasBinaryPath = True and c.hasModelFile = True and c.hasJavaVersion = True
       and c.isRequirementFailure = False)
}

-- SOLVE-11: Categories are mutually exclusive and exhaustive
-- @requirement SOLVE-11
assert CategoriesMutuallyExclusive {
  all c: FormalCheck |
    (c.result = InfrastructureError and c.result != RequirementViolation and c.result != Pass) or
    (c.result = RequirementViolation and c.result != InfrastructureError and c.result != Pass) or
    (c.result = Pass and c.result != InfrastructureError and c.result != RequirementViolation) or
    c.result = Inconclusive
}

-- SOLVE-12: Stub upgrade behavior
-- @requirement SOLVE-12

sig TestStub {
  hasTodo: one Bool,
  hasRecipe: one Bool,
  upgraded: one Bool
}

-- SOLVE-12: Stubs with recipe metadata can be upgraded
-- @requirement SOLVE-12
fact StubUpgradeWithRecipe {
  all s: TestStub |
    s.upgraded = True iff (s.hasTodo = True and s.hasRecipe = True)
}

-- SOLVE-12: Stubs without recipe remain TODO
-- @requirement SOLVE-12
fact StubWithoutRecipeStaysTodo {
  all s: TestStub |
    (s.hasTodo = True and s.hasRecipe = False) implies s.upgraded = False
}

-- SOLVE-12: Non-TODO stubs are not candidates for upgrade
-- @requirement SOLVE-12
assert NonTodoNotUpgraded {
  all s: TestStub |
    s.hasTodo = False implies s.upgraded = False
}

check CategoriesMutuallyExclusive for 5
check NonTodoNotUpgraded for 5

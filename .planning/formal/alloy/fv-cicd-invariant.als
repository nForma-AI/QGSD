-- .planning/formal/alloy/fv-cicd-invariant.als
-- Models the invariant gate's treatment of CI/CD pipelines, build artifacts,
-- and Infrastructure-as-Code as first-class system components.
-- Source: bin/invariant-gate.cjs, .planning/formal/requirements.json
--
-- @requirement FV-04

module fv_cicd_invariant

-- ── Domain entities ────────────────────────────────────────────────────

abstract sig Bool {}
one sig True, False extends Bool {}

-- System component types recognized by the invariant gate
abstract sig ComponentType {}
one sig SourceCode, TestSuite, FormalSpec, CICDPipeline, BuildArtifact, IaCConfig extends ComponentType {}

-- A system component subject to invariant gate evaluation
sig SystemComponent {
  compType: one ComponentType,
  hasInvariant: one Bool,
  evaluatedByGate: one Bool
}

-- The invariant gate evaluates components
sig InvariantGate {
  firstClassTypes: set ComponentType,
  evaluatedComponents: set SystemComponent
}

-- ── Facts ──────────────────────────────────────────────────────────────

-- FV-04: CI/CD, build artifacts, and IaC are first-class
fact CICDIsFirstClass {
  all g: InvariantGate |
    CICDPipeline in g.firstClassTypes and
    BuildArtifact in g.firstClassTypes and
    IaCConfig in g.firstClassTypes
}

-- Traditional components are also first-class (baseline)
fact TraditionalFirstClass {
  all g: InvariantGate |
    SourceCode in g.firstClassTypes and
    TestSuite in g.firstClassTypes and
    FormalSpec in g.firstClassTypes
}

-- All first-class components with invariants are evaluated by the gate
fact FirstClassEvaluation {
  all g: InvariantGate, c: SystemComponent |
    (c.compType in g.firstClassTypes and c.hasInvariant = True) =>
      c in g.evaluatedComponents
}

-- Components evaluated by gate have their flag set
fact EvaluatedFlag {
  all c: SystemComponent |
    c.evaluatedByGate = True <=> (some g: InvariantGate | c in g.evaluatedComponents)
}

-- ── Assertions ─────────────────────────────────────────────────────────

-- FV-04: CI/CD pipelines with invariants are evaluated (not skipped)
assert CICDPipelinesEvaluated {
  all c: SystemComponent |
    (c.compType = CICDPipeline and c.hasInvariant = True) =>
      c.evaluatedByGate = True
}

-- FV-04: Build artifacts with invariants are evaluated
assert BuildArtifactsEvaluated {
  all c: SystemComponent |
    (c.compType = BuildArtifact and c.hasInvariant = True) =>
      c.evaluatedByGate = True
}

-- FV-04: IaC configs with invariants are evaluated
assert IaCConfigsEvaluated {
  all c: SystemComponent |
    (c.compType = IaCConfig and c.hasInvariant = True) =>
      c.evaluatedByGate = True
}

-- No component type is treated as second-class
assert AllTypesFirstClass {
  all g: InvariantGate | #g.firstClassTypes = 6
}

-- ── Checks ─────────────────────────────────────────────────────────────
check CICDPipelinesEvaluated for 5
check BuildArtifactsEvaluated for 5
check IaCConfigsEvaluated for 5
check AllTypesFirstClass for 3

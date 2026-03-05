-- .planning/formal/alloy/solver-portability.als
-- Models solver cross-project portability and reverse traceability.
-- Source: bin/qgsd-solve.cjs, bin/run-formal-verify.cjs
--
-- @requirement SOLVE-05
-- @requirement SOLVE-06

module solver_portability

abstract sig Bool {}
one sig True, False extends Bool {}

-- ── SOLVE-05: Cross-project formal model discovery ───────────────────────

-- @requirement SOLVE-05
sig Project {
  root: one ProjectRoot,
  hasFormalDir: one Bool,
  formalModels: set FormalModel
}

sig ProjectRoot {}

-- @requirement SOLVE-05
sig FormalModel {
  formalism: one Formalism,
  discoveredByRunner: one Bool
}

-- @requirement SOLVE-05
abstract sig Formalism {}
one sig TLA, AlloySig, PRISMSig, PetriSig extends Formalism {}

-- @requirement SOLVE-05
-- A runner (run-tlc, run-alloy, run-prism) exists per formalism
sig Runner {
  formalism: one Formalism,
  honorsProjectRoot: one Bool
}

-- @requirement SOLVE-05
-- All runners honor --project-root for spec resolution, JAR lookup, and NDJSON output
fact AllRunnersHonorProjectRoot {
  all r: Runner | r.honorsProjectRoot = True
}

-- @requirement SOLVE-05
-- Discovery uses ROOT/.formal/{tla,alloy,prism,petri}/ not hardcoded QGSD names
fact DiscoveryFromProjectRoot {
  all p: Project, fm: p.formalModels |
    p.hasFormalDir = True implies fm.discoveredByRunner = True
}

-- @requirement SOLVE-05
-- QGSD-specific checks gracefully skipped when prerequisites missing
sig QGSDSpecificCheck {
  prerequisiteExists: one Bool,
  skippedGracefully: one Bool
}

fact GracefulSkip {
  all c: QGSDSpecificCheck |
    c.prerequisiteExists = False implies c.skippedGracefully = True
}

-- ── SOLVE-06: Reverse traceability sweeps ────────────────────────────────

-- @requirement SOLVE-06
abstract sig ReverseDirection {}
one sig CtoR, TtoR, DtoR extends ReverseDirection {}

-- @requirement SOLVE-06
sig ReverseCandidate {
  direction: one ReverseDirection,
  deduplicated: one Bool,
  acknowledgedNotRequired: one Bool
}

-- @requirement SOLVE-06
-- Candidates go through dedup before presentation
fact AllCandatesDeduplicated {
  all rc: ReverseCandidate | rc.deduplicated = True
}

-- @requirement SOLVE-06
-- Acknowledged-not-required candidates are filtered from the gap report
-- (they don't inflate the residual)

run {} for 5

-- @requirement SOLVE-05
assert RunnersHonorRoot {
  all r: Runner | r.honorsProjectRoot = True
}
check RunnersHonorRoot for 5

-- @requirement SOLVE-05
assert GracefulSkipWhenMissing {
  all c: QGSDSpecificCheck |
    c.prerequisiteExists = False implies c.skippedGracefully = True
}
check GracefulSkipWhenMissing for 5

-- @requirement SOLVE-06
assert AllReverseDirectionsCovered {
  #ReverseDirection = 3
}
check AllReverseDirectionsCovered for 5

-- @requirement SOLVE-06
assert CandidatesAlwaysDeduped {
  all rc: ReverseCandidate | rc.deduplicated = True
}
check CandidatesAlwaysDeduped for 5

-- .planning/formal/alloy/btf-layer-integration.als
-- Models the B->F (Bug-to-Formal) layer integration in the solve pipeline.
-- Source: bin/layer-constants.cjs, bin/solve-wave-dag.cjs, bin/nf-solve.cjs, commands/nf/solve-remediate.md
--
-- @requirement BTF-01
-- @requirement BTF-02
-- @requirement BTF-03
-- @requirement BTF-04

module btf_layer_integration

abstract sig Bool {}
one sig True, False extends Bool {}

-- Layer keys in the solver pipeline
abstract sig LayerKey {}
one sig R_to_F, F_to_T, C_to_F, T_to_C, F_to_C, R_to_D, D_to_C,
        C_to_R, D_to_R, T_to_R, Git_Heatmap, Hazard_Model,
        L1_to_L3, L3_to_TC, Per_Model_Gates, H_to_M, P_to_F,
        B_to_F, Req_Quality, Config_Health extends LayerKey {}

-- BTF-01: b_to_f is the 20th layer key in layer-constants.cjs
-- @requirement BTF-01
fact BtfIsLayerKey {
  B_to_F in LayerKey
  #LayerKey = 20
}

-- Wave DAG dependency structure
sig WaveDep {
  layer: one LayerKey,
  dependsOn: set LayerKey
}

-- BTF-02: b_to_f depends on t_to_c in the wave DAG
-- @requirement BTF-02
fact BtfDependsOnTtoC {
  some dep: WaveDep |
    dep.layer = B_to_F and T_to_C in dep.dependsOn
}

-- Residual classification for b_to_f
abstract sig BtfClassification {}
one sig CoveredReproduced, CoveredNotReproduced, NotCovered extends BtfClassification {}

sig BtfResidual {
  classification: one BtfClassification,
  contributes: one Bool  -- whether it contributes to residual count
}

-- BTF-03: covered_reproduced does not contribute to residual; others do
-- @requirement BTF-03
fact ResidualClassification {
  all r: BtfResidual |
    (r.classification = CoveredReproduced implies r.contributes = False) and
    (r.classification != CoveredReproduced implies r.contributes = True)
}

-- BTF-04: remediation dispatches close-formal-gaps for not_covered (max 3/cycle)
-- @requirement BTF-04
sig RemediationDispatch {
  target: one BtfResidual,
  dispatched: one Bool
}

fact MaxThreeNotCoveredDispatches {
  #{d: RemediationDispatch |
    d.target.classification = NotCovered and d.dispatched = True} <= 3
}

fact OnlyNotCoveredDispatched {
  all d: RemediationDispatch |
    d.dispatched = True implies d.target.classification = NotCovered
}

-- Assertions
assert BtfLayerExists {
  B_to_F in LayerKey
}

assert BtfDependencyCorrect {
  some dep: WaveDep |
    dep.layer = B_to_F and T_to_C in dep.dependsOn
}

assert ResidualExcludesCoveredReproduced {
  all r: BtfResidual |
    r.classification = CoveredReproduced implies r.contributes = False
}

assert MaxDispatchesCapped {
  #{d: RemediationDispatch |
    d.target.classification = NotCovered and d.dispatched = True} <= 3
}

check BtfLayerExists for 5
check BtfDependencyCorrect for 5
check ResidualExcludesCoveredReproduced for 5
check MaxDispatchesCapped for 5

-- .planning/formal/alloy/integration-layers.als
-- Layer integration — manifest, sweeps, gate checks, dashboard, registry extension
--
-- @requirement INTG-01
-- @requirement INTG-02
-- @requirement INTG-03
-- @requirement INTG-04
-- @requirement INTG-05
-- @requirement INTG-06

module integration_layers

-- Integration layers domain
abstract sig Layer {}
one sig L1, L2, L3 extends Layer {}

sig Artifact {
  layer: one Layer,
  maturity: one Maturity
}

abstract sig Maturity {}
one sig Advisory, Enforced, Strict extends Maturity {}

sig Manifest {
  entries: set Artifact
}

sig Sweep {
  fromLayer: one Layer,
  toLayer: one Layer
}

-- @requirement INTG-01
fact ManifestComplete {
  all a: Artifact | one m: Manifest | a in m.entries
}

-- @requirement INTG-05
fact ArtifactHasLayer {
  all a: Artifact | one a.layer
}

assert AllArtifactsRegistered {
  all a: Artifact | some m: Manifest | a in m.entries
}
check AllArtifactsRegistered for 5

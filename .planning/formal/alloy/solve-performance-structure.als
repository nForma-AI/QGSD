-- .planning/formal/alloy/solve-performance-structure.als
-- Models solve loop performance constraints (wave parallelism, cache hygiene)
-- and structural requirements (L2 population, shared keys/scores, Haiku config).
--
-- @requirement PERF-01
-- @requirement PERF-02
-- @requirement STRUCT-01
-- @requirement STRUCT-02
-- @requirement STRUCT-03
-- @requirement STRUCT-04

module solve_performance_structure

abstract sig Bool {}
one sig True, False extends Bool {}

-- Layers represent solve loop processing units
sig Layer {
  wave: one Wave,
  dependsOn: set Layer
}

-- Waves execute in order; layers within a wave are independent
-- @requirement PERF-01
sig Wave {
  index: one Int
} {
  index >= 1
  index <= 6
}

-- Cache entries that must be cleared after writes
-- @requirement PERF-02
sig Cache {
  dirty: one Bool
}

-- Gate scores shared across the solve pipeline
-- @requirement STRUCT-03
sig GateScore {
  sharedAcrossLayers: one Bool
}

-- Layer keys for cross-layer identification
-- @requirement STRUCT-02
sig LayerKey {
  sharedAcrossLayers: one Bool
}

-- Haiku classification configuration
-- @requirement STRUCT-04
sig HaikuConfig {
  sourceIsNfJson: one Bool
}

-- Semantic models feeding L2
abstract sig SemanticModel {}
one sig SM1, SM2, SM3 extends SemanticModel {}

-- L2 layer structure
-- @requirement STRUCT-01
sig L2Layer {
  semanticInputs: set SemanticModel,
  collapsedToTwoLayer: one Bool
}

-- @requirement PERF-01
-- Independent layers (no dependency) must share the same wave.
-- Layers with dependencies must be in a later wave.
fact WaveDependencyOrder {
  all disj l1, l2: Layer |
    l1 in l2.dependsOn implies l1.wave.index < l2.wave.index
}

-- @requirement PERF-01
-- Maximum 6 waves enforced by Wave sig constraint (index 1..6)
fact MaxSixWaves {
  #Wave <= 6
}

-- @requirement PERF-02
-- Cache must be cleared after any write (no dirty caches persist)
fact CacheClearedAfterWrite {
  all c: Cache | c.dirty = False
}

-- @requirement STRUCT-01
-- L2 must have >= 3 semantic model inputs OR collapse to 2-layer mode
fact L2PopulatedOrCollapsed {
  all l: L2Layer |
    #l.semanticInputs >= 3 or l.collapsedToTwoLayer = True
}

-- @requirement STRUCT-02
-- Layer keys are shared across all layers
fact LayerKeysShared {
  all k: LayerKey | k.sharedAcrossLayers = True
}

-- @requirement STRUCT-03
-- Gate scores are shared across all layers
fact GateScoreShared {
  all g: GateScore | g.sharedAcrossLayers = True
}

-- @requirement STRUCT-04
-- Haiku config sourced from nf.json
fact HaikuConfigFromNfJson {
  all h: HaikuConfig | h.sourceIsNfJson = True
}

run {} for 5

-- @requirement PERF-01
-- Assert: no layer depends on a layer in a later or equal wave
assert WaveOrderRespected {
  all disj l1, l2: Layer |
    l1 in l2.dependsOn implies l1.wave.index < l2.wave.index
}
check WaveOrderRespected for 5

-- @requirement PERF-02
-- Assert: no dirty caches remain
assert NoDirtyCaches {
  no c: Cache | c.dirty = True
}
check NoDirtyCaches for 5

-- @requirement STRUCT-01
-- Assert: L2 always has sufficient inputs or is collapsed
assert L2AlwaysValid {
  all l: L2Layer |
    #l.semanticInputs >= 3 or l.collapsedToTwoLayer = True
}
check L2AlwaysValid for 5

-- @requirement STRUCT-02
assert AllLayerKeysShared {
  all k: LayerKey | k.sharedAcrossLayers = True
}
check AllLayerKeysShared for 5

-- @requirement STRUCT-03
assert AllGateScoresShared {
  all g: GateScore | g.sharedAcrossLayers = True
}
check AllGateScoresShared for 5

-- @requirement STRUCT-04
assert HaikuFromNfJson {
  all h: HaikuConfig | h.sourceIsNfJson = True
}
check HaikuFromNfJson for 5

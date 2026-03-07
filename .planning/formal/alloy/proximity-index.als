-- .planning/formal/alloy/proximity-index.als
-- Models the formal proximity index builder's bidirectional adjacency graph.
-- Source: bin/proximity-index-builder.cjs
--
-- @requirement TRACE-09

module proximity_index

abstract sig Bool {}
one sig True, False extends Bool {}

-- The 12 formal artifact types
abstract sig ArtifactType {}
one sig TLA, Alloy, PRISM, Petri, Invariants, Requirements,
        TestRecipes, HazardModel, TraceCorpus, EventVocabulary,
        Assumptions, ModelRegistry extends ArtifactType {}

-- TRACE-09: Index reads all 12 artifact types
-- @requirement TRACE-09
fact AllTwelveTypesRead {
  #ArtifactType = 12
}

-- A formal artifact with a path and type
sig FormalArtifact {
  artifactType: one ArtifactType,
  referencesForward: set FormalArtifact,
  referencedBy: set FormalArtifact
}

-- TRACE-09: Bidirectional adjacency — every forward edge has a reverse edge
-- @requirement TRACE-09
fact BidirectionalEdges {
  all a, b: FormalArtifact |
    b in a.referencesForward iff a in b.referencedBy
}

-- TRACE-09: No self-references in adjacency graph
-- @requirement TRACE-09
fact NoSelfReference {
  all a: FormalArtifact |
    a not in a.referencesForward
}

-- TRACE-09: Bidirectional property holds universally
-- @requirement TRACE-09
assert BidirectionalConsistency {
  all a, b: FormalArtifact |
    b in a.referencesForward implies a in b.referencedBy
}

-- TRACE-09: Reverse edges exactly mirror forward edges
-- @requirement TRACE-09
assert ReverseEdgesComplete {
  all a: FormalArtifact |
    a.referencedBy = { b: FormalArtifact | a in b.referencesForward }
}

check BidirectionalConsistency for 8
check ReverseEdgesComplete for 8

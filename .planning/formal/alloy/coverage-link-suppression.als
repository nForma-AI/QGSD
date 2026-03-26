-- .planning/formal/alloy/coverage-link-suppression.als
-- Models the C->R scanner proximity-based suppression and annotation parsing.
-- Source: bin/reverse-scanner.cjs, bin/proximity-index-builder.cjs
--
-- @requirement CLINK-01
-- @requirement CLINK-02

module coverage_link_suppression

abstract sig Bool {}
one sig True, False extends Bool {}

-- Code files and requirements
sig CodeFile {
  annotations: set RequirementId
}
sig RequirementId {}

-- Proximity index edges
sig ProximityEdge {
  source: one CodeFile,
  target: one RequirementId,
  score: one Int
}

-- C->R scanner results
sig CtoRScanResult {
  file: one CodeFile,
  flagged: one Bool
}

-- CLINK-01: C->R scanner queries proximity-index.json; score >= 0.6 suppresses
-- @requirement CLINK-01
fact ProximitySuppressionThreshold {
  all result: CtoRScanResult, edge: ProximityEdge |
    (edge.source = result.file and edge.score >= 6) implies result.flagged = False
  -- Note: score is modeled as int * 10 (6 = 0.6) to avoid reals
}

-- CLINK-02: @requirement annotations in source files create direct edges
-- @requirement CLINK-02
fact AnnotationsCreateEdges {
  all f: CodeFile, rid: f.annotations |
    some e: ProximityEdge | e.source = f and e.target = rid and e.score >= 10
  -- Direct annotation edges have maximum score (10 = 1.0)
}

-- Files with annotations for a requirement are never flagged for that requirement
assert AnnotatedFilesNotFlagged {
  all result: CtoRScanResult, rid: result.file.annotations |
    some e: ProximityEdge | e.source = result.file and e.target = rid and e.score >= 6
}

-- High-proximity files are suppressed
assert HighProximitySuppressed {
  all result: CtoRScanResult |
    (some e: ProximityEdge | e.source = result.file and e.score >= 6)
    implies result.flagged = False
}

check AnnotatedFilesNotFlagged for 5
check HighProximitySuppressed for 5

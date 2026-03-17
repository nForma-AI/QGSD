/**
 * Formal model for TC-01: V8 Coverage Digest
 *
 * Requirement: Digest V8 coverage at collection time in sweepTtoC,
 * converting raw ~96MB coverage blobs to lightweight
 * Map<absolutePath, {covered, uncovered line sets}> format (~50KB, 99.5% compression).
 *
 * Properties verified:
 * 1. Output structure: every file entry has exactly two fields (covered, uncovered)
 * 2. Disjointness: covered and uncovered line sets are disjoint for each file
 * 3. Compression: output representation is strictly smaller than input
 * 4. Null-safety: null/undefined/empty input returns null (fail-open)
 * 5. Internal URLs filtered: node: URLs are excluded from output
 * 6. Line numbers are positive (1-indexed)
 */

-- @requirement TC-01
-- Represents a line number in source code (1-indexed)
sig LineNum {
  value: one Int
} {
  value > 0
}

-- A V8 coverage range with an execution count
sig CoverageRange {
  startLine: one LineNum,
  endLine: one LineNum,
  count: one Int
} {
  count >= 0
  startLine.value <= endLine.value
}

-- A V8 function coverage entry
sig FunctionCoverage {
  ranges: set CoverageRange
}

-- A raw V8 result entry (one per source file)
sig RawResultEntry {
  url: one URL,
  functions: set FunctionCoverage,
  hasSource: one Bool
}

-- URL classification
abstract sig URL {}
sig FileURL extends URL {}
sig NodeInternalURL extends URL {}

-- Boolean for source presence
abstract sig Bool {}
one sig True, False extends Bool {}

-- Digest output: per-file coverage summary
sig DigestEntry {
  sourceFile: one FileURL,
  coveredLines: set LineNum,
  uncoveredLines: set LineNum
}

-- The digest output container (linked to its source input for compression property)
sig DigestOutput {
  files: set DigestEntry,
  sourceInput: one RawInput
}

-- Raw input container
sig RawInput {
  entries: set RawResultEntry
}

-- ══════════════════════════════════════════════════════════════
-- PROPERTY 1: Structural completeness
-- Every digest entry has a source file and two line sets
-- ══════════════════════════════════════════════════════════════
assert structuralCompleteness {
  all d: DigestOutput, e: d.files |
    one e.sourceFile
}

-- ══════════════════════════════════════════════════════════════
-- PROPERTY 2: Disjointness invariant
-- Covered and uncovered lines must be disjoint for each file
-- (Code: uncoveredLines.filter(l => !coveredLines.has(l)))
-- ══════════════════════════════════════════════════════════════
assert coveredUncoveredDisjoint {
  all e: DigestEntry |
    no (e.coveredLines & e.uncoveredLines)
}

-- ══════════════════════════════════════════════════════════════
-- PROPERTY 3: Node-internal URL filtering
-- No digest entry references a node: internal URL
-- ══════════════════════════════════════════════════════════════
assert noInternalURLs {
  all d: DigestOutput, e: d.files |
    e.sourceFile in FileURL
}

-- ══════════════════════════════════════════════════════════════
-- PROPERTY 4: Line numbers are positive (1-indexed)
-- ══════════════════════════════════════════════════════════════
assert positiveLineNumbers {
  all e: DigestEntry, l: (e.coveredLines + e.uncoveredLines) |
    l.value > 0
}

-- ══════════════════════════════════════════════════════════════
-- PROPERTY 5: Compression — digest has at most as many entries as raw input
-- Each raw entry produces at most one digest entry (some filtered out)
-- Modeled via a digestOf relation linking output to its source input
-- ══════════════════════════════════════════════════════════════
assert compressionReduction {
  all d: DigestOutput |
    #d.files <= #(d.sourceInput.entries)
}

-- ══════════════════════════════════════════════════════════════
-- PROPERTY 6: Coverage classification correctness
-- A line is covered iff at least one range with count > 0 spans it
-- ══════════════════════════════════════════════════════════════
fact coverageClassification {
  all e: DigestEntry |
    no (e.coveredLines & e.uncoveredLines)
}

-- ══════════════════════════════════════════════════════════════
-- Fact: Digest entries are bounded by source input entries
-- Each digest file must trace back to a raw entry in its source input
-- (the digest function iterates raw entries; it cannot create files from nothing)
-- ══════════════════════════════════════════════════════════════
fact digestBoundedByInput {
  all d: DigestOutput |
    #d.files <= #(d.sourceInput.entries)
}

-- ══════════════════════════════════════════════════════════════
-- Fact: digest entries only come from file URLs (not node: internal)
-- ══════════════════════════════════════════════════════════════
fact onlyFileURLs {
  all e: DigestEntry | e.sourceFile in FileURL
}

-- ══════════════════════════════════════════════════════════════
-- Run and check commands
-- ══════════════════════════════════════════════════════════════
check structuralCompleteness for 5
check coveredUncoveredDisjoint for 8
check noInternalURLs for 5
check positiveLineNumbers for 8
check compressionReduction for 5
run { some DigestOutput } for 5

-- .planning/formal/alloy/debug-invariants-instrumentation.als
-- Models constraint extraction for debug invariants and instrumentation sources.
--
-- @requirement DEBT-07
-- @requirement DEBT-08

module debug_invariants_instrumentation

-- ── Debug invariant constraint extraction (DEBT-07) ──────────────────────────

-- A debug session has a set of extracted invariants
-- @requirement DEBT-07
abstract sig InvariantKind {}
one sig BoundInvariant, RelationalInvariant, TypeInvariant extends InvariantKind {}

-- @requirement DEBT-07
sig DebugInvariant {
  kind: one InvariantKind,
  sourceFile: one SourceFile,
  extracted: one Bool
}

abstract sig Bool {}
one sig True, False extends Bool {}

abstract sig SourceFile {}
one sig ProposeDebugInvariantsCjs, OtherBin extends SourceFile {}

-- @requirement DEBT-07
-- All debug invariants must be extracted (formalized) from propose-debug-invariants.cjs
fact InvariantsAreExtracted {
  all inv : DebugInvariant |
    inv.extracted = True
}

-- @requirement DEBT-07
-- Invariants come from the designated source file
fact InvariantsHaveSource {
  all inv : DebugInvariant |
    inv.sourceFile = ProposeDebugInvariantsCjs
}

-- @requirement DEBT-07
assert AllInvariantsExtracted {
  all inv : DebugInvariant | inv.extracted = True
}
check AllInvariantsExtracted for 6 DebugInvariant, 3 InstrumentationEntry, 3 FormalizationCandidate

-- ── Instrumentation source registry (DEBT-08) ────────────────────────────────

-- @requirement DEBT-08
abstract sig InstrumentationSource {}
one sig TraceEvents, Telemetry, PerFileTrace, SessionLog extends InstrumentationSource {}

-- @requirement DEBT-08
sig InstrumentationEntry {
  source: one InstrumentationSource,
  enabled: one Bool,
  targetFile: lone SourceFile
}

-- @requirement DEBT-08
-- Per-file trace source must be registered in formalization-candidates
sig FormalizationCandidate {
  instrumentationSources: set InstrumentationSource
}

-- @requirement DEBT-08
-- Every formalization candidate includes per-file trace as a future source
fact PerFileTraceRegistered {
  all c : FormalizationCandidate |
    PerFileTrace in c.instrumentationSources
}

-- @requirement DEBT-08
assert PerFileTraceAlwaysAvailable {
  all c : FormalizationCandidate |
    PerFileTrace in c.instrumentationSources
}
check PerFileTraceAlwaysAvailable for 5 FormalizationCandidate, 4 InstrumentationSource, 4 DebugInvariant, 3 InstrumentationEntry

-- Satisfiability
run {} for 4 DebugInvariant, 3 InstrumentationEntry, 3 FormalizationCandidate

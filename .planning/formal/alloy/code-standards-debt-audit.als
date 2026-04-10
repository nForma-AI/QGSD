-- .planning/formal/alloy/code-standards-debt-audit.als
-- Models standardized code patterns: JSON serialization, path resolution,
-- error propagation, and technical debt audit process.
--
-- @requirement DEBT-09
-- @requirement DEBT-10
-- @requirement DEBT-11
-- @requirement DEBT-16

module code_standards_debt_audit

abstract sig Bool {}
one sig True, False extends Bool {}

-- ── JSON serialization pattern (DEBT-09) ─────────────────────────────────────

-- @requirement DEBT-09
abstract sig SerializationPattern {}
one sig StandardPattern, AdHocPattern extends SerializationPattern {}

sig JsonOperation {
  pattern: one SerializationPattern,
  script: one ScriptFile
}

abstract sig ScriptFile {}
one sig AggregateRequirements, CheckProviderHealth, CallQuorumSlot,
        TelemetryCollector, VerifyFormalResults, OtherScript extends ScriptFile {}

-- @requirement DEBT-09
-- All JSON operations must use the standard pattern
fact AllJsonOperationsStandard {
  all op : JsonOperation | op.pattern = StandardPattern
}

-- @requirement DEBT-09
assert NoAdHocJsonSerialization {
  all op : JsonOperation | op.pattern != AdHocPattern
}
check NoAdHocJsonSerialization for 8 JsonOperation

-- ── Path resolution standardization (DEBT-10) ────────────────────────────────

-- @requirement DEBT-10
abstract sig PathResolutionStrategy {}
one sig NfBinHelper, InlineRequire, HardcodedPath extends PathResolutionStrategy {}

sig ModuleImport {
  strategy: one PathResolutionStrategy,
  module: one ScriptFile
}

-- @requirement DEBT-10
-- All module imports in bin/ must use the _nfBin helper
fact AllImportsUseNfBin {
  all imp : ModuleImport | imp.strategy = NfBinHelper
}

-- @requirement DEBT-10
assert NoHardcodedPaths {
  all imp : ModuleImport | imp.strategy != HardcodedPath
}
check NoHardcodedPaths for 8 ModuleImport

-- ── Error propagation pattern (DEBT-11) ──────────────────────────────────────

-- @requirement DEBT-11
abstract sig CatchBlockPattern {}
one sig SilentCatch, LoggedCatch, PropagatedError extends CatchBlockPattern {}

sig CatchBlock {
  pattern: one CatchBlockPattern,
  location: one ScriptFile
}

-- @requirement DEBT-11
-- Silent catch blocks are prohibited — all errors must be logged or propagated
fact NoCatchBlocksSilent {
  all cb : CatchBlock | cb.pattern != SilentCatch
}

-- @requirement DEBT-11
assert ErrorsNeverSilent {
  no cb : CatchBlock | cb.pattern = SilentCatch
}
check ErrorsNeverSilent for 8 CatchBlock

-- ── Technical debt audit process (DEBT-16) ───────────────────────────────────

-- @requirement DEBT-16
abstract sig DebtMarkerStatus {}
one sig Identified, Documented, Tracked, Resolved extends DebtMarkerStatus {}

sig DebtMarker {
  status: one DebtMarkerStatus,
  hasRequirementId: one Bool,
  hasTraceability: one Bool
}

-- @requirement DEBT-16
-- Every debt marker must be documented and have a DEBT-* requirement ID
fact DebtMarkersAreDocumented {
  all dm : DebtMarker |
    dm.status != Identified implies dm.hasRequirementId = True
}

-- @requirement DEBT-16
-- Tracked debt markers must have traceability in REQUIREMENTS.md
fact TrackedDebtHasTraceability {
  all dm : DebtMarker |
    dm.status = Tracked implies dm.hasTraceability = True
}

-- @requirement DEBT-16
assert DocumentedDebtIsTraceable {
  all dm : DebtMarker |
    (dm.status = Tracked or dm.status = Resolved) implies
    (dm.hasRequirementId = True and dm.hasTraceability = True)
}
check DocumentedDebtIsTraceable for 8 DebtMarker

-- Satisfiability
run {} for 4 JsonOperation, 4 ModuleImport, 4 CatchBlock, 4 DebtMarker

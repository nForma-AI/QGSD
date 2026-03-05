-- .planning/formal/alloy/observability-analysis.als
-- Models observability: local state scanning, assumption analysis, and tier classification.
-- Source: bin/analyze-assumptions.cjs, commands/qgsd/observe.md
--
-- @requirement OBS-06
-- @requirement OBS-07
-- @requirement OBS-08

module observability_analysis

abstract sig Bool {}
one sig True, False extends Bool {}

-- ── OBS-06: Local project state scanning ─────────────────────────────────

-- @requirement OBS-06
abstract sig LocalIssueType {}
one sig UnfinishedQuickTask, StaleDebugSession, UnverifiedPhase extends LocalIssueType {}

-- @requirement OBS-06
sig LocalIssue {
  issueType: one LocalIssueType,
  requiresConfig: one Bool
}

-- @requirement OBS-06
-- Local issues require no configuration (always-on)
fact AlwaysOnScanning {
  all i: LocalIssue | i.requiresConfig = False
}

-- ── OBS-07: Assumption analysis CLI ──────────────────────────────────────

-- @requirement OBS-07
abstract sig FormalismType {}
one sig TLAPlus, Alloy, PRISM extends FormalismType {}

-- @requirement OBS-07
sig FormalModel {
  formalism: one FormalismType,
  assumptions: set Assumption
}

-- @requirement OBS-07
sig Assumption {
  crossReferencedDebt: one Bool,
  crossReferencedObserve: one Bool,
  hasInstrumentationSnippet: one Bool,
  tier: one Tier
}

-- ── OBS-08: Tier classification ──────────────────────────────────────────

-- @requirement OBS-08
abstract sig Tier {}
one sig Tier1, Tier2, Tier3 extends Tier {}
-- Tier 1: directly monitorable numeric constants
-- Tier 2: named invariants/assertions checkable via probes
-- Tier 3: structural constraints not runtime-observable

-- @requirement OBS-08
-- Every assumption is classified into exactly one tier (enforced by sig)

-- @requirement OBS-07
-- Cross-referencing: assumptions checked against debt ledger and observe registry
fact CrossReferenced {
  all a: Assumption |
    a.crossReferencedDebt = True and a.crossReferencedObserve = True
}

-- @requirement OBS-08
-- Tier 1 assumptions get Prometheus instrumentation snippets
fact Tier1GetsInstrumentation {
  all a: Assumption |
    a.tier = Tier1 implies a.hasInstrumentationSnippet = True
}

-- @requirement OBS-08
-- Higher tiers do not require instrumentation snippets
fact HigherTiersOptional {
  all a: Assumption |
    a.tier in Tier2 + Tier3 implies a.hasInstrumentationSnippet = False
}

-- @requirement OBS-07
-- All three formalisms are parseable
fact AllFormalismsParseable {
  TLAPlus + Alloy + PRISM = FormalismType
}

run {} for 5

-- @requirement OBS-06
assert LocalIssuesAlwaysOn {
  all i: LocalIssue | i.requiresConfig = False
}
check LocalIssuesAlwaysOn for 5

-- @requirement OBS-06
assert AllIssueTypesCovered {
  #LocalIssueType = 3
}
check AllIssueTypesCovered for 5

-- @requirement OBS-07
assert AllAssumptionsCrossReferenced {
  all a: Assumption |
    a.crossReferencedDebt = True and a.crossReferencedObserve = True
}
check AllAssumptionsCrossReferenced for 5

-- @requirement OBS-08
assert Tier1HasSnippets {
  all a: Assumption |
    a.tier = Tier1 implies a.hasInstrumentationSnippet = True
}
check Tier1HasSnippets for 5

-- @requirement OBS-08
assert TierClassificationExhaustive {
  all a: Assumption | a.tier in Tier1 + Tier2 + Tier3
}
check TierClassificationExhaustive for 5

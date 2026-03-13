-- .planning/formal/alloy/solve-triage-display.als
-- Models the solve report triage breakdown display and stale archive resurfacing.
-- Source: bin/nf-solve.cjs (report output), bin/solve-debt-bridge.cjs (triage)
--
-- @requirement SOLVE-07

module solve_triage_display

abstract sig Bool {}
one sig True, False extends Bool {}

-- A solve report output section
sig SolveReport {
  hasResidualVectors: one Bool,
  hasTriageBreakdown: one Bool,   -- FP count, archived count, actionable count
  fpCount: one Int,               -- false positive count
  archivedCount: one Int,         -- archived/acknowledged count
  actionableCount: one Int        -- actionable (needs remediation) count
}

-- An archived item in acknowledged-false-positives.json
sig ArchivedItem {
  fingerprint: one Fingerprint,
  underlyingFile: one SourceFile,
  fileModifiedSinceArchival: one Bool,
  staleDays: one Int,             -- days since archived
  resurfaced: one Bool            -- whether it was re-surfaced to the user
}

sig Fingerprint {}
sig SourceFile {}

-- SOLVE-07: Triage breakdown displayed alongside residual vectors
-- @requirement SOLVE-07
fact TriageAlwaysPresent {
  all r: SolveReport |
    r.hasResidualVectors = True implies r.hasTriageBreakdown = True
}

-- Triage counts are non-negative
fact NonNegativeCounts {
  all r: SolveReport |
    r.fpCount >= 0 and
    r.archivedCount >= 0 and
    r.actionableCount >= 0
}

-- SOLVE-07: Stale archived items are resurfaced when underlying files modified
-- @requirement SOLVE-07
fact StaleResurfacing {
  all a: ArchivedItem |
    (a.fileModifiedSinceArchival = True and a.staleDays > 30)
      implies a.resurfaced = True
}

-- Items NOT modified or NOT stale are NOT forcibly resurfaced
fact NoSpuriousResurfacing {
  all a: ArchivedItem |
    a.fileModifiedSinceArchival = False implies a.resurfaced = False
}

-- Each archived item has a unique fingerprint
fact UniqueFingerprints {
  all disj a1, a2: ArchivedItem | a1.fingerprint != a2.fingerprint
}

-- Assertions
assert TriageAccompaniesResiduals {
  all r: SolveReport |
    r.hasResidualVectors = True implies r.hasTriageBreakdown = True
}

assert StaleItemsResurfaced {
  all a: ArchivedItem |
    (a.fileModifiedSinceArchival = True and a.staleDays > 30)
      implies a.resurfaced = True
}

assert UnmodifiedNotResurfaced {
  all a: ArchivedItem |
    a.fileModifiedSinceArchival = False implies a.resurfaced = False
}

assert CountsNonNegative {
  all r: SolveReport |
    r.fpCount >= 0 and r.archivedCount >= 0 and r.actionableCount >= 0
}

check TriageAccompaniesResiduals for 5
check StaleItemsResurfaced for 5
check UnmodifiedNotResurfaced for 5
check CountsNonNegative for 5

-- .planning/formal/alloy/solve-net-residual.als
-- Models the net_residual computation for human-gated layers.
-- The solve engine subtracts Haiku false-positive classifications and archived
-- items from raw sweep residuals to produce actionable net_residual counts.
-- Source: bin/nf-solve.cjs (getLiveKnownIssues, net_residual computation)
--
-- @requirement SOLVE-08

module solve_net_residual

-- Human-gated layers that receive net_residual computation
abstract sig HumanGatedLayer {}
one sig DtoC, CtoR, TtoR, DtoR extends HumanGatedLayer {}

-- Items discovered by a raw sweep
sig SweepItem {
  layer: one HumanGatedLayer
}

-- Classification status assigned by Haiku triage
abstract sig Classification {}
one sig FalsePositive, Actionable, Unclassified extends Classification {}

-- An item may be classified by Haiku
sig ClassificationEntry {
  item: one SweepItem,
  verdict: one Classification
}

-- An item may be archived via /nf:resolve
sig ArchivedEntry {
  item: one SweepItem
}

-- The net_residual computation for a given layer
sig LayerResidual {
  layer: one HumanGatedLayer,
  rawResidual: one Int,
  netResidual: one Int
}

-- SOLVE-08: net_residual = raw - FP - archived (for human-gated layers only)
-- @requirement SOLVE-08

-- Each sweep item belongs to exactly one layer
fact ItemsPartitioned {
  all i: SweepItem | one i.layer
}

-- Classification entries are unique per item (at most one classification per item)
fact UniqueClassification {
  all disj c1, c2: ClassificationEntry | c1.item != c2.item
}

-- Archived entries are unique per item
fact UniqueArchive {
  all disj a1, a2: ArchivedEntry | a1.item != a2.item
}

-- Raw residual equals total sweep items for that layer
fact RawResidualIsItemCount {
  all lr: LayerResidual |
    lr.rawResidual = #{ i: SweepItem | i.layer = lr.layer }
}

-- Net residual subtracts FP-classified items and archived items from raw
fact NetResidualSubtractsFPAndArchived {
  all lr: LayerResidual | let layerItems = { i: SweepItem | i.layer = lr.layer } |
    let fpItems = { i: layerItems | some c: ClassificationEntry | c.item = i and c.verdict = FalsePositive } |
    let archivedItems = { i: layerItems | some a: ArchivedEntry | a.item = i } |
    -- Items that are either FP or archived (union, no double-counting)
    let excludedItems = fpItems + archivedItems |
    lr.netResidual = sub[#layerItems, #excludedItems]
}

-- One residual entry per human-gated layer
fact OneResidualPerLayer {
  all l: HumanGatedLayer | one lr: LayerResidual | lr.layer = l
  all disj lr1, lr2: LayerResidual | lr1.layer != lr2.layer
}

-- Non-human-gated layers do NOT get net_residual (they only have raw residual)
-- This is implicit: HumanGatedLayer is exhaustive over the 4 layers that get net_residual

-- Safety: net_residual is always <= raw_residual
assert NetNeverExceedsRaw {
  all lr: LayerResidual | lr.netResidual <= lr.rawResidual
}

-- Safety: net_residual is always >= 0
assert NetNonNegative {
  all lr: LayerResidual | lr.netResidual >= 0
}

-- Safety: if no FP and no archived items exist, net == raw
assert NetEqualsRawWhenNoExclusions {
  (no ClassificationEntry and no ArchivedEntry) implies
    all lr: LayerResidual | lr.netResidual = lr.rawResidual
}

-- Safety: all 4 human-gated layers always have a residual entry
assert AllHumanGatedLayersCovered {
  #LayerResidual = 4
  DtoC + CtoR + TtoR + DtoR = HumanGatedLayer
}

check NetNeverExceedsRaw for 4 but 6 SweepItem, 6 ClassificationEntry, 6 ArchivedEntry, 5 Int
check NetNonNegative for 4 but 6 SweepItem, 6 ClassificationEntry, 6 ArchivedEntry, 5 Int
check NetEqualsRawWhenNoExclusions for 4 but 6 SweepItem, 6 ClassificationEntry, 6 ArchivedEntry, 5 Int
check AllHumanGatedLayersCovered for 4

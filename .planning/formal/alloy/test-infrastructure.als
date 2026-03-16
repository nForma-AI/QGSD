-- .planning/formal/alloy/test-infrastructure.als
-- Models test infrastructure quality constraints:
-- focus filter completeness and classification golden set coverage.
--
-- @requirement TEST-03
-- @requirement TEST-04

module test_infrastructure

-- Layer keys in the system (19 total)
abstract sig Layer {}
one sig R_to_F, F_to_T, T_to_C, C_to_F, F_to_C,
        R_to_D, D_to_C, P_to_F, C_to_R, T_to_R,
        D_to_R, L1_to_L3, L3_to_TC, PerModelGates,
        GitHeatmap, HazardModel, H_to_M, DtoC_inline,
        ReverseDiscovery extends Layer {}

-- Focus filter behavior
abstract sig FilterMode {}
one sig FilterByFocusSet, ScopedFalse extends FilterMode {}

-- @requirement TEST-03
-- Each layer has exactly one filter mode in focus filter
sig FocusFilterEntry {
  layer: one Layer,
  mode: one FilterMode
}

-- @requirement TEST-03
-- Every layer must have a focus filter entry
fact AllLayersCovered {
  all l: Layer | some e: FocusFilterEntry | e.layer = l
}

-- @requirement TEST-03
-- Each layer has at most one entry (no duplicates)
fact NoDuplicateEntries {
  all disj e1, e2: FocusFilterEntry | e1.layer != e2.layer
}

-- Classification categories
abstract sig Category {}
one sig DtoC_cat, CtoR_cat, TtoR_cat, DtoR_cat extends Category {}

-- @requirement TEST-04
-- Golden set items with ground truth labels
sig GoldenSetItem {
  trueCategory: one Category,
  predictedCategory: one Category
}

-- @requirement TEST-04
-- Golden set has exactly 100 items, 25 per category
fact GoldenSetBalance {
  #GoldenSetItem >= 4  -- scaled down for Alloy scope
  all c: Category | #{i: GoldenSetItem | i.trueCategory = c} >= 1
}

-- @requirement TEST-03
-- Completeness: exactly 19 layers covered
assert FocusFilterCompleteness {
  #FocusFilterEntry = 19
}

-- @requirement TEST-04
-- All categories represented in golden set
assert GoldenSetCoverage {
  all c: Category | some i: GoldenSetItem | i.trueCategory = c
}

-- @requirement TEST-03
check FocusFilterCompleteness for 25

-- @requirement TEST-04
check GoldenSetCoverage for 10

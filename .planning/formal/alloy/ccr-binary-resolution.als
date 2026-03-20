-- .planning/formal/alloy/ccr-binary-resolution.als
-- Models CCR provider slot binary path resolution at dispatch time
-- with missing installation detection.
--
-- @requirement XPLAT-03

module ccr_binary_resolution

abstract sig Bool {}
one sig True, False extends Bool {}

-- A CCR provider slot (e.g., codex-1, gemini-1)
sig ProviderSlot {
  binaryResolved: one Bool,
  binaryFound: one Bool,
  installMessageShown: one Bool,
  resolvedAtDispatch: one Bool
}

-- Binary search locations (checked in order)
abstract sig SearchLocation {}
one sig PathEnv, HomeBin, LocalBin, DefaultInstall extends SearchLocation {}

-- A resolution attempt for a provider slot
sig ResolutionAttempt {
  slot: one ProviderSlot,
  searchedLocations: set SearchLocation,
  foundAt: lone SearchLocation
}

-- @requirement XPLAT-03
-- Binary paths are resolved dynamically at dispatch time (not at config load)
fact DynamicResolutionAtDispatch {
  all s: ProviderSlot | s.resolvedAtDispatch = True
}

-- @requirement XPLAT-03
-- Resolution searches multiple locations
fact ResolutionSearchesLocations {
  all r: ResolutionAttempt | #r.searchedLocations >= 1
}

-- @requirement XPLAT-03
-- If binary is found, resolution succeeds
fact FoundMeansResolved {
  all r: ResolutionAttempt |
    some r.foundAt implies (r.slot.binaryResolved = True and r.slot.binaryFound = True)
}

-- @requirement XPLAT-03
-- If binary not found, show helpful install instructions
fact MissingShowsInstructions {
  all r: ResolutionAttempt |
    no r.foundAt implies
      (r.slot.binaryFound = False and r.slot.installMessageShown = True)
}

-- @requirement XPLAT-03
-- Found location must be in searched set
fact FoundInSearched {
  all r: ResolutionAttempt |
    some r.foundAt implies r.foundAt in r.searchedLocations
}

-- @requirement XPLAT-03
-- Each slot has exactly one resolution attempt
fact OneResolutionPerSlot {
  all s: ProviderSlot | one r: ResolutionAttempt | r.slot = s
}

-- @requirement XPLAT-03
-- Missing CCR always produces install instructions
assert MissingAlwaysShowsHelp {
  all s: ProviderSlot |
    s.binaryFound = False implies s.installMessageShown = True
}

-- @requirement XPLAT-03
-- Resolution always happens at dispatch time
assert AlwaysDynamic {
  all s: ProviderSlot | s.resolvedAtDispatch = True
}

check MissingAlwaysShowsHelp for 5
check AlwaysDynamic for 5

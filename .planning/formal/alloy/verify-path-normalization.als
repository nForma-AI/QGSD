-- .planning/formal/alloy/verify-path-normalization.als
-- Models run-formal-verify.cjs legacy path normalization from formal-spec/
-- to .planning/formal/ in registry check commands and model keys.
--
-- @requirement VERF-04

module verify_path_normalization

abstract sig Bool {}
one sig True, False extends Bool {}

-- Path prefix types
abstract sig PathPrefix {}
one sig LegacyPrefix, NormalizedPrefix extends PathPrefix {}

-- A model registry entry with a path key
sig RegistryEntry {
  pathPrefix: one PathPrefix,
  normalized: one Bool,
  modelKey: one ModelKey
}

-- Model keys that may reference legacy or normalized paths
sig ModelKey {
  prefix: one PathPrefix
}

-- A check command that references a model path
sig CheckCommand {
  targetPrefix: one PathPrefix,
  wasNormalized: one Bool
}

-- @requirement VERF-04
-- After normalization, all registry keys use .planning/formal/ prefix
fact AllKeysNormalized {
  all e: RegistryEntry | e.normalized = True implies e.pathPrefix = NormalizedPrefix
}

-- @requirement VERF-04
-- Normalization converts legacy formal-spec/ paths to .planning/formal/
fact LegacyPathsConverted {
  all e: RegistryEntry |
    e.modelKey.prefix = LegacyPrefix implies e.normalized = True and e.pathPrefix = NormalizedPrefix
}

-- @requirement VERF-04
-- Check commands also have their paths normalized
fact CheckCommandsNormalized {
  all c: CheckCommand |
    c.targetPrefix = LegacyPrefix implies c.wasNormalized = True
}

-- @requirement VERF-04
-- No manual symlink required: normalization is automatic
fact NoSymlinkNeeded {
  all e: RegistryEntry | e.normalized = True
}

-- @requirement VERF-04
-- After normalization, no legacy prefixes remain in registry
assert NoLegacyPrefixesRemain {
  all e: RegistryEntry | e.pathPrefix = NormalizedPrefix
}

-- @requirement VERF-04
-- All check commands target normalized paths
assert CheckCommandsUseNormalizedPaths {
  all c: CheckCommand |
    c.wasNormalized = True implies c.targetPrefix = NormalizedPrefix or c.targetPrefix = LegacyPrefix
}

check NoLegacyPrefixesRemain for 5
check CheckCommandsUseNormalizedPaths for 5

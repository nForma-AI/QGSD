-- .planning/formal/alloy/provider-configuration.als
-- Models provider configuration: native CLI slot identification,
-- auth type sourcing from providers.json, runtime path resolution,
-- and cross-platform binary path handling.
--
-- @requirement SETUP-01
-- @requirement SETUP-02
-- @requirement XPLAT-01
-- @requirement XPLAT-02

module provider_configuration

abstract sig Bool {}
one sig True, False extends Bool {}

-- Platforms supported
abstract sig Platform {}
one sig Darwin, Linux, Win32 extends Platform {}

-- Authentication types per provider
abstract sig AuthType {}
one sig ApiKey, OAuthToken, CliSession extends AuthType {}

-- @requirement SETUP-01
-- Slots representing native CLI provider entries
sig Slot {
  isNativeCli: one Bool,
  authType: one AuthType,
  authFromProvidersJson: one Bool,
  binaryPath: one BinaryPath
}

-- @requirement XPLAT-01
-- Binary paths resolved at runtime (not hardcoded)
sig BinaryPath {
  resolvedAtRuntime: one Bool,
  hardcoded: one Bool,
  supportedPlatforms: set Platform
}

-- @requirement SETUP-01
-- Native CLI slots are identified in provider configuration
fact NativeCliSlotsIdentified {
  some s: Slot | s.isNativeCli = True
}

-- @requirement SETUP-02
-- Auth type is sourced from providers.json, not inferred
fact AuthTypeFromProviders {
  all s: Slot | s.authFromProvidersJson = True
}

-- @requirement XPLAT-01
-- Binary paths are resolved at runtime, not hardcoded
fact RuntimePathResolution {
  all b: BinaryPath |
    b.resolvedAtRuntime = True and b.hardcoded = False
}

-- @requirement XPLAT-02
-- Cross-platform: paths must support at least 2 platforms
fact CrossPlatformPaths {
  all b: BinaryPath |
    #b.supportedPlatforms >= 2
}

run {} for 5

-- @requirement XPLAT-01
-- Assert: no hardcoded paths exist in the configuration
assert NoHardcodedPaths {
  no b: BinaryPath | b.hardcoded = True
}
check NoHardcodedPaths for 5

-- @requirement SETUP-02
-- Assert: auth type is always explicitly sourced, never inferred
assert AuthTypeNotInferred {
  all s: Slot | s.authFromProvidersJson = True
}
check AuthTypeNotInferred for 5

-- @requirement SETUP-01
-- Assert: at least one native CLI slot exists
assert NativeCliExists {
  some s: Slot | s.isNativeCli = True
}
check NativeCliExists for 5

-- @requirement XPLAT-02
-- Assert: all paths are cross-platform
assert AllPathsCrossPlatform {
  all b: BinaryPath | #b.supportedPlatforms >= 2
}
check AllPathsCrossPlatform for 5

-- .planning/formal/alloy/ci-test-fallback.als
-- Models CI test fallback behavior: file enumeration via find, per-file timeout,
-- global timeout, and timeout-as-pass-with-warning when task-specific tests passed.
-- Source: bin/run-formal-verify.cjs, .github/workflows/
--
-- @requirement CI-04

module ci_test_fallback

abstract sig Bool {}
one sig True, False extends Bool {}

-- Test file discovery strategy
abstract sig DiscoveryMethod {}
one sig FindEnumeration, RawGlob extends DiscoveryMethod {}

-- Timeout configuration (modeled as singleton constants, not Int)
abstract sig TimeoutConfig {}
one sig PerFile15s, Global5min extends TimeoutConfig {}

-- @requirement CI-04
-- Full-suite test fallback uses find, never raw globs
one sig TestSuite {
  discoveryMethod: one DiscoveryMethod,
  perFileTimeout: one TimeoutConfig,
  globalTimeout: one TimeoutConfig,
  taskSpecificPassed: one Bool
}

-- @requirement CI-04
-- Timeout result interpretation
abstract sig TimeoutResult {}
one sig PassWithWarning, HardFail extends TimeoutResult {}

one sig TimeoutBehavior {
  result: one TimeoutResult
}

-- @requirement CI-04
-- Discovery must use find, never raw globs
fact DiscoveryViaFind {
  TestSuite.discoveryMethod = FindEnumeration
}

-- @requirement CI-04
-- Per-file timeout is 15s, global is 5min
fact TimeoutConstants {
  TestSuite.perFileTimeout = PerFile15s
  TestSuite.globalTimeout = Global5min
}

-- @requirement CI-04
-- Timeout treated as pass-with-warning when task-specific tests already passed
fact TimeoutAsPassWhenTaskPassed {
  TestSuite.taskSpecificPassed = True implies
    TimeoutBehavior.result = PassWithWarning
}

-- @requirement CI-04
-- Timeout is hard fail when task-specific tests did not pass
fact TimeoutAsFailWhenTaskNotPassed {
  TestSuite.taskSpecificPassed = False implies
    TimeoutBehavior.result = HardFail
}

run {} for 3

-- @requirement CI-04
assert NeverUsesRawGlobs {
  TestSuite.discoveryMethod = FindEnumeration
}
check NeverUsesRawGlobs for 3

-- @requirement CI-04
assert TimeoutCorrectBehavior {
  TestSuite.taskSpecificPassed = True implies
    TimeoutBehavior.result = PassWithWarning
}
check TimeoutCorrectBehavior for 3

-- @requirement CI-04
assert TimeoutConstantsCorrect {
  TestSuite.perFileTimeout = PerFile15s and
  TestSuite.globalTimeout = Global5min
}
check TimeoutConstantsCorrect for 3

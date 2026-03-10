-- .planning/formal/alloy/reliability-hardening.als
-- Models reliability hardening: graceful degradation for external service
-- failures and progress indication with cancellation for long-running ops.
-- Source: qgsd-baseline requirements
--
-- @requirement REL-03
-- @requirement REL-04

module reliability_hardening

abstract sig Bool {}
one sig True, False extends Bool {}

-- External services that can fail
abstract sig ExternalService {}
sig APIService, DatabaseService, ThirdPartySDK extends ExternalService {}

abstract sig FailureResponse {}
one sig GracefulDegradation, ApplicationCrash extends FailureResponse {}

-- @requirement REL-03
-- Failures in external services are caught and handled gracefully —
-- the application degrades functionality rather than crashing
sig ExternalServiceCall {
  target: one ExternalService,
  failureCaught: one Bool,
  response: one FailureResponse
}

-- @requirement REL-03
-- All external service failures must be caught with graceful degradation
fact ExternalFailuresHandled {
  all sc: ExternalServiceCall |
    sc.failureCaught = True and sc.response = GracefulDegradation
}

assert NoCrashOnServiceFailure {
  no sc: ExternalServiceCall | sc.response = ApplicationCrash
}

assert AllFailuresCaught {
  no sc: ExternalServiceCall | sc.failureCaught = False
}

-- @requirement REL-04
-- Long-running operations show progress and can be cancelled
sig Operation {
  durationExceeds2s: one Bool,
  showsProgress: one Bool,
  cancellable: one Bool
}

-- @requirement REL-04
-- Long-running operations (>2s) must show progress and be cancellable
fact LongOpsProgressAndCancel {
  all op: Operation |
    op.durationExceeds2s = True implies
      (op.showsProgress = True and op.cancellable = True)
}

assert LongOpsAlwaysShowProgress {
  all op: Operation |
    op.durationExceeds2s = True implies op.showsProgress = True
}

assert LongOpsAlwaysCancellable {
  all op: Operation |
    op.durationExceeds2s = True implies op.cancellable = True
}

-- Verification commands
check NoCrashOnServiceFailure for 5
check AllFailuresCaught for 5
check LongOpsAlwaysShowProgress for 5
check LongOpsAlwaysCancellable for 5

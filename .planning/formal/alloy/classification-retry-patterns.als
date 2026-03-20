-- .planning/formal/alloy/classification-retry-patterns.als
-- Models classifyWithHaiku retry logic and classifyTlcFailure pattern matching.
--
-- @requirement CLASS-02
-- @requirement CLASS-03

module classification_retry_patterns

-- ============================================================
-- CLASS-02: classifyWithHaiku retry + error tracking
-- ============================================================

abstract sig Bool {}
one sig True, False extends Bool {}

-- Error types tracked by classifyWithHaiku stats
-- @requirement CLASS-02
abstract sig ErrorType {}
one sig Timeout, ParseError, ApiError, CliNotFound extends ErrorType {}

-- A classification batch that may fail
sig Batch {
  attempted: one Bool,
  retried: one Bool,
  succeeded: one Bool,
  errorType: lone ErrorType
}

-- Stats object tracking error_types breakdown and failed_items
-- @requirement CLASS-02
one sig Stats {
  errorTypes: set ErrorType,
  failedItems: set Batch,
  totalRetries: one Int
} {
  totalRetries >= 0
  totalRetries <= #Batch
}

-- @requirement CLASS-02
-- Failed batches are retried exactly once with 2s backoff
fact RetryFailedBatchesOnce {
  all b: Batch |
    (b.attempted = True and b.succeeded = False) implies b.retried = True
}

-- @requirement CLASS-02
-- A batch cannot be retried if it was not first attempted
fact RetryRequiresAttempt {
  all b: Batch |
    b.retried = True implies b.attempted = True
}

-- @requirement CLASS-02
-- Failed items with errors are tracked in stats
fact FailedItemsTracked {
  all b: Batch |
    (b.succeeded = False and b.attempted = True) implies
      (b in Stats.failedItems and b.errorType in Stats.errorTypes)
}

-- @requirement CLASS-02
-- Successful batches have no error type
fact SuccessNoError {
  all b: Batch |
    b.succeeded = True implies no b.errorType
}

-- ============================================================
-- CLASS-03: classifyTlcFailure ordered pattern matching
-- ============================================================

-- The 6 TLC failure patterns detected by the classifier
-- @requirement CLASS-03
abstract sig TlcFailureClass {}
one sig Deadlock, SanySemantic, FairnessGap,
        InvariantViolation, SyntaxError, Unknown extends TlcFailureClass {}

-- Priority ordering: earlier patterns match first
-- @requirement CLASS-03
one sig PatternPriority {
  order: TlcFailureClass -> one Int
} {
  order[Deadlock] = 1
  order[SanySemantic] = 2
  order[FairnessGap] = 3
  order[InvariantViolation] = 4
  order[SyntaxError] = 5
  order[Unknown] = 6
}

-- A TLC failure with its raw output and classification result
sig TlcFailure {
  matchedPatterns: set TlcFailureClass,
  classification: one TlcFailureClass
}

-- @requirement CLASS-03
-- Classification selects the highest-priority (lowest order number) matched pattern
fact OrderedPatternMatching {
  all f: TlcFailure |
    some f.matchedPatterns implies
      (f.classification in f.matchedPatterns and
       all other: f.matchedPatterns - f.classification |
         PatternPriority.order[f.classification] < PatternPriority.order[other])
}

-- @requirement CLASS-03
-- If no patterns match, classification is Unknown
fact NoMatchIsUnknown {
  all f: TlcFailure |
    no f.matchedPatterns implies f.classification = Unknown
}

-- @requirement CLASS-03
-- Exactly 6 failure classes exist
assert ExactlySixClasses {
  #TlcFailureClass = 6
}

-- @requirement CLASS-02
-- Every failed batch error type is one of the 4 tracked types
assert ErrorTypesComplete {
  all b: Batch |
    some b.errorType implies b.errorType in (Timeout + ParseError + ApiError + CliNotFound)
}

-- @requirement CLASS-03
-- Classification is deterministic: same matched patterns yield same result
assert ClassificationDeterministic {
  all disj f1, f2: TlcFailure |
    f1.matchedPatterns = f2.matchedPatterns implies
      f1.classification = f2.classification
}

check ExactlySixClasses for 5
check ErrorTypesComplete for 5
check ClassificationDeterministic for 5

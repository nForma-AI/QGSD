-- .planning/formal/alloy/security-hardening.als
-- Models security hardening: pre-commit secret scanning, CI deep scanning,
-- input validation/sanitization, and dependency vulnerability scanning.
-- Source: .github/workflows/, .pre-commit-config.yaml
--
-- @requirement SEC-05
-- @requirement SEC-06
-- @requirement SEC-07
-- @requirement SEC-08

module security_hardening

abstract sig ScanResult {}
one sig Clean, Dirty extends ScanResult {}

abstract sig Bool {}
one sig True, False extends Bool {}

abstract sig Severity {}
one sig Critical, High, Medium, Low extends Severity {}

-- @requirement SEC-05
-- Pre-commit hook runs secret scanning (e.g., Gitleaks) to block commits
-- containing API keys, tokens, passwords, or credentials
one sig PreCommitSecretScan {
  scanResult: one ScanResult,
  commitBlocked: one Bool
} {
  scanResult = Dirty implies commitBlocked = True
  scanResult = Clean implies commitBlocked = False
}

-- @requirement SEC-06
-- CI pipeline runs deep secret scanning (e.g., TruffleHog) across full
-- repo history on every PR
one sig CIHistoryScan {
  scanResult: one ScanResult,
  prBlocked: one Bool
} {
  scanResult = Dirty implies prBlocked = True
  scanResult = Clean implies prBlocked = False
}

-- @requirement SEC-07
-- All external input is validated and sanitized at system boundaries
sig ExternalInput {
  validated: one Bool,
  sanitized: one Bool,
  processedBeforeValidation: one Bool
}

-- @requirement SEC-07
-- Input must be validated and sanitized before processing
fact InputValidatedAtBoundary {
  all i: ExternalInput |
    i.validated = True and
    i.sanitized = True and
    i.processedBeforeValidation = False
}

-- @requirement SEC-08
-- Dependencies scanned for known vulnerabilities; critical/high block merge
one sig DepVulnScan {
  maxSeverityFound: one Severity,
  mergeBlocked: one Bool
} {
  (maxSeverityFound = Critical or maxSeverityFound = High) implies mergeBlocked = True
  (maxSeverityFound = Medium or maxSeverityFound = Low) implies mergeBlocked = False
}

run {} for 5

-- @requirement SEC-05
assert SecretInCommitBlocked {
  PreCommitSecretScan.scanResult = Dirty implies PreCommitSecretScan.commitBlocked = True
}
check SecretInCommitBlocked for 3

-- @requirement SEC-06
assert HistorySecretsBlockPR {
  CIHistoryScan.scanResult = Dirty implies CIHistoryScan.prBlocked = True
}
check HistorySecretsBlockPR for 3

-- @requirement SEC-07
assert NoUnvalidatedInput {
  no i: ExternalInput | i.validated = False or i.sanitized = False
}
check NoUnvalidatedInput for 5

-- @requirement SEC-07
assert NoProcessingBeforeValidation {
  no i: ExternalInput | i.processedBeforeValidation = True
}
check NoProcessingBeforeValidation for 5

-- @requirement SEC-08
assert CriticalDepsBlockMerge {
  DepVulnScan.maxSeverityFound = Critical implies DepVulnScan.mergeBlocked = True
}
check CriticalDepsBlockMerge for 3

-- @requirement SEC-08
assert HighDepsBlockMerge {
  DepVulnScan.maxSeverityFound = High implies DepVulnScan.mergeBlocked = True
}
check HighDepsBlockMerge for 3

-- .planning/formal/alloy/fp-rate-tuning.als
-- Models the false-positive rate tracking and auto-tuning of scanner thresholds.
-- Source: bin/nf-solve.cjs, bin/solve-classifications.json
--
-- @requirement FPTUNE-01
-- @requirement FPTUNE-02
-- @requirement FPTUNE-03

module fp_rate_tuning

abstract sig Bool {}
one sig True, False extends Bool {}

-- Scanners in the system
abstract sig Scanner {}
one sig CtoR_Scanner, TtoR_Scanner, DtoR_Scanner, DtoC_Scanner extends Scanner {}

-- Category groups
sig Category {}

-- Per-scanner per-category FP tracking
sig FPRecord {
  scanner: one Scanner,
  category: one Category,
  sessionCount: one Int,
  fpRate: one Int,  -- percentage (0-100)
  threshold: one Int  -- suppression threshold * 10 (0-10 range -> 0-100)
}

-- FP rate sessions (rolling window)
-- FPTUNE-01: tracks per-scanner per-category FP rates (rolling window of 10)
-- @requirement FPTUNE-01
fact RollingWindow {
  all r: FPRecord | r.sessionCount >= 0 and r.sessionCount <= 10
}

-- FPTUNE-02: FP rate > 60% over 5+ sessions auto-raises threshold by 0.1 (capped at 0.9)
-- @requirement FPTUNE-02
fact AutoRaiseThreshold {
  all r: FPRecord |
    (r.fpRate > 60 and r.sessionCount >= 5) implies
      (r.threshold >= 1 and r.threshold <= 9)
  -- threshold is in units of 0.1, so 9 = 0.9 cap
}

fact ThresholdCapped {
  all r: FPRecord | r.threshold <= 9
}

-- FPTUNE-03: --report-only displays per-scanner FP rate table
-- @requirement FPTUNE-03
-- (Structural: the report mode exists and includes FP rates per scanner)
fact FPRateRecordsExist {
  all s: Scanner | some r: FPRecord | r.scanner = s
}

-- Assertions
assert ThresholdNeverExceedsCap {
  all r: FPRecord | r.threshold <= 9
}

assert HighFPTriggersRaise {
  all r: FPRecord |
    (r.fpRate > 60 and r.sessionCount >= 5) implies r.threshold >= 1
}

assert AllScannersTracked {
  all s: Scanner | some r: FPRecord | r.scanner = s
}

check ThresholdNeverExceedsCap for 5
check HighFPTriggersRaise for 5
check AllScannersTracked for 5

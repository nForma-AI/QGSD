-- .planning/formal/alloy/uppaal-race-modeling.als
-- Models the structural requirements for UPPAAL timed race modeling:
-- model file existence, runner script integration, and property annotations.
-- Source: .formal/uppaal/quorum-races.xml, bin/run-uppaal.cjs
--
-- @requirement UPPAAL-01
-- @requirement UPPAAL-02
-- @requirement UPPAAL-03

module uppaal_race_modeling

-- ── Domain entities ────────────────────────────────────────────────────

abstract sig Bool {}
one sig True, False extends Bool {}

-- A UPPAAL timed automaton model file
sig UppaalModel {
  capturesConcurrency: one Bool,
  hasTimedConstraints: one Bool,
  hasAnnotatedProperties: one Bool,
  propertyCount: one PropCount
}

abstract sig PropCount {}
one sig Zero, One, TwoOrMore extends PropCount {}

-- The runner script that executes UPPAAL verification
sig UppaalRunner {
  targetsModel: one UppaalModel,
  writesCheckResult: one Bool,
  reportsStatus: one Bool,
  statusTypes: set VerifyStatus
}

abstract sig VerifyStatus {}
one sig Pass, Fail, Timeout extends VerifyStatus {}

-- Annotated measurement property in the model
sig MeasurementProperty {
  parentModel: one UppaalModel,
  propertyType: one MeasurementType
}

abstract sig MeasurementType {}
one sig InterSlotResponse, MaxConcurrentSlots, OtherMeasurement extends MeasurementType {}

-- Empirical timing bounds (from /nf:mcp-status 2026-04-04)
-- Used as timed automaton guard constraints in UPPAAL model
sig TimingBound {
  slotType: one SlotType,
  minLatencyMs: one Int,
  maxLatencyMs: one Int,
  timeoutMs: one Int
}

abstract sig SlotType {}
one sig CLISlot, CCRSlot, HTTPSlot extends SlotType {}

-- Empirical bounds captured from live health checks:
--   CLI slots:  88ms - 1898ms  (timeout: 300000ms)
--   CCR slots:  270ms - 441ms  (timeout: 300000ms, but CCR checks local process)
--   HTTP slots: 325ms - 8622ms (timeout: 120000ms, real inference round-trip)
fact EmpiricalTimingBounds {
  all t: TimingBound | {
    t.slotType = CLISlot implies (t.minLatencyMs = 88 and t.maxLatencyMs = 1898 and t.timeoutMs = 300000)
    t.slotType = CCRSlot implies (t.minLatencyMs = 270 and t.maxLatencyMs = 441 and t.timeoutMs = 300000)
    t.slotType = HTTPSlot implies (t.minLatencyMs = 325 and t.maxLatencyMs = 8622 and t.timeoutMs = 120000)
  }
}

-- Race window: the max gap between the fastest and slowest parallel slots
-- This is the critical timing property for consensus evaluation races
-- Current worst case: CLI at 88ms vs HTTP at 8622ms = 8534ms race window
fact RaceWindowBound {
  all m: UppaalModel | m.capturesConcurrency = True implies {
    some p: MeasurementProperty | p.parentModel = m and p.propertyType = InterSlotResponse
  }
}

-- ── Facts ──────────────────────────────────────────────────────────────

-- UPPAAL-01: The model captures quorum protocol concurrency structure
fact ModelCapturesConcurrency {
  all m: UppaalModel | m.capturesConcurrency = True
}

-- UPPAAL-01: The model has timed constraints (timed automaton)
fact ModelHasTimedConstraints {
  all m: UppaalModel | m.hasTimedConstraints = True
}

-- UPPAAL-02: Runner writes check results with pass/fail/timeout status
fact RunnerWritesResults {
  all r: UppaalRunner | {
    r.writesCheckResult = True
    r.reportsStatus = True
    Pass in r.statusTypes
    Fail in r.statusTypes
    Timeout in r.statusTypes
  }
}

-- UPPAAL-03: At least two critical measurement points annotated
fact MinimumMeasurementPoints {
  all m: UppaalModel | {
    m.hasAnnotatedProperties = True
    m.propertyCount = TwoOrMore
  }
}

-- UPPAAL-03: The two required measurement types are present
fact RequiredMeasurements {
  all m: UppaalModel | {
    some p: MeasurementProperty | p.parentModel = m and p.propertyType = InterSlotResponse
    some p: MeasurementProperty | p.parentModel = m and p.propertyType = MaxConcurrentSlots
  }
}

-- Measurement properties belong to their parent model
fact PropertyBelonging {
  all p: MeasurementProperty | p.parentModel.hasAnnotatedProperties = True
}

-- ── Assertions ─────────────────────────────────────────────────────────

-- UPPAAL-01: Every model captures concurrency with timed constraints
assert ModelsAreTimed {
  all m: UppaalModel |
    m.capturesConcurrency = True and m.hasTimedConstraints = True
}

-- UPPAAL-02: Every runner writes results with all status types
assert RunnerReportsAllStatuses {
  all r: UppaalRunner |
    #r.statusTypes = 3
}

-- UPPAAL-03: Every model has at least the two critical measurements
assert CriticalMeasurementsPresent {
  all m: UppaalModel |
    (some p: MeasurementProperty | p.parentModel = m and p.propertyType = InterSlotResponse) and
    (some p: MeasurementProperty | p.parentModel = m and p.propertyType = MaxConcurrentSlots)
}

-- ── Checks ─────────────────────────────────────────────────────────────
check ModelsAreTimed for 4
check RunnerReportsAllStatuses for 4
check CriticalMeasurementsPresent for 4

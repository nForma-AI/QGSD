-- .planning/formal/alloy/agent-fsm-detection.als
-- Models the phase researcher agent's implicit FSM pattern detection
-- and structured output in RESEARCH.md.
--
-- @requirement AGENT-04

module agent_fsm_detection

abstract sig Bool {}
one sig True, False extends Bool {}

-- A source code file that may contain implicit FSM patterns
sig CodeFile {
  hasMultiFlagBoolean: one Bool,
  hasEnumStringState: one Bool,
  flagCount: one Int,
  enumCount: one Int
} {
  flagCount >= 0
  enumCount >= 0
}

-- @requirement AGENT-04
-- Detection thresholds: >= 3 flags or >= 3 enum comparisons
fact DetectionThreshold {
  all f: CodeFile | {
    f.hasMultiFlagBoolean = True iff f.flagCount >= 3
    f.hasEnumStringState = True iff f.enumCount >= 3
  }
}

-- An FSM candidate surfaced by the researcher agent
sig FsmCandidate {
  sourceFile: one CodeFile,
  detectionType: one DetectionMethod,
  inResearchOutput: one Bool
}

abstract sig DetectionMethod {}
one sig MultiFlagBoolean, EnumStringState extends DetectionMethod {}

-- @requirement AGENT-04
-- Candidates are created only for files exceeding detection threshold
fact CandidatesFromDetection {
  all c: FsmCandidate |
    (c.detectionType = MultiFlagBoolean implies c.sourceFile.hasMultiFlagBoolean = True) and
    (c.detectionType = EnumStringState implies c.sourceFile.hasEnumStringState = True)
}

-- @requirement AGENT-04
-- All candidates must appear in structured RESEARCH.md output
fact CandidatesInOutput {
  all c: FsmCandidate | c.inResearchOutput = True
}

-- The RESEARCH.md output table
one sig ResearchOutput {
  candidates: set FsmCandidate
}

-- @requirement AGENT-04
-- Research output contains exactly the detected candidates
fact OutputCompleteness {
  ResearchOutput.candidates = FsmCandidate
}

-- @requirement AGENT-04
-- A file with both patterns generates two separate candidates
assert DualDetectionCreatesTwoCandidates {
  all f: CodeFile |
    (f.hasMultiFlagBoolean = True and f.hasEnumStringState = True) implies
      #{ c: FsmCandidate | c.sourceFile = f } >= 2
}

-- @requirement AGENT-04
-- Files below threshold generate no candidates
assert NoCandidatesBelowThreshold {
  all f: CodeFile |
    (f.hasMultiFlagBoolean = False and f.hasEnumStringState = False) implies
      no { c: FsmCandidate | c.sourceFile = f }
}

check DualDetectionCreatesTwoCandidates for 4
check NoCandidatesBelowThreshold for 4

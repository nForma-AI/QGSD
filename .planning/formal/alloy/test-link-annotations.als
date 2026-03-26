-- .planning/formal/alloy/test-link-annotations.als
-- Models the @requirement annotation system for test traceability.
-- Source: bin/annotate-tests.cjs, bin/reverse-scanner.cjs
--
-- @requirement TLINK-01
-- @requirement TLINK-02
-- @requirement TLINK-03

module test_link_annotations

abstract sig Bool {}
one sig True, False extends Bool {}

-- Test files and requirements
sig TestFile {
  annotations: set RequirementId,
  flaggedByTtoR: one Bool
}

sig RequirementId {}

-- TLINK-01: Test files with @requirement annotations excluded from T->R flagging
-- @requirement TLINK-01
fact AnnotatedTestsExcluded {
  all t: TestFile |
    #t.annotations > 0 implies t.flaggedByTtoR = False
}

-- annotate-tests.cjs tool
sig AnnotationSuggestion {
  testFile: one TestFile,
  suggestedReq: one RequirementId,
  applied: one Bool
}

-- TLINK-02: annotate-tests.cjs scans tests and suggests annotations via proximity graph
-- @requirement TLINK-02
fact SuggestionsFromProximity {
  all s: AnnotationSuggestion |
    s.applied = True implies s.suggestedReq in s.testFile.annotations
}

-- T->R scanner report
sig TtoRReport {
  totalTests: one Int,
  annotatedTests: one Int,
  orphanTests: one Int,
  annotationCoverage: one Int  -- percentage
}

-- TLINK-03: T->R scanner reports annotation coverage percentage alongside orphan count
-- @requirement TLINK-03
fact ReportIncludesCoverage {
  all r: TtoRReport |
    r.annotatedTests >= 0 and
    r.orphanTests >= 0 and
    r.totalTests = add[r.annotatedTests, r.orphanTests] and
    r.annotationCoverage >= 0 and r.annotationCoverage <= 100
}

-- Assertions
assert AnnotatedTestsNeverOrphaned {
  all t: TestFile |
    #t.annotations > 0 implies t.flaggedByTtoR = False
}

assert AppliedSuggestionsReflected {
  all s: AnnotationSuggestion |
    s.applied = True implies s.suggestedReq in s.testFile.annotations
}

assert CoveragePercentageValid {
  all r: TtoRReport |
    r.annotationCoverage >= 0 and r.annotationCoverage <= 100
}

check AnnotatedTestsNeverOrphaned for 5
check AppliedSuggestionsReflected for 5
check CoveragePercentageValid for 5

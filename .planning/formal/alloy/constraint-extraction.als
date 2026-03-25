-- .planning/formal/alloy/constraint-extraction.als
-- Models constraint extraction from formal specs and injection into prompts.
-- model-constrained-fix.cjs parses TLA+/Alloy specs to extract constraints,
-- renders them as plain-English summaries, and injects into edit prompts.
-- Source: bin/model-constrained-fix.cjs, hooks/nf-prompt.js
--
-- @requirement CEX-01
-- @requirement CEX-02
-- @requirement CEX-03
-- @requirement CONST-01
-- @requirement CONST-02

module constraint_extraction

-- ── Domain entities ────────────────────────────────────────────────────

-- Formal spec types that can be parsed
abstract sig SpecType {}
one sig TLAPlus, Alloy extends SpecType {}

-- A formal specification file
sig FormalSpec {
  specType: one SpecType,
  hasInvariants: one Bool,
  hasAssertions: one Bool,
  hasStateVars: one Bool,
  hasTransitions: one Bool,
  hasSigConstraints: one Bool
}

abstract sig Bool {}
one sig True, False extends Bool {}

-- Extracted constraint from a formal spec
sig ExtractedConstraint {
  sourceSpec: one FormalSpec,
  constraintType: one ConstraintType,
  hasPlainEnglish: one Bool
}

abstract sig ConstraintType {}
one sig InvariantDef, AssertionDef, StateVarDef, TransitionPrecon, SigConstraintDef extends ConstraintType {}

-- A user prompt that may receive constraint injection
sig UserPrompt {
  isEditPrompt: one Bool,
  isNewFeature: one Bool,
  injectedConstraints: set ExtractedConstraint
}

-- ── Facts ──────────────────────────────────────────────────────────────

-- CEX-01: TLA+ parsing extracts invariants, state vars, and transition preconditions
fact TLAParsing {
  all s: FormalSpec | s.specType = TLAPlus => {
    -- TLA+ specs can have invariants, state vars, and transitions
    (s.hasInvariants = True or s.hasInvariants = False)
    (s.hasStateVars = True or s.hasStateVars = False)
    (s.hasTransitions = True or s.hasTransitions = False)
    -- TLA+ specs do not have Alloy-style sig constraints
    s.hasSigConstraints = False
  }
}

-- CEX-02: Alloy parsing extracts assertions and signature constraints
fact AlloyParsing {
  all s: FormalSpec | s.specType = Alloy => {
    (s.hasAssertions = True or s.hasAssertions = False)
    (s.hasSigConstraints = True or s.hasSigConstraints = False)
    -- Alloy does not have TLA+-style transition preconditions
    s.hasTransitions = False
  }
}

-- CEX-01/CEX-02: Extracted constraints must come from specs that have the relevant feature
fact ConstraintSourceValidity {
  all c: ExtractedConstraint | {
    c.constraintType = InvariantDef => c.sourceSpec.hasInvariants = True
    c.constraintType = AssertionDef => c.sourceSpec.hasAssertions = True
    c.constraintType = StateVarDef => c.sourceSpec.hasStateVars = True
    c.constraintType = TransitionPrecon => c.sourceSpec.hasTransitions = True
    c.constraintType = SigConstraintDef => c.sourceSpec.hasSigConstraints = True
  }
}

-- CEX-03: All extracted constraints have plain-English summaries
fact PlainEnglishRendering {
  all c: ExtractedConstraint | c.hasPlainEnglish = True
}

-- CONST-01: Edit prompts receive constraint injection
fact EditPromptInjection {
  all p: UserPrompt | p.isEditPrompt = True => #p.injectedConstraints > 0
}

-- CONST-02: New-feature prompts do NOT receive injection (pattern-matched)
fact NewFeatureExclusion {
  all p: UserPrompt | p.isNewFeature = True => #p.injectedConstraints = 0
}

-- Prompts are either edit or new-feature (mutually exclusive for injection purposes)
fact PromptClassification {
  all p: UserPrompt | not (p.isEditPrompt = True and p.isNewFeature = True)
}

-- ── Assertions ─────────────────────────────────────────────────────────

-- CEX-01: TLA+ specs yield invariant/state-var/transition constraints
assert TLAExtractsCorrectTypes {
  all c: ExtractedConstraint | c.sourceSpec.specType = TLAPlus =>
    c.constraintType in (InvariantDef + StateVarDef + TransitionPrecon)
}

-- CEX-02: Alloy specs yield assertion/sig-constraint types
assert AlloyExtractsCorrectTypes {
  all c: ExtractedConstraint | c.sourceSpec.specType = Alloy =>
    c.constraintType in (AssertionDef + SigConstraintDef)
}

-- CEX-03: Every constraint has plain English summary
assert AllConstraintsHaveSummary {
  all c: ExtractedConstraint | c.hasPlainEnglish = True
}

-- CONST-01: Every edit prompt gets constraints
assert EditPromptsGetConstraints {
  all p: UserPrompt | p.isEditPrompt = True => some p.injectedConstraints
}

-- CONST-02: New feature prompts never get constraints
assert NewFeaturesNoConstraints {
  all p: UserPrompt | p.isNewFeature = True => no p.injectedConstraints
}

-- ── Checks ─────────────────────────────────────────────────────────────
check TLAExtractsCorrectTypes for 5
check AlloyExtractsCorrectTypes for 5
check AllConstraintsHaveSummary for 5
check EditPromptsGetConstraints for 5
check NewFeaturesNoConstraints for 5

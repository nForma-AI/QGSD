-- .planning/formal/alloy/root-cause-enforcement.als
-- Models root cause reasoning template injection: debug/fix/investigate
-- prompts receive a root-cause template. Non-debug prompts do not.
-- Fail-open: injection errors are silently skipped.
-- Source: hooks/nf-prompt.js
--
-- @requirement ROOT-01
-- @requirement ROOT-03

module root_cause_enforcement

-- ── Domain entities ────────────────────────────────────────────────────

abstract sig Bool {}
one sig True, False extends Bool {}

-- Pattern types recognized in user prompts
abstract sig PromptPattern {}
one sig DebugPattern, FixPattern, InvestigatePattern, FeaturePattern, QuestionPattern extends PromptPattern {}

-- A user prompt submitted to the system
sig UserPrompt {
  matchedPattern: one PromptPattern,
  isDebugFix: one Bool,
  templateInjected: one Bool,
  injectionErrored: one Bool
}

-- ── Facts ──────────────────────────────────────────────────────────────

-- Classification: debug/fix/investigate patterns are debug-fix prompts
fact PatternClassification {
  all p: UserPrompt | {
    p.matchedPattern in (DebugPattern + FixPattern + InvestigatePattern) <=> p.isDebugFix = True
  }
}

-- ROOT-01: Debug/fix prompts receive template injection
fact DebugPromptsGetTemplate {
  all p: UserPrompt |
    (p.isDebugFix = True and p.injectionErrored = False) => p.templateInjected = True
}

-- ROOT-03: Non-debug prompts do NOT receive template injection
fact NonDebugNoTemplate {
  all p: UserPrompt |
    p.isDebugFix = False => p.templateInjected = False
}

-- ROOT-03: Fail-open — injection errors result in no injection, not error
fact FailOpen {
  all p: UserPrompt |
    p.injectionErrored = True => p.templateInjected = False
}

-- ── Assertions ─────────────────────────────────────────────────────────

-- ROOT-01: All debug/fix prompts get the template (when no error)
assert DebugFixGetsTemplate {
  all p: UserPrompt |
    (p.isDebugFix = True and p.injectionErrored = False) => p.templateInjected = True
}

-- ROOT-03: Feature and question prompts never get the template
assert NonDebugNeverGetsTemplate {
  all p: UserPrompt |
    p.matchedPattern in (FeaturePattern + QuestionPattern) => p.templateInjected = False
}

-- ROOT-03: Fail-open behavior — errors do not propagate
assert ErrorsAreSwallowed {
  all p: UserPrompt |
    p.injectionErrored = True => p.templateInjected = False
}

-- No prompt both gets and does not get injection (consistency)
assert ConsistentInjection {
  all p: UserPrompt |
    not (p.templateInjected = True and p.isDebugFix = False)
}

-- ── Checks ─────────────────────────────────────────────────────────────
check DebugFixGetsTemplate for 6
check NonDebugNeverGetsTemplate for 6
check ErrorsAreSwallowed for 6
check ConsistentInjection for 6

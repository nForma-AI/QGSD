-- .planning/formal/alloy/dispatch-formal-context.als
-- Models quorum dispatch prompt injection of formal requirements.
-- Source: bin/quorum-slot-dispatch.cjs, hooks/qgsd-prompt.js
--
-- @requirement DISP-06

module dispatch_formal_context

abstract sig Bool {}
one sig True, False extends Bool {}

-- A formal requirement from .formal/requirements.json
sig FormalRequirement {
  keywords: set Keyword,
  artifactPaths: set ArtifactPath
}

sig Keyword {}
sig ArtifactPath {}

-- A quorum dispatch prompt
sig DispatchPrompt {
  questionKeywords: set Keyword,
  artifactPath: lone ArtifactPath,
  injectedRequirements: set FormalRequirement
}

-- @requirement DISP-06
-- Requirements are injected based on keyword match OR artifact path match
fact InjectedByMatch {
  all dp: DispatchPrompt, fr: FormalRequirement |
    fr in dp.injectedRequirements iff (
      some dp.questionKeywords & fr.keywords or
      (some dp.artifactPath and dp.artifactPath in fr.artifactPaths)
    )
}

-- @requirement DISP-06
-- A prompt with no matching keywords and no artifact path gets no injected requirements
fact NoMatchNoInjection {
  all dp: DispatchPrompt |
    (no dp.questionKeywords and no dp.artifactPath) implies no dp.injectedRequirements
}

run {} for 5

-- @requirement DISP-06
-- If a requirement matches by keyword, it must be injected
assert KeywordMatchImpliesInjection {
  all dp: DispatchPrompt, fr: FormalRequirement |
    (some dp.questionKeywords & fr.keywords) implies fr in dp.injectedRequirements
}
check KeywordMatchImpliesInjection for 5

-- @requirement DISP-06
-- If a requirement matches by artifact path, it must be injected
assert ArtifactMatchImpliesInjection {
  all dp: DispatchPrompt, fr: FormalRequirement |
    (some dp.artifactPath and dp.artifactPath in fr.artifactPaths) implies
      fr in dp.injectedRequirements
}
check ArtifactMatchImpliesInjection for 5

-- @requirement DISP-06
-- No spurious injection — only matched requirements are injected
assert NoSpuriousInjection {
  all dp: DispatchPrompt, fr: FormalRequirement |
    fr in dp.injectedRequirements implies (
      some dp.questionKeywords & fr.keywords or
      (some dp.artifactPath and dp.artifactPath in fr.artifactPaths)
    )
}
check NoSpuriousInjection for 5

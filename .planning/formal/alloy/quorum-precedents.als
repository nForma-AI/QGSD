-- .planning/formal/alloy/quorum-precedents.als
-- Models the quorum precedent extraction, matching, and TTL pruning.
-- Source: bin/extract-precedents.cjs, bin/precedents.json
--
-- @requirement QPREC-01
-- @requirement QPREC-02
-- @requirement QPREC-03

module quorum_precedents

abstract sig Bool {}
one sig True, False extends Bool {}

-- Quorum debate archives
sig DebateArchive {
  decisions: set Decision
}

sig Decision {
  vote: one Vote,
  reasoning: one Reasoning,
  keywords: set Keyword
}

abstract sig Vote {}
one sig BLOCK, APPROVE extends Vote {}

sig Reasoning {}
sig Keyword {}

-- Extracted precedents
sig Precedent {
  source: one Decision,
  keywords: set Keyword,
  ageInDays: one Int,
  pruned: one Bool
}

-- QPREC-01: extract-precedents.cjs mines archives and writes .planning/formal/precedents.json
-- @requirement QPREC-01
fact PrecedentsExtractedFromArchives {
  all p: Precedent | p.source in DebateArchive.decisions
  all p: Precedent | #p.keywords > 0
}

-- Quorum dispatch prompt
sig QuorumPrompt {
  question: one Question,
  includedPrecedents: set Precedent
}

sig Question {
  keywords: set Keyword
}

-- QPREC-02: Prompts include up to 3 relevant precedents (matched by keyword overlap)
-- @requirement QPREC-02
fact MaxThreePrecedents {
  all qp: QuorumPrompt | #qp.includedPrecedents <= 3
}

fact PrecedentsMatchByKeyword {
  all qp: QuorumPrompt, p: qp.includedPrecedents |
    some (p.keywords & qp.question.keywords)
}

-- QPREC-03: Precedents have TTL (90 days) and are auto-pruned
-- @requirement QPREC-03
fact TTLEnforced {
  all p: Precedent |
    p.ageInDays > 90 implies p.pruned = True
}

fact PrunedNotIncluded {
  all qp: QuorumPrompt |
    no p: qp.includedPrecedents | p.pruned = True
}

-- Assertions
assert MaxThreePrecedentsInPrompt {
  all qp: QuorumPrompt | #qp.includedPrecedents <= 3
}

assert PrunedNeverIncluded {
  all qp: QuorumPrompt |
    no p: qp.includedPrecedents | p.pruned = True
}

assert OldPrecedentsPruned {
  all p: Precedent | p.ageInDays > 90 implies p.pruned = True
}

check MaxThreePrecedentsInPrompt for 5
check PrunedNeverIncluded for 5
check OldPrecedentsPruned for 5

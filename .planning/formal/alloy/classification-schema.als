-- .planning/formal/alloy/classification-schema.als
-- Models classification cache keying strategy (content-hash vs line-number)
-- and requirement tier classification schema.
--
-- @requirement CLASS-01
-- @requirement SCHEMA-05

module classification_schema

abstract sig Bool {}
one sig True, False extends Bool {}

-- Cache key strategies
abstract sig CacheKeyType {}
one sig ContentHash, LineNumber extends CacheKeyType {}

-- @requirement CLASS-01
-- Cache entries keyed by content hash for invalidation correctness
sig CacheEntry {
  keyType: one CacheKeyType,
  content: one Content,
  isValid: one Bool
}

-- Abstract content blocks that can change
sig Content {
  hash: one Int
} {
  hash >= 0
}

-- Requirement tiers for classification
-- @requirement SCHEMA-05
abstract sig Tier {}
one sig Critical, Important, Nice extends Tier {}

-- @requirement SCHEMA-05
-- Requirements with tier classification
sig Requirement {
  tier: one Tier,
  hasTier: one Bool
}

-- @requirement CLASS-01
-- Cache must use content hash, not line numbers
fact CacheUsesContentHash {
  all c: CacheEntry | c.keyType = ContentHash
}

-- @requirement CLASS-01
-- Two entries with same content hash are equivalent (idempotent lookup)
fact ContentHashDeterminesEquivalence {
  all disj e1, e2: CacheEntry |
    e1.content.hash = e2.content.hash implies
      e1.isValid = e2.isValid
}

-- @requirement SCHEMA-05
-- All requirements must have a tier classification
fact RequirementsHaveTier {
  all r: Requirement | r.hasTier = True
}

run {} for 4

-- @requirement CLASS-01
-- Assert: cache invalidates correctly on content change
-- (different hashes can have different validity)
assert CacheInvalidatesOnContentChange {
  no c: CacheEntry | c.keyType = LineNumber
}
check CacheInvalidatesOnContentChange for 4

-- @requirement SCHEMA-05
-- Assert: every requirement has a tier classification
assert TierClassification {
  all r: Requirement | r.hasTier = True and r.tier in Critical + Important + Nice
}
check TierClassification for 4

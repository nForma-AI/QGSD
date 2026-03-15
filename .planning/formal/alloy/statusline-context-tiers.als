-- .planning/formal/alloy/statusline-context-tiers.als
-- Models the statusline hook context window detection and threshold scaling.
-- Source: hooks/nf-statusline.js
--
-- @requirement DIAG-10

module statusline_context_tiers

-- Context window size tiers
abstract sig ContextTier {}
-- @requirement DIAG-10
one sig Tier200K, Tier1M, TierUnknown extends ContextTier {}

-- Detection source priority
abstract sig DetectionSource {}
-- @requirement DIAG-10
one sig ExplicitProperty, DisplayNameParse, Fallback extends DetectionSource {}

-- A detection attempt reads data and resolves a tier via source
-- @requirement DIAG-10
sig Detection {
  hasExplicit: one Bool,
  hasDisplayName: one Bool,
  resolvedSource: one DetectionSource,
  resolvedTier: one ContextTier
}

abstract sig Bool {}
one sig True, False extends Bool {}

-- Priority chain: explicit > displayName > fallback
-- @requirement DIAG-10
fact detectionPriority {
  all d: Detection {
    -- Tier 1: if explicit is present, use it
    d.hasExplicit = True implies d.resolvedSource = ExplicitProperty
    -- Tier 2: if no explicit but displayName present, parse it
    (d.hasExplicit = False and d.hasDisplayName = True) implies d.resolvedSource = DisplayNameParse
    -- Tier 3: if neither, fall back to unknown
    (d.hasExplicit = False and d.hasDisplayName = False) implies (
      d.resolvedSource = Fallback and d.resolvedTier = TierUnknown
    )
  }
}

-- Threshold color zones: green < tier1_pct, yellow < tier2_pct, orange < tier3_pct, red >= tier3_pct
abstract sig ColorZone {}
one sig Green, Yellow, Orange, Red extends ColorZone {}

-- Token usage classification against a tier
-- @requirement DIAG-10
sig ThresholdCheck {
  tier: one ContextTier,
  usageFraction: one UsageBucket,
  resultColor: one ColorZone
}

-- Discretized usage fractions matching the code's 10%/20%/35% boundaries
abstract sig UsageBucket {}
one sig Below10, Below20, Below35, Above35 extends UsageBucket {}

-- @requirement DIAG-10
fact thresholdScaling {
  all tc: ThresholdCheck {
    -- When tier is known, thresholds scale proportionally
    tc.tier != TierUnknown implies {
      tc.usageFraction = Below10  implies tc.resultColor = Green
      tc.usageFraction = Below20  implies tc.resultColor = Yellow
      tc.usageFraction = Below35  implies tc.resultColor = Orange
      tc.usageFraction = Above35  implies tc.resultColor = Red
    }
    -- When tier is unknown, percentage-based fallback (different thresholds)
    tc.tier = TierUnknown implies {
      tc.usageFraction = Below10  implies tc.resultColor = Green
      tc.usageFraction = Below20  implies tc.resultColor = Green
      tc.usageFraction = Below35  implies tc.resultColor = Yellow
      tc.usageFraction = Above35  implies tc.resultColor = Red
    }
  }
}

-- Proportional scaling: 1M tier has same color zones as 200K tier
-- (the absolute token counts differ but the fraction-based zones are identical)
-- @requirement DIAG-10
assert proportionalScaling {
  all t1, t2: ThresholdCheck |
    (t1.tier != TierUnknown and t2.tier != TierUnknown and
     t1.usageFraction = t2.usageFraction)
    implies t1.resultColor = t2.resultColor
}
check proportionalScaling for 5

-- Detection always resolves to exactly one tier
-- @requirement DIAG-10
assert detectionDeterminism {
  all d: Detection | one d.resolvedTier
}
check detectionDeterminism for 5

-- Explicit property always wins if present
-- @requirement DIAG-10
assert explicitWins {
  all d: Detection | d.hasExplicit = True implies d.resolvedSource = ExplicitProperty
}
check explicitWins for 5

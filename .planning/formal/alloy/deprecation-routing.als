-- .planning/formal/alloy/deprecation-routing.als
-- Models the deprecation of /nf:model-driven-fix and routing to /nf:debug.
-- Source: commands/nf/model-driven-fix.md, commands/nf/solve-remediate.md
--
-- @requirement DEPR-01
-- @requirement DEPR-02
-- @requirement DEPR-03

module deprecation_routing

abstract sig Bool {}
one sig True, False extends Bool {}

-- Skills/commands in the system
abstract sig Skill {
  deprecated: one Bool,
  routesTo: lone Skill
}
one sig ModelDrivenFix, Debug, CloseGaps, Quick, FixTests extends Skill {}

-- Consumers that reference skills
sig Consumer {
  dispatches: one Skill
}

-- DEPR-01: model-driven-fix is deprecated, routes to debug
-- @requirement DEPR-01
fact ModelDrivenFixDeprecated {
  ModelDrivenFix.deprecated = True
  ModelDrivenFix.routesTo = Debug
}

-- DEPR-02: solve-remediate b_to_f layer dispatches through debug
-- @requirement DEPR-02
one sig SolveRemediateBtf extends Consumer {}
fact BtfDispatchesDebug {
  SolveRemediateBtf.dispatches = Debug
}

-- DEPR-03: All consumers rewired to new integration points
-- @requirement DEPR-03
fact AllConsumersRewired {
  no c: Consumer | c.dispatches = ModelDrivenFix
}

-- Non-deprecated skills do not route
fact NonDeprecatedNoRoute {
  all s: Skill | s.deprecated = False implies no s.routesTo
}
fact DebugNotDeprecated {
  Debug.deprecated = False
  CloseGaps.deprecated = False
  Quick.deprecated = False
  FixTests.deprecated = False
}

-- Assertions
assert NoConsumerUsesDeprecated {
  no c: Consumer | c.dispatches.deprecated = True
}

assert DeprecatedAlwaysRoutes {
  all s: Skill | s.deprecated = True implies some s.routesTo
}

assert BtfUsesDebug {
  SolveRemediateBtf.dispatches = Debug
}

check NoConsumerUsesDeprecated for 5
check DeprecatedAlwaysRoutes for 5
check BtfUsesDebug for 5

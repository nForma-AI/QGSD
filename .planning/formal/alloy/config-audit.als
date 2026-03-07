-- .planning/formal/alloy/config-audit.als
-- Models the config audit cross-referencing behavior.
-- Source: bin/config-audit.cjs, hooks/config-loader.js
--
-- @requirement CONF-13

module config_audit

abstract sig Bool {}
one sig True, False extends Bool {}

-- Provider slots from providers.json
sig ProviderSlot {
  hasAgentConfig: one Bool,
  authType: one AuthType
}

abstract sig AuthType {}
one sig Sub, Api extends AuthType {}

-- The merged nf.json config
one sig NfConfig {
  agentConfig: set ProviderSlot,
  quorumActive: set ProviderSlot
}

-- Config audit output
one sig AuditResult {
  allDefaultWarning: one Bool,
  missingSlots: set ProviderSlot
}

-- CONF-13: Missing slots are those in quorum_active but not in agent_config
-- @requirement CONF-13
fact MissingSlotsComputed {
  -- If quorum_active is non-empty, audit only those slots
  some NfConfig.quorumActive implies
    AuditResult.missingSlots = NfConfig.quorumActive - NfConfig.agentConfig
  -- If quorum_active is empty, audit all provider slots
  no NfConfig.quorumActive implies
    AuditResult.missingSlots = ProviderSlot - NfConfig.agentConfig
}

-- CONF-13: All-default warning fires when every configured slot has auth_type=api
-- @requirement CONF-13
fact AllDefaultAntiPattern {
  -- Warning fires when all slots in agent_config have Api auth_type
  (all s: NfConfig.agentConfig | s.authType = Api)
    implies AuditResult.allDefaultWarning = True
  -- Warning does NOT fire when at least one slot is Sub
  (some s: NfConfig.agentConfig | s.authType = Sub)
    implies AuditResult.allDefaultWarning = False
}

-- CONF-13: When agent_config is empty, all-default warning fires
-- (empty set vacuously satisfies "all s: {} | ...")
-- @requirement CONF-13
assert EmptyConfigTriggersWarning {
  no NfConfig.agentConfig implies AuditResult.allDefaultWarning = True
}

-- CONF-13: When at least one slot is Sub, no all-default warning
-- @requirement CONF-13
assert SubSlotSuppressesWarning {
  (some s: NfConfig.agentConfig | s.authType = Sub)
    implies AuditResult.allDefaultWarning = False
}

-- CONF-13: Audit always produces a result (fail-open: exits 0)
-- @requirement CONF-13
assert AuditAlwaysProducesResult {
  one AuditResult
}

-- CONF-13: T1 tier (sub slots) is empty when all-default warning fires
-- @requirement CONF-13
assert AllDefaultMeansEmptyT1 {
  AuditResult.allDefaultWarning = True implies
    no s: NfConfig.agentConfig | s.authType = Sub
}

check EmptyConfigTriggersWarning for 6
check SubSlotSuppressesWarning for 6
check AuditAlwaysProducesResult for 6
check AllDefaultMeansEmptyT1 for 6

-- formal/alloy/mcp-repair-lifecycle.als
-- Handwritten — not generated from XState.
-- Source: commands/nf/mcp-repair.md (mcp-repair skill workflow)
--
-- Models the MCP repair lifecycle for quorum slot connectivity:
--   diagnose -> classify -> auto-repair -> guide -> verify -> summarize
--
-- Assertions:
--   RepairPrecedesDiagnosis: no slot can be repaired without being diagnosed first
--   VerifyFollowsRepair: every repaired slot must be re-verified
--   ClassificationComplete: every diagnosed slot receives exactly one classification
--   NonFixableGuidance: slots classified as non-fixable receive actionable guidance
--   ReadOnlyExceptRestart: the only mutating action is pkill restart on MCP servers
--
-- @requirement DIAG-05

module mcp_repair_lifecycle

-- Slot status classifications (from mcp-repair Step 2)
abstract sig SlotStatus {}
one sig Healthy, ServerDown, AuthExpired, QuotaExhausted, Unreachable, Unknown extends SlotStatus {}

-- Whether a failure is auto-fixable
pred autoFixable [s: SlotStatus] {
  s = ServerDown  -- only ServerDown can be auto-repaired via pkill restart
}

-- A quorum slot going through the repair lifecycle
sig Slot {
  diagnosed: one Bool,
  classification: lone SlotStatus,
  repairAttempted: one Bool,
  repairSucceeded: lone Bool,
  guidanceProvided: one Bool,
  verified: one Bool
}

abstract sig Bool {}
one sig True, False extends Bool {}

-- RepairPrecedesDiagnosis: no slot can have repair attempted without diagnosis
-- @requirement DIAG-05
assert RepairPrecedesDiagnosis {
  all s: Slot |
    s.repairAttempted = True => s.diagnosed = True
}

-- VerifyFollowsRepair: every slot where repair was attempted must be re-verified
-- @requirement DIAG-05
assert VerifyFollowsRepair {
  all s: Slot |
    s.repairAttempted = True => s.verified = True
}

-- ClassificationComplete: every diagnosed slot gets exactly one classification
-- @requirement DIAG-05
assert ClassificationComplete {
  all s: Slot |
    s.diagnosed = True => one s.classification
}

-- NonFixableGuidance: slots classified as non-auto-fixable (and not healthy) receive guidance
-- @requirement DIAG-05
assert NonFixableGuidance {
  all s: Slot |
    (s.diagnosed = True and some s.classification and
     s.classification != Healthy and not autoFixable[s.classification]) =>
    s.guidanceProvided = True
}

-- ReadOnlyExceptRestart: repair is only attempted on auto-fixable (ServerDown) slots
-- @requirement DIAG-05
assert ReadOnlyExceptRestart {
  all s: Slot |
    s.repairAttempted = True => (some s.classification and autoFixable[s.classification])
}

-- Fact: model only valid lifecycle states
fact ValidLifecycle {
  -- Undiagnosed slots have no classification, no repair, no guidance, no verification
  all s: Slot |
    s.diagnosed = False => (
      no s.classification and
      s.repairAttempted = False and
      no s.repairSucceeded and
      s.guidanceProvided = False and
      s.verified = False
    )

  -- Every diagnosed slot receives exactly one classification (diagnosis always classifies)
  all s: Slot |
    s.diagnosed = True => one s.classification

  -- Diagnosed healthy slots need no repair or guidance
  all s: Slot |
    (s.diagnosed = True and s.classification = Healthy) => (
      s.repairAttempted = False and
      s.guidanceProvided = False
    )

  -- Auto-fixable slots get repair attempted
  all s: Slot |
    (s.diagnosed = True and autoFixable[s.classification]) => (
      s.repairAttempted = True and
      some s.repairSucceeded
    )

  -- Non-auto-fixable, non-healthy slots get guidance (no repair)
  all s: Slot |
    (s.diagnosed = True and
     s.classification != Healthy and not autoFixable[s.classification]) => (
      s.guidanceProvided = True and
      s.repairAttempted = False
    )

  -- Verified iff repair was attempted
  all s: Slot |
    s.verified = True <=> s.repairAttempted = True
}

check RepairPrecedesDiagnosis  for 6 Slot, 6 SlotStatus, 2 Bool
check VerifyFollowsRepair      for 6 Slot, 6 SlotStatus, 2 Bool
check ClassificationComplete   for 6 Slot, 6 SlotStatus, 2 Bool
check NonFixableGuidance       for 6 Slot, 6 SlotStatus, 2 Bool
check ReadOnlyExceptRestart    for 6 Slot, 6 SlotStatus, 2 Bool

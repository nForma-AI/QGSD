-- .planning/formal/alloy/shell-prompt-quorum-dedup.als
-- Models shell-safe prompt delivery and quorum slot model deduplication.
--
-- @requirement DEBT-12
-- @requirement DEBT-13

module shell_prompt_quorum_dedup

-- ── Shell-safe prompt delivery (DEBT-12) ─────────────────────────────────────

-- A prompt payload delivered to an agent slot
-- @requirement DEBT-12
sig Prompt {
  deliveryMethod: one DeliveryMethod,
  content: one PromptContent
}

abstract sig DeliveryMethod {}
one sig StdinPipe, DirectArg extends DeliveryMethod {}

abstract sig PromptContent {}
one sig SafeContent, UnsafeContent extends PromptContent {}

-- @requirement DEBT-12
-- Shell-safe delivery: prompts must be delivered via stdin pipe, never direct args
fact PromptDeliveredViaPipe {
  all p : Prompt | p.deliveryMethod = StdinPipe
}

-- @requirement DEBT-12
-- Stdin piping avoids shell escaping: content delivered via pipe is always safe
assert StdinPipeEliminatesEscaping {
  all p : Prompt |
    p.deliveryMethod = StdinPipe implies p.content != UnsafeContent
}
check StdinPipeEliminatesEscaping for 5 Prompt

-- ── Quorum slot model deduplication (DEBT-13) ────────────────────────────────

-- A model provider type — diversity is required across quorum slots
-- @requirement DEBT-13
abstract sig ModelProvider {}
one sig ProviderA, ProviderB, ProviderC, ProviderD extends ModelProvider {}

-- A quorum slot is assigned one model provider
-- @requirement DEBT-13
sig QuorumSlot {
  provider: one ModelProvider
}

-- A quorum is a set of slots
-- @requirement DEBT-13
sig Quorum {
  slots: some QuorumSlot
}

-- @requirement DEBT-13
-- Deduplication guarantee: no two slots in a quorum share the same provider
fact QuorumSlotDiversity {
  all q : Quorum |
    all disj s1, s2 : q.slots |
      s1.provider != s2.provider
}

-- @requirement DEBT-13
-- Every quorum has at least 2 slots (minimum for a vote)
fact MinimumQuorumSize {
  all q : Quorum | #q.slots >= 2
}

-- @requirement DEBT-13
-- Diversity is preserved: all providers in a quorum are distinct
assert AllSlotsUnique {
  all q : Quorum |
    #q.slots = #(q.slots.provider)
}
check AllSlotsUnique for 6 QuorumSlot, 4 ModelProvider, 3 Quorum

-- Satisfiability: a valid quorum configuration exists
run {} for 4 QuorumSlot, 4 ModelProvider, 2 Quorum, 4 Prompt

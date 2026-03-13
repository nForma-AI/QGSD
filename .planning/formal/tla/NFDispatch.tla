---- MODULE NFDispatch ----
(*
 * .planning/formal/tla/NFDispatch.tla
 * Models quorum dispatch integrity: prompt fidelity and slot deduplication.
 * Source: bin/quorum-slot-dispatch.cjs, hooks/nf-prompt.js
 *
 * @requirement DISPATCH-01
 * @requirement DISPATCH-02
 *)
EXTENDS Naturals, Sequences, TLC, FiniteSets

CONSTANTS MaxSlots, MaxModels

VARIABLES
    slots,           \* sequence of slot records: [model |-> ModelId, tier |-> {"primary","dedup","t2"}]
    dispatched,      \* set of slot indices that received prompts
    prompt,          \* the composed prompt (abstract token)
    delivered,       \* function SlotIndices -> {"composed", "none"}
    done             \* terminal flag

vars == <<slots, dispatched, prompt, delivered, done>>

ModelIds == 1..MaxModels
SlotIndices == 1..MaxSlots
Tiers == {"primary", "dedup", "t2"}

\* ── Type invariant ───────────────────────────────────────────────────────────
TypeOK ==
    /\ Len(slots) \in 0..MaxSlots
    /\ dispatched \subseteq SlotIndices
    /\ prompt \in {"composed", "none"}
    /\ done \in BOOLEAN

\* ── Initial state ────────────────────────────────────────────────────────────
Init ==
    /\ slots = <<>>
    /\ dispatched = {}
    /\ prompt = "none"
    /\ delivered = [i \in SlotIndices |-> "none"]
    /\ done = FALSE

\* ── Actions ──────────────────────────────────────────────────────────────────

\* Compose the prompt (immutable after composition)
ComposePrompt ==
    /\ done = FALSE
    /\ prompt = "none"
    /\ Len(slots) > 0   \* must have at least one slot before composing
    /\ prompt' = "composed"
    /\ UNCHANGED <<slots, dispatched, delivered, done>>

\* Add a slot with a model assignment
AddSlot(model) ==
    /\ done = FALSE
    /\ Len(slots) < MaxSlots
    /\ prompt = "none"  \* slots configured before dispatch
    /\ LET idx == Len(slots) + 1
           \* Check if this model already appears in an earlier primary slot
           isDuplicate == \E i \in 1..Len(slots) :
               /\ slots[i].model = model
               /\ slots[i].tier = "primary"
           tier == IF isDuplicate THEN "dedup" ELSE "primary"
       IN
       /\ slots' = Append(slots, [model |-> model, tier |-> tier])
       /\ UNCHANGED <<dispatched, prompt, delivered, done>>

\* Dispatch prompt to a slot
\* @requirement DISPATCH-01: delivered prompt is byte-identical to composed prompt
DispatchToSlot(i) ==
    /\ done = FALSE
    /\ prompt = "composed"
    /\ i \in 1..Len(slots)
    /\ i \notin dispatched
    /\ dispatched' = dispatched \cup {i}
    /\ delivered' = [delivered EXCEPT ![i] = "composed"]
    /\ UNCHANGED <<slots, prompt, done>>

\* All slots dispatched — mark done to prevent deadlock
Finish ==
    /\ done = FALSE
    /\ prompt = "composed"
    /\ dispatched = {i \in 1..Len(slots) : TRUE}
    /\ done' = TRUE
    /\ UNCHANGED <<slots, dispatched, prompt, delivered>>

\* ── Next relation ────────────────────────────────────────────────────────────
Next ==
    \/ ComposePrompt
    \/ \E m \in ModelIds : AddSlot(m)
    \/ \E i \in SlotIndices : DispatchToSlot(i)
    \/ Finish

Spec == Init /\ [][Next]_vars /\ WF_vars(Next)

\* ── Safety invariants ────────────────────────────────────────────────────────

\* @requirement DISPATCH-01
\* Every delivered prompt is byte-identical to the composed prompt
PromptFidelity ==
    \A i \in 1..Len(slots) :
        i \in dispatched => delivered[i] = "composed"

\* @requirement DISPATCH-02
\* No two primary-tier slots share the same model
PrimaryModelUniqueness ==
    \A i, j \in 1..Len(slots) :
        /\ i /= j
        /\ slots[i].tier = "primary"
        /\ slots[j].tier = "primary"
        => slots[i].model /= slots[j].model

\* @requirement DISPATCH-02
\* Duplicate-model slots are demoted to "dedup" tier
DuplicateDemotion ==
    \A i \in 1..Len(slots) :
        slots[i].tier = "dedup" =>
            \E j \in 1..(i-1) :
                /\ slots[j].model = slots[i].model
                /\ slots[j].tier = "primary"

====

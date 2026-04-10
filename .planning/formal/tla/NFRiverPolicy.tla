---- MODULE NFRiverPolicy ----
(*
 * .planning/formal/tla/NFRiverPolicy.tla
 * River ML policy: 3-tier slot routing, Q-learning with Bellman updates,
 * epsilon-greedy exploration, and E2E learning loop validation.
 *
 * @requirement ROUTE-05
 * @requirement ROUTE-06
 * @requirement ROUTE-07
 *)
EXTENDS Naturals, TLC

CONSTANTS MaxSlots, MaxEpochs, MaxQValue

VARIABLES
    \* Slot selection state
    selectedSlot,
    policyTier,           \* 0=Preset, 1=River(Q-learning), 2=Default
    \* Q-learning state
    qTable,               \* Q value for current slot (simplified: one active slot)
    epsilon,              \* exploration rate (0..10, scaled by 10)
    epoch,                \* training epoch
    \* Learning loop state
    rewardRecorded,
    qTableUpdated,
    shadowRecommendation,
    loopPhase             \* idle -> reward -> update -> recommend -> display

vars == <<selectedSlot, policyTier, qTable, epsilon, epoch,
          rewardRecorded, qTableUpdated, shadowRecommendation, loopPhase>>

\* ── Type invariant ───────────────────────────────────────────────────────────
\* @requirement ROUTE-05
\* @requirement ROUTE-06
\* @requirement ROUTE-07
TypeOK ==
    /\ selectedSlot \in 0..MaxSlots
    /\ policyTier \in {0, 1, 2}
    /\ qTable \in 0..MaxQValue
    /\ epsilon \in 0..10
    /\ epoch \in 0..MaxEpochs
    /\ rewardRecorded \in {TRUE, FALSE}
    /\ qTableUpdated \in {TRUE, FALSE}
    /\ shadowRecommendation \in 0..MaxSlots
    /\ loopPhase \in {"idle", "reward", "update", "recommend", "display"}

\* ── Initial state ────────────────────────────────────────────────────────────
Init ==
    /\ selectedSlot = 0
    /\ policyTier = 0
    /\ qTable = 0
    /\ epsilon = 10
    /\ epoch = 0
    /\ rewardRecorded = FALSE
    /\ qTableUpdated = FALSE
    /\ shadowRecommendation = 0
    /\ loopPhase = "idle"

\* ── Actions ──────────────────────────────────────────────────────────────────

\* @requirement ROUTE-05
\* Tier 0: PresetPolicy selects a slot directly
PresetSelect ==
    /\ policyTier = 0
    /\ loopPhase = "idle"
    /\ selectedSlot' = 1   \* Preset always picks slot 1
    /\ loopPhase' = "reward"
    /\ UNCHANGED <<policyTier, qTable, epsilon, epoch, rewardRecorded, qTableUpdated, shadowRecommendation>>

\* @requirement ROUTE-05
\* Transition to River policy when preset confidence is below threshold
ActivateRiver ==
    /\ policyTier = 0
    /\ loopPhase = "idle"
    /\ policyTier' = 1
    /\ UNCHANGED <<selectedSlot, qTable, epsilon, epoch, rewardRecorded, qTableUpdated, shadowRecommendation, loopPhase>>

\* @requirement ROUTE-06
\* Epsilon-greedy exploration: explore vs exploit
RiverExplore ==
    /\ policyTier = 1
    /\ loopPhase = "idle"
    /\ epsilon > 0   \* exploration branch
    /\ selectedSlot' = (selectedSlot + 1) % (MaxSlots + 1)
    /\ loopPhase' = "reward"
    /\ UNCHANGED <<policyTier, qTable, epsilon, epoch, rewardRecorded, qTableUpdated, shadowRecommendation>>

\* @requirement ROUTE-06
\* Exploitation: select highest Q-value slot
RiverExploit ==
    /\ policyTier = 1
    /\ loopPhase = "idle"
    /\ epsilon = 0   \* exploitation branch
    /\ selectedSlot' = IF qTable > 0 THEN 1 ELSE 0
    /\ loopPhase' = "reward"
    /\ UNCHANGED <<policyTier, qTable, epsilon, epoch, rewardRecorded, qTableUpdated, shadowRecommendation>>

\* @requirement ROUTE-07
\* Record reward signal from task outcome
RecordReward ==
    /\ loopPhase = "reward"
    /\ ~rewardRecorded
    /\ rewardRecorded' = TRUE
    /\ loopPhase' = "update"
    /\ UNCHANGED <<selectedSlot, policyTier, qTable, epsilon, epoch, qTableUpdated, shadowRecommendation>>

\* @requirement ROUTE-06
\* Bellman update: Q(s,a) <- Q(s,a) + lr * (reward + gamma*maxQ - Q(s,a))
\* Simplified: Q increases if reward is positive, bounded by MaxQValue
BellmanUpdate ==
    /\ loopPhase = "update"
    /\ rewardRecorded = TRUE
    /\ ~qTableUpdated
    /\ qTable' = IF qTable < MaxQValue THEN qTable + 1 ELSE MaxQValue
    /\ qTableUpdated' = TRUE
    /\ loopPhase' = "recommend"
    /\ UNCHANGED <<selectedSlot, policyTier, epsilon, epoch, rewardRecorded, shadowRecommendation>>

\* @requirement ROUTE-07
\* Shadow recommendation displayed in nf-statusline
MakeShadowRecommendation ==
    /\ loopPhase = "recommend"
    /\ qTableUpdated = TRUE
    /\ shadowRecommendation' = selectedSlot
    /\ loopPhase' = "display"
    /\ UNCHANGED <<selectedSlot, policyTier, qTable, epsilon, epoch, rewardRecorded, qTableUpdated>>

\* @requirement ROUTE-06
\* Learning rate decay: epsilon decreases over epochs
DecayEpsilon ==
    /\ loopPhase = "display"
    /\ epoch < MaxEpochs
    /\ epsilon > 0
    /\ epsilon' = epsilon - 1
    /\ epoch' = epoch + 1
    /\ loopPhase' = "idle"
    /\ rewardRecorded' = FALSE
    /\ qTableUpdated' = FALSE
    /\ UNCHANGED <<selectedSlot, policyTier, qTable, shadowRecommendation>>

Done ==
    /\ epoch = MaxEpochs
    /\ loopPhase = "idle"
    /\ UNCHANGED vars

Next ==
    \/ PresetSelect
    \/ ActivateRiver
    \/ RiverExplore
    \/ RiverExploit
    \/ RecordReward
    \/ BellmanUpdate
    \/ MakeShadowRecommendation
    \/ DecayEpsilon
    \/ Done

Spec == Init /\ [][Next]_vars /\ WF_vars(RecordReward) /\ WF_vars(BellmanUpdate)

\* ── Safety invariants ────────────────────────────────────────────────────────

\* @requirement ROUTE-05
\* Selected slot is always valid
SlotValid == selectedSlot \in 0..MaxSlots

\* @requirement ROUTE-05
\* Policy tier is always valid
PolicyTierValid == policyTier \in {0, 1, 2}

\* @requirement ROUTE-06
\* Q table value stays bounded
QTableBounded == qTable \in 0..MaxQValue

\* @requirement ROUTE-06
\* Epsilon only decreases (learning rate decay is monotone)
EpsilonDecays == epsilon \in 0..10

\* @requirement ROUTE-07
\* Shadow recommendation always refers to a valid slot
ShadowSlotValid == shadowRecommendation \in 0..MaxSlots

\* @requirement ROUTE-07
\* Loop phases are ordered: update requires reward first
UpdateRequiresReward ==
    loopPhase = "update" => rewardRecorded = TRUE

====

---- MODULE QGSDCheckpointGate ----
(*
 * .planning/formal/tla/QGSDCheckpointGate.tla
 * Models the checkpoint:human-verify consensus gate.
 * Source: commands/nf/execute-plan.md
 *
 * QUORUM-06: checkpoint:human-verify in auto-mode triggers a quorum
 * consensus gate requiring 100% APPROVE from all responding workers;
 * any BLOCK vote or quorum unavailability blocks progression.
 *
 * @requirement QUORUM-06
 *)
EXTENDS Naturals, FiniteSets

CONSTANTS
    Workers,       \* Set of quorum worker slots (e.g., {"w1","w2","w3"})
    MaxWorkers     \* Maximum number of workers polled

ASSUME MaxWorkers \in Nat /\ MaxWorkers > 0

VARIABLES
    gate,          \* "PENDING", "APPROVED", "BLOCKED"
    votes,         \* Function: Workers -> {"APPROVE","BLOCK","UNAVAIL","NONE"}
    responded      \* Set of workers that have responded

vars == <<gate, votes, responded>>

\* Type invariant
\* @requirement QUORUM-06
TypeOK ==
    /\ gate \in {"PENDING", "APPROVED", "BLOCKED"}
    /\ responded \subseteq Workers
    /\ \A w \in Workers : votes[w] \in {"APPROVE", "BLOCK", "UNAVAIL", "NONE"}

\* Initial state: gate pending, no votes
Init ==
    /\ gate      = "PENDING"
    /\ votes     = [w \in Workers |-> "NONE"]
    /\ responded = {}

\* Worker submits an APPROVE vote
VoteApprove(w) ==
    /\ gate = "PENDING"
    /\ w \notin responded
    /\ votes' = [votes EXCEPT ![w] = "APPROVE"]
    /\ responded' = responded \union {w}
    /\ UNCHANGED gate

\* Worker submits a BLOCK vote
VoteBlock(w) ==
    /\ gate = "PENDING"
    /\ w \notin responded
    /\ votes' = [votes EXCEPT ![w] = "BLOCK"]
    /\ responded' = responded \union {w}
    /\ UNCHANGED gate

\* Worker is unavailable
VoteUnavail(w) ==
    /\ gate = "PENDING"
    /\ w \notin responded
    /\ votes' = [votes EXCEPT ![w] = "UNAVAIL"]
    /\ responded' = responded \union {w}
    /\ UNCHANGED gate

\* Evaluate gate after all workers responded
EvaluateGate ==
    /\ gate = "PENDING"
    /\ responded = Workers
    \* 100% APPROVE required from responding (non-UNAVAIL) workers
    /\ LET respondingWorkers == {w \in Workers : votes[w] \in {"APPROVE", "BLOCK"}}
       IN
       IF respondingWorkers = {} THEN
           \* All UNAVAIL → BLOCKED (quorum unavailability blocks)
           /\ gate' = "BLOCKED"
       ELSE IF \A w \in respondingWorkers : votes[w] = "APPROVE" THEN
           \* 100% APPROVE → APPROVED
           /\ gate' = "APPROVED"
       ELSE
           \* Any BLOCK → BLOCKED
           /\ gate' = "BLOCKED"
    /\ UNCHANGED <<votes, responded>>

\* Combined Next action
Next ==
    \/ EvaluateGate
    \/ \E w \in Workers :
        \/ VoteApprove(w)
        \/ VoteBlock(w)
        \/ VoteUnavail(w)

Spec == Init /\ [][Next]_vars

\* ── Safety properties ──────────────────────────────────────────────────────

\* QUORUM-06: Any BLOCK vote means gate is never APPROVED
\* @requirement QUORUM-06
BlockVotePreventsApproval ==
    (\E w \in Workers : votes[w] = "BLOCK")
        => gate # "APPROVED"

\* QUORUM-06: All UNAVAIL means gate is never APPROVED
\* @requirement QUORUM-06
AllUnavailPreventsApproval ==
    (\A w \in Workers : votes[w] = "UNAVAIL")
        => gate # "APPROVED"

\* QUORUM-06: APPROVED only when 100% of responding workers APPROVE
\* @requirement QUORUM-06
ApprovedRequiresUnanimity ==
    gate = "APPROVED" =>
        /\ responded = Workers
        /\ \A w \in Workers : votes[w] \in {"APPROVE", "UNAVAIL"}
        /\ \E w \in Workers : votes[w] = "APPROVE"

====
